import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadScopedSecret } from "../_shared/secure-config.ts";
import { buildSyntheticLoginEmail, buildTemporarySyntheticLoginEmail, normalizeUsername } from "../_shared/auth.ts";
import { sendMasterCredentialsEmail, notifyAdminsNewCt } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const PAYMENT_SUCCESS_STATUSES = new Set(["RECEIVED", "CONFIRMED", "PAID"]);
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const getWebhookTokenFromHeader = (req: Request) => {
  const candidates = [
    "asaas_access_token",
    "Asaas_Access_Token",
    "asaas-access-token",
    "Asaas-Access-Token",
    "x-asaas-access-token",
    "X-Asaas-Access-Token",
    "access_token",
    "Access-Token",
  ];

  for (const header of candidates) {
    const token = req.headers.get(header)?.trim();
    if (token) return token;
  }

  return "";
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

const cleanupDuplicatePendingSubscriptions = async (
  supabase: ReturnType<typeof createClient>,
  activeSubscription: {
    id: string;
    metadata?: Record<string, unknown> | null;
  },
  userId: string,
  ctId: string,
) => {
  const normalizedUsername = String(activeSubscription.metadata?.master_username || "").trim().toLowerCase();
  if (!normalizedUsername || !activeSubscription.ct_id) return;

  const { data: duplicates, error } = await supabase
    .from("billing_subscriptions")
    .select("id, metadata")
    .contains("metadata", { master_username: normalizedUsername })
    .eq("ct_id", activeSubscription.ct_id)
    .in("status", ["pending", "past_due"])
    .neq("id", activeSubscription.id);

  if (error || !duplicates?.length) {
    if (error) console.error("cleanup duplicates error:", error);
    return;
  }

  for (const duplicate of duplicates) {
    await supabase
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

const recordProvisioningError = async (
  supabase: ReturnType<typeof createClient>,
  billingSubscription: {
    id: string;
    metadata?: Record<string, unknown> | null;
  },
  error: unknown,
) => {
  const currentMetadata = billingSubscription.metadata || {};
  const lastError = error instanceof Error ? error.message : String(error);

  await supabase
    .from("billing_subscriptions")
    .update({
      metadata: {
        ...currentMetadata,
        last_provisioning_error: lastError,
        last_provisioning_error_at: new Date().toISOString(),
        provisioning_attempts: Number((currentMetadata as Record<string, unknown>)["provisioning_attempts"] || 0) + 1,
      },
    })
    .eq("id", billingSubscription.id);
};

const provisionPendingSubscriptionAccount = async (
  supabase: ReturnType<typeof createClient>,
  billingSubscription: {
    id: string;
    user_id?: string | null;
    ct_id?: string | null;
    master_name?: string | null;
    ct_name?: string | null;
    customer_email?: string | null;
    metadata?: Record<string, unknown> | null;
  },
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

  const encryptedPassword = String(pendingSignup?.password_encrypted || "");
  const passwordIv = String(pendingSignup?.password_iv || "");
  if (!encryptedPassword || !passwordIv) {
    throw new Error("Cadastro pendente sem credenciais seguras.");
  }

  let existingProfileQuery = supabase
    .from("profiles")
    .select("user_id, ct_id")
    .ilike("username", username);

  existingProfileQuery = billingSubscription.ct_id
    ? existingProfileQuery.eq("ct_id", billingSubscription.ct_id)
    : existingProfileQuery.is("ct_id", null);

  const { data: existingProfile, error: existingProfileError } = await existingProfileQuery.maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  if (existingProfile?.user_id && existingProfile?.ct_id) {
    return {
      userId: existingProfile.user_id,
      ctId: existingProfile.ct_id,
    };
  }

  const password = await decryptPendingPassword(encryptedPassword, passwordIv);
  const contactEmail = String(pendingSignup?.email || billingSubscription.customer_email || "").trim().toLowerCase();
  const phone = String(pendingSignup?.phone || "").trim() || null;

  const placeholderEmail = billingSubscription.ct_id
    ? buildSyntheticLoginEmail(username, billingSubscription.ct_id)
    : buildTemporarySyntheticLoginEmail(username, billingSubscription.id);

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email: placeholderEmail,
    password,
    email_confirm: true,
    user_metadata: { nome: billingSubscription.master_name || username },
  });

  if (createUserError || !createdUser.user) {
    throw createUserError || new Error("Nao foi possivel criar o usuario do mestre apos a confirmacao do pagamento.");
  }

  const userId = createdUser.user.id;

  try {
    const { data: createdCt, error: createCtError } = await supabase
      .from("centros_treinamento")
      .insert({
        nome: billingSubscription.ct_name || "CT",
        mestre_lider_id: userId,
      })
      .select("id")
      .single();

    if (createCtError || !createdCt) {
      throw createCtError || new Error("Nao foi possivel criar o CT apos a confirmacao do pagamento.");
    }

    const ctId = createdCt.id as string;

    const { error: authEmailUpdateError } = await supabase.auth.admin.updateUserById(userId, {
      email: buildSyntheticLoginEmail(username, ctId),
    });

    if (authEmailUpdateError && !authEmailUpdateError.message.includes("not found")) {
      throw authEmailUpdateError;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        nome: billingSubscription.master_name || username,
        email: contactEmail || null,
        telefone: phone,
        ct_id: ctId,
        username,
      })
      .eq("user_id", userId);

    if (profileError) {
      throw profileError;
    }

    const { error: deleteRolesError } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (deleteRolesError) {
      throw deleteRolesError;
    }

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: "mestre",
    });

    if (roleError) {
      throw roleError;
    }

    await supabase
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
    await supabase.auth.admin.deleteUser(userId);
    throw error;
  }
};

