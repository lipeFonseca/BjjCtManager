import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadScopedConfigMap } from "../_shared/secure-config.ts";
import {
  buildSyntheticLoginEmail,
  buildLegacySyntheticLoginEmail,
  buildTemporarySyntheticLoginEmail,
  normalizeUsername,
} from "../_shared/auth.ts";
import { getContentHeaders, getOptionsHeaders, isOriginAllowed } from "../_shared/cors.ts";

const ASAAS_BASE_URLS = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://api-sandbox.asaas.com/v3",
} as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const PAYMENT_SUCCESS_STATUSES = new Set(["RECEIVED", "CONFIRMED", "PAID"]);
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const toError = (error: unknown, fallback = "Erro desconhecido") => {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(fallback);
  }
};

type BillingSubscriptionRow = {
  id: string;
  user_id: string | null;
  ct_id: string | null;
  billing_cycle: string;
  status: string;
  started_at: string | null;
  paid_at: string | null;
  expires_at: string | null;
  asaas_payment_id: string | null;
  master_name: string | null;
  ct_name: string | null;
  customer_email: string | null;
  metadata: Record<string, unknown> | null;
};

type LoginProfileRow = {
  email: string | null;
  username: string | null;
  ct_id: string | null;
  user_id: string | null;
};

const normalizeCtName = (value: unknown) =>
  String(value || "").trim().toLowerCase();

const cleanupDuplicatePendingSubscriptions = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  activeSubscription: BillingSubscriptionRow,
  userId: string,
  ctId: string,
) => {
  const normalizedUsername = String(activeSubscription.metadata?.master_username || "").trim().toLowerCase();
  if (!normalizedUsername) return;

  const { data: duplicates, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("id, metadata")
    .contains("metadata", { master_username: normalizedUsername })
    .in("status", ["pending", "past_due"])
    .neq("id", activeSubscription.id);

  if (error || !duplicates?.length) {
    if (error) console.error("cleanup duplicates error:", error);
    return;
  }

  for (const duplicate of duplicates) {
    await supabaseAdmin
      .from("billing_subscriptions")
      .update({
        user_id: userId,
        ct_id: ctId,
        status: "canceled",
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          ...((duplicate.metadata as Record<string, unknown> | null) || {}),
          duplicate_of_subscription_id: activeSubscription.id,
          duplicate_cleaned_at: new Date().toISOString(),
          pending_signup: null,
        },
      })
      .eq("id", duplicate.id);
  }
};

const deriveEncryptionKey = async () => {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) {
    throw new Error("Chave interna indisponivel para concluir o cadastro pendente.");
  }

  const hash = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
};

const decryptPendingPassword = async (encryptedValue: string, iv: string) => {
  const key = await deriveEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    key,
    fromBase64(encryptedValue),
  );

  return textDecoder.decode(decrypted);
};

const getAsaasSettings = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const settingsMap = await loadScopedConfigMap(supabaseAdmin, "billing_admin", null);

  return {
    apiKey: (settingsMap["asaas_api_key"] || "").trim(),
    env: (settingsMap["asaas_env"] || "sandbox").trim() === "production" ? "production" : "sandbox",
  } as const;
};

