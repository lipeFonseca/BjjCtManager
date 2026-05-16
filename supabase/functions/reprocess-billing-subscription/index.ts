import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadScopedConfigMap } from "../_shared/secure-config.ts";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_BASE_URLS = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://api-sandbox.asaas.com/v3",
} as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const PAYMENT_SUCCESS_STATUSES = new Set(["RECEIVED", "CONFIRMED", "PAID"]);
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

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

  if (existingProfileError) throw existingProfileError;

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

  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: buildSyntheticLoginEmail(username),
    password,
    email_confirm: true,
    user_metadata: { nome: billingSubscription.master_name || username },
  });

  if (createUserError || !createdUser.user) {
    throw createUserError || new Error("Nao foi possivel criar o usuario do mestre.");
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
      throw createCtError || new Error("Nao foi possivel criar o CT da assinatura.");
    }

    const ctId = createdCt.id as string;

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

    if (profileError) throw profileError;

    const { error: deleteRolesError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    if (deleteRolesError) throw deleteRolesError;

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "mestre",
    });

    if (roleError) throw roleError;

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

  if (error) throw error;

  await cleanupDuplicatePendingSubscriptions(supabaseAdmin, billingSubscription, userId, ctId);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Nao autenticado");
    }

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      throw new Error("Nao autenticado");
    }

    const roles = await getUserRoles(supabaseAdmin, user.id);
    const highestRole = getHighestRole(roles);

    if (highestRole !== "admin") {
      throw new Error("Sem permissao");
    }

    const body = await req.json();
    const subscriptionId = String(body?.subscription_id || "").trim();
    if (!subscriptionId) {
      throw new Error("subscription_id is required");
    }

    const { data: rows, error: subscriptionError } = await supabaseAdmin
      .from("billing_subscriptions")
      .select("id, user_id, ct_id, billing_cycle, status, started_at, paid_at, expires_at, asaas_payment_id, master_name, ct_name, customer_email, metadata")
      .eq("id", subscriptionId)
      .limit(1);

    if (subscriptionError) throw subscriptionError;

    const billingSubscription = (rows?.[0] || null) as BillingSubscriptionRow | null;
    if (!billingSubscription) {
      throw new Error("Assinatura nao encontrada.");
    }

    if (!billingSubscription.asaas_payment_id) {
      throw new Error("Assinatura sem pagamento Asaas vinculado.");
    }

    const { apiKey, env } = await getAsaasSettings(supabaseAdmin);
    if (!apiKey) {
      throw new Error("API key do Asaas nao configurada.");
    }

    const payment = await fetchAsaasPaymentStatus(apiKey, env, billingSubscription.asaas_payment_id);
    const paymentStatus = String(payment.status || "").toUpperCase();
    const isPaid = PAYMENT_SUCCESS_STATUSES.has(paymentStatus);

    if (!isPaid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Pagamento ainda nao confirmado no Asaas. Status atual: ${paymentStatus || "desconhecido"}.`,
          payment_status: paymentStatus || null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const provisioned = await provisionPendingSubscriptionAccount(supabaseAdmin, billingSubscription);
    await activateBillingSubscription(supabaseAdmin, billingSubscription, provisioned.userId, provisioned.ctId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Assinatura reprocessada com sucesso.",
        payment_status: paymentStatus,
        user_id: provisioned.userId,
        ct_id: provisioned.ctId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