const getExpectedWebhookToken = async (
  supabase: ReturnType<typeof createClient>,
  paymentId: string,
) => {
  const { data: billingSubscription, error: billingError } = await supabase
    .from("billing_subscriptions")
    .select("id")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();

  if (billingError) throw billingError;

  if (!billingSubscription?.id) {
    return "";
  }

  return await loadScopedSecret(supabase, "billing_admin", "asaas_webhook_token", null);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const payment = body?.payment;

    if (!payment?.id) {
      return new Response("No payment data", { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const paymentId = payment.id as string;
    const receivedWebhookToken = getWebhookTokenFromHeader(req);
    const expectedWebhookToken = await getExpectedWebhookToken(supabase, paymentId);

    if (!expectedWebhookToken || !receivedWebhookToken || receivedWebhookToken !== expectedWebhookToken) {
      console.warn("Rejected Asaas webhook with invalid token", {
        paymentId,
        hasExpectedToken: Boolean(expectedWebhookToken),
        hasReceivedToken: Boolean(receivedWebhookToken),
      });

      return new Response(
        JSON.stringify({ error: "Unauthorized webhook" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const customerId = payment.customer as string | null;
    const value = Number(payment.value || 0);
    const status = String(payment.status || "").toUpperCase();
    const billingType = String(payment.billingType || "");

    const { data: existingPayment } = await supabase
      .from("pagamentos")
      .select("id, status")
      .eq("asaas_payment_id", paymentId)
      .maybeSingle();

    const { data: billingSubscription } = await supabase
      .from("billing_subscriptions")
      .select("id, user_id, ct_id, plan_id, billing_cycle, started_at, paid_at, master_name, ct_name, customer_email, metadata")
      .eq("asaas_payment_id", paymentId)
      .maybeSingle();

    if (!existingPayment) {
      await supabase.from("pagamentos").insert({
        asaas_payment_id: paymentId,
        customer_id: customerId,
        valor: value,
        status,
        billing_type: billingType,
        ct_id: billingSubscription?.ct_id || null,
        aluno_id: null,
      });
    } else {
      await supabase
        .from("pagamentos")
        .update({
          status,
          ct_id: billingSubscription?.ct_id || null,
          aluno_id: null,
        })
        .eq("asaas_payment_id", paymentId);
    }

    const isPaid = PAYMENT_SUCCESS_STATUSES.has(status);
    const wasAlreadyPaid = PAYMENT_SUCCESS_STATUSES.has(String(existingPayment?.status || ""));

    if (billingSubscription) {
      if (isPaid) {
        try {
          const provisioned = await provisionPendingSubscriptionAccount(supabase, billingSubscription);
          const shouldActivateNow = !wasAlreadyPaid;
          const activationDate = new Date();
          const expiresAt = new Date(activationDate);

          if (billingSubscription.billing_cycle === "yearly") {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }

          await supabase
            .from("billing_subscriptions")
            .update({
              user_id: provisioned.userId,
              ct_id: provisioned.ctId,
              status: "active",
              started_at: shouldActivateNow ? activationDate.toISOString() : billingSubscription.started_at,
              paid_at: shouldActivateNow ? activationDate.toISOString() : billingSubscription.paid_at,
              expires_at: shouldActivateNow ? expiresAt.toISOString() : undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("id", billingSubscription.id);

          await supabase
            .from("pagamentos")
            .update({
              ct_id: provisioned.ctId,
            })
            .eq("asaas_payment_id", paymentId);

          // ENVIAR CREDENCIAIS E NOTIFICAR ADMINS
          if (shouldActivateNow) {
          try {
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
            const encryptedPassword = String(pendingSignup?.password_encrypted || "");
            const passwordIv = String(pendingSignup?.password_iv || "");
            const masterEmail = String(pendingSignup?.email || billingSubscription.customer_email || "").trim().toLowerCase();

            // Descriptografar senha para enviar no email
            if (encryptedPassword && passwordIv) {
              const masterPassword = await decryptPendingPassword(encryptedPassword, passwordIv);

              // Buscar dados do plano para notificação
              const { data: planData } = await supabase
                .from("billing_plans")
                .select("id, name")
                .eq("id", billingSubscription.plan_id)
                .maybeSingle();

              const planName = planData?.name || "Plano contratado";

              // Enviar credenciais ao mestre
              await sendMasterCredentialsEmail(
                masterEmail,
                billingSubscription.master_name || "Mestre",
                username,
                masterPassword,
                billingSubscription.ct_name || "Centro de Treinamento",
                "https://bjjmanager.com/login"
              );

              // Notificar admins
              await notifyAdminsNewCt(
                supabase,
                billingSubscription.master_name || "Mestre",
                billingSubscription.ct_name || "CT",
                username,
                billingSubscription.master_name || username,
                planName,
                provisioned.ctId,
                expiresAt.toISOString()
              );
            }
          } catch (notificationError) {
            console.error("[webhook-asaas] Erro ao enviar notificações:", notificationError);
            // Não fazer falhar o webhook por erro de email - apenas logar o erro
          }
        }

          await cleanupDuplicatePendingSubscriptions(supabase, billingSubscription, provisioned.userId, provisioned.ctId);
        } catch (provisionError) {
          console.error("[webhook-asaas] provisioning error:", provisionError);
          await recordProvisioningError(supabase, billingSubscription, provisionError);
          throw provisionError;
        }
      } else if (["OVERDUE", "REFUNDED", "CANCELLED", "FAILED"].includes(status)) {
        await supabase
          .from("billing_subscriptions")
          .update({
            status: status === "OVERDUE" ? "past_due" : "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", billingSubscription.id);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[webhook-asaas] Erro ao processar webhook");
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