const fetchAsaasPaymentStatus = async (
  apiKey: string,
  env: "sandbox" | "production",
  paymentId: string,
) => {
  const baseUrl = env === "production" ? ASAAS_BASE_URLS.production : ASAAS_BASE_URLS.sandbox;
  const response = await fetch(`${baseUrl}/payments/${paymentId}`, {
    headers: {
      access_token: apiKey,
      accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.errors?.[0]?.description || "Nao foi possivel consultar o pagamento no Asaas.");
  }

  return payload as { status?: string | null };
};

const provisionPendingSubscriptionAccount = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  billingSubscription: BillingSubscriptionRow,
) => {
  if (billingSubscription.user_id && billingSubscription.ct_id) {
    return {
      userId: billingSubscription.user_id,
      ctId: billingSubscription.ct_id,
    };
  }

  const pendingSignup = (billingSubscription.metadata?.pending_signup || null) as
    | {
        username?: string;
        password_encrypted?: string;
        password_iv?: string;
        email?: string;
        phone?: string;
      }
    | null;

  const username = String(pendingSignup?.username || billingSubscription.metadata?.master_username || "").trim().toLowerCase();
  if (!USERNAME_REGEX.test(username)) {
    throw new Error("Cadastro pendente sem nome de usuario valido.");
  }

  let existingProfileQuery = supabaseAdmin
    .from("profiles")
    .select("user_id, ct_id")
    .ilike("username", username);

  existingProfileQuery = billingSubscription.ct_id
    ? existingProfileQuery.eq("ct_id", billingSubscription.ct_id)
    : existingProfileQuery.is("ct_id", null);

  const { data: existingProfile, error: existingProfileError } = await existingProfileQuery.maybeSingle();

  if (existingProfileError) throw toError(existingProfileError, "Erro ao buscar perfil existente.");

  if (existingProfile?.user_id && existingProfile?.ct_id) {
    return {
      userId: existingProfile.user_id,
      ctId: existingProfile.ct_id,
    };
  }

  const encryptedPassword = String(pendingSignup?.password_encrypted || "");
  const passwordIv = String(pendingSignup?.password_iv || "");
  if (!encryptedPassword || !passwordIv) {
    throw new Error("Cadastro pendente sem credenciais seguras.");
  }

  const password = await decryptPendingPassword(encryptedPassword, passwordIv);
  const contactEmail = String(pendingSignup?.email || billingSubscription.customer_email || "").trim().toLowerCase();
  const phone = String(pendingSignup?.phone || "").trim() || null;

  const placeholderEmail = billingSubscription.ct_id
    ? buildSyntheticLoginEmail(username, billingSubscription.ct_id)
    : buildTemporarySyntheticLoginEmail(username, crypto.randomUUID());

  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: placeholderEmail,
    password,
    email_confirm: true,
    user_metadata: { nome: billingSubscription.master_name || username },
  });

  if (createUserError || !createdUser.user) {
    throw toError(createUserError || new Error("Nao foi possivel criar o usuario do mestre."));
  }

  const userId = createdUser.user.id;

  try {
    const { data: createdCt, error: createCtError } = await supabaseAdmin
      .from("centros_treinamento")
      .insert({
        nome: billingSubscription.ct_name || "CT",
        mestre_lider_id: userId,
      })
      .select("id")
      .single();

    if (createCtError || !createdCt) {
      throw toError(createCtError || new Error("Nao foi possivel criar o CT da assinatura."));
    }

    const ctId = createdCt.id as string;

    const { error: authEmailUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: buildSyntheticLoginEmail(username, ctId),
    });

    if (authEmailUpdateError && !authEmailUpdateError.message.includes("not found")) {
      throw toError(authEmailUpdateError, "Erro ao atualizar email sintetico do usuario.");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        nome: billingSubscription.master_name || username,
        email: contactEmail || null,
        telefone: phone,
        ct_id: ctId,
        username,
      })
      .eq("user_id", userId);

    if (profileError) throw toError(profileError, "Erro ao atualizar perfil do mestre.");

    const { error: deleteRolesError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    if (deleteRolesError) throw toError(deleteRolesError, "Erro ao limpar papeis anteriores do usuario.");

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "mestre",
    });

    if (roleError) throw toError(roleError, "Erro ao definir papel de mestre para o usuario.");

    await supabaseAdmin
      .from("billing_subscriptions")
      .update({
        user_id: userId,
        ct_id: ctId,
        metadata: {
          ...(billingSubscription.metadata || {}),
          pending_signup: null,
          signup_completed_at: new Date().toISOString(),
        },
      })
      .eq("id", billingSubscription.id);

    return { userId, ctId };
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw error;
  }
};

const activateBillingSubscription = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  billingSubscription: BillingSubscriptionRow,
  userId: string,
  ctId: string,
) => {
  const activationDate = new Date();
  const expiresAt = new Date(activationDate);

  if (billingSubscription.billing_cycle === "yearly") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  const { error } = await supabaseAdmin
    .from("billing_subscriptions")
    .update({
      user_id: userId,
      ct_id: ctId,
      status: "active",
      started_at: billingSubscription.started_at || activationDate.toISOString(),
      paid_at: billingSubscription.paid_at || activationDate.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", billingSubscription.id);

  if (error) throw toError(error, "Erro ao buscar assinatura pendente.");

  await cleanupDuplicatePendingSubscriptions(supabaseAdmin, billingSubscription, userId, ctId);
};

const syncPendingSignupIfNeeded = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  normalizedUsername: string,
  requestedCtName = "",
) => {
  const { data: billingSubscriptions, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("id, user_id, ct_id, billing_cycle, status, started_at, paid_at, expires_at, asaas_payment_id, master_name, ct_name, customer_email, metadata")
    .contains("metadata", { master_username: normalizedUsername })
    .in("status", ["pending", "past_due"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw toError(error, "Erro ao ativar assinatura.");

  const normalizedCtName = normalizeCtName(requestedCtName);
  const matchingSubscription = (billingSubscriptions || []).find((subscription) => {
    if (!normalizedCtName) return true;
    return normalizeCtName(subscription.ct_name) === normalizedCtName;
  });

  const billingSubscription = (matchingSubscription || null) as BillingSubscriptionRow | null;
  if (!billingSubscription?.asaas_payment_id) {
    return;
  }

  const { apiKey, env } = await getAsaasSettings(supabaseAdmin);
  if (!apiKey) {
    return;
  }

  const payment = await fetchAsaasPaymentStatus(apiKey, env, billingSubscription.asaas_payment_id);
  const paymentStatus = String(payment.status || "").toUpperCase();
  const isPaid = PAYMENT_SUCCESS_STATUSES.has(paymentStatus);

  if (!isPaid) {
    return;
  }

  const provisioned = await provisionPendingSubscriptionAccount(supabaseAdmin, billingSubscription);
  await activateBillingSubscription(supabaseAdmin, billingSubscription, provisioned.userId, provisioned.ctId);
};

const getAdminUserIds = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  userIds: string[],
) => {
  if (!userIds.length) return new Set<string>();

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .in("user_id", userIds);

  if (error) throw toError(error, "Erro ao validar perfil administrativo.");

  return new Set((data || []).map((row) => String(row.user_id)));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getOptionsHeaders(req.headers) });
  }

  try {
    if (req.headers.get("origin") && !isOriginAllowed(req.headers)) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: getContentHeaders(req.headers),
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { username, password, ct } = await req.json();
    const normalizedUsername = normalizeUsername(username);
    const normalizedCtName = normalizeCtName(ct);

    if (!normalizedUsername || !password) {
      throw new Error("Usuario e senha sao obrigatorios");
    }

    if (!normalizedCtName && normalizedUsername !== "admin") {
      throw new Error("Informe o nome do CT.");
    }

    const resolveCtIds = async () => {
      if (!normalizedCtName) return null;

      const { data, error } = await supabaseAdmin
        .from("centros_treinamento")
        .select("id, nome");

      if (error) throw toError(error, "Erro ao buscar CT para login.");

      return (data || [])
        .filter((row) => normalizeCtName(row.nome) === normalizedCtName)
        .map((row) => String(row.id));
    };

    const requestedCtIds = await resolveCtIds();

    if (normalizedCtName && requestedCtIds && requestedCtIds.length === 0) {
      throw new Error("CT nao encontrado para este usuario.");
    }

    const queryProfiles = async () => {
      let query = supabaseAdmin
        .from("profiles")
        .select("email, username, ct_id, user_id")
        .ilike("username", normalizedUsername);

      if (requestedCtIds?.length) {
        query = query.in("ct_id", requestedCtIds);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;
      return (data || []) as LoginProfileRow[];
    };

    let profiles = await queryProfiles();

    if (!profiles.length) {
      await syncPendingSignupIfNeeded(supabaseAdmin, normalizedUsername, normalizedCtName);
      profiles = await queryProfiles();
    }

    if (!profiles.length) {
      if (normalizedCtName) {
        throw new Error("Nome do CT invalido para este usuario.");
      }

      throw new Error("Nome de usuario ou senha incorretos");
    }

    if (!normalizedCtName) {
      const adminUserIds = await getAdminUserIds(
        supabaseAdmin,
        profiles
          .map((profile) => String(profile.user_id || ""))
          .filter(Boolean),
      );

      const adminProfiles = profiles.filter((profile) => adminUserIds.has(String(profile.user_id || "")));

      if (normalizedUsername !== "admin" || !adminProfiles.length) {
        throw new Error("Informe o nome do CT.");
      }

      profiles = adminProfiles;
    }

    const candidateEmails = new Set<string>();
    for (const profile of profiles) {
      if (profile.ct_id) {
        candidateEmails.add(buildSyntheticLoginEmail(normalizedUsername, String(profile.ct_id)));
      }
      if (profile.email) {
        candidateEmails.add(String(profile.email));
      }
    }
    if (normalizedUsername === "admin") {
      candidateEmails.add(buildLegacySyntheticLoginEmail(normalizedUsername));
    }

    let authData: { session: unknown; user: unknown } | null = null;
    for (const email of candidateEmails) {
      if (!email) continue;
      const attempt = await supabaseAuth.auth.signInWithPassword({
        email,
        password,
      });
      if (!attempt.error) {
        authData = attempt.data;
        break;
      }
    }

    if (!authData) {
      throw new Error("Nome de usuario ou senha incorretos");
    }

    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user,
      }),
      {
        headers: getContentHeaders(req.headers),
      }
    );
  } catch (error: unknown) {
    const normalizedError = toError(error);
    try {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      await supabaseAdmin.from("edge_function_diagnostics").insert({
        request_id: crypto.randomUUID(),
        function_name: "login-by-username",
        phase: "login",
        error_message: normalizedError.message,
        details: {},
      });
    } catch (_diagnosticError) {
      // best effort
    }

    const message = normalizedError.message;
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: getContentHeaders(req.headers),
    });
  }
});
