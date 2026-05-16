import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadScopedConfigMap } from "../_shared/secure-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URLS = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://api-sandbox.asaas.com/v3",
} as const;

type AsaasEnvironment = keyof typeof ASAAS_BASE_URLS;
type BillingCycle = "monthly" | "yearly";
type PaymentMethod = "pix" | "credit_card";

class AsaasApiError extends Error {
  status: number;
  payload: any;

  constructor(message: string, status: number, payload: any) {
    super(message);
    this.name = "AsaasApiError";
    this.status = status;
    this.payload = payload;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getBaseUrl = (env: string | null | undefined) =>
  env === "production" ? ASAAS_BASE_URLS.production : ASAAS_BASE_URLS.sandbox;

const getAsaasErrorMessage = (payload: any, status: number) => {
  const description = payload?.errors?.[0]?.description;
  if (description) return description;
  if (status === 401) return "A chave de API do Asaas e invalida ou pertence a outro ambiente.";
  if (status === 403) return "A chave de API do Asaas nao tem permissao para esta operacao.";
  if (status === 404) return "O endpoint do Asaas nao foi encontrado para este ambiente.";
  return `Erro ${status} ao comunicar com o Asaas.`;
};

const normalizeDocument = (value: string) => value.replace(/\D/g, "");
const normalizePhone = (value: string) => value.replace(/\D/g, "");
const normalizeUsername = (value: string) => value.trim().toLowerCase();
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
const textEncoder = new TextEncoder();

const buildCustomerPayload = ({
  name,
  email,
  externalReference,
  cpfCnpj,
  phone,
}: {
  name: string;
  email: string;
  externalReference: string;
  cpfCnpj: string;
  phone: string;
}) => ({
  name,
  email,
  cpfCnpj,
  phone: phone || undefined,
  externalReference,
  notificationDisabled: false,
});

const updateCustomer = async ({
  baseUrl,
  apiKey,
  customerId,
  name,
  email,
  externalReference,
  cpfCnpj,
  phone,
}: {
  baseUrl: string;
  apiKey: string;
  customerId: string;
  name: string;
  email: string;
  externalReference: string;
  cpfCnpj: string;
  phone: string;
}) => {
  const response = await fetch(`${baseUrl}/customers/${customerId}`, {
    method: "PUT",
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(
      buildCustomerPayload({
        name,
        email,
        externalReference,
        cpfCnpj,
        phone,
      }),
    ),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) {
    throw new AsaasApiError(
      getAsaasErrorMessage(payload, response.status) || "Nao foi possivel atualizar o cliente no Asaas.",
      response.status,
      payload,
    );
  }

  return payload;
};

const getOrCreateCustomer = async (
  baseUrl: string,
  apiKey: string,
  name: string,
  email: string,
  externalReference: string,
  cpfCnpj: string,
  phone: string,
) => {
  const searchResponse = await fetch(
    `${baseUrl}/customers?email=${encodeURIComponent(email)}&externalReference=${encodeURIComponent(externalReference)}`,
    { headers: { access_token: apiKey, accept: "application/json" } }
  );

  const searchPayload = await searchResponse.json().catch(() => ({}));
  if (Array.isArray(searchPayload?.data) && searchPayload.data.length > 0) {
    const existingCustomer = searchPayload.data[0] as {
      id: string;
      cpfCnpj?: string | null;
      phone?: string | null;
      mobilePhone?: string | null;
      name?: string | null;
      email?: string | null;
      externalReference?: string | null;
    };

    const existingDocument = normalizeDocument(existingCustomer.cpfCnpj || "");
    const existingPhone = normalizePhone(existingCustomer.mobilePhone || existingCustomer.phone || "");
    const shouldUpdate =
      existingDocument !== cpfCnpj ||
      (!!phone && existingPhone !== phone) ||
      (existingCustomer.name || "") !== name ||
      (existingCustomer.email || "") !== email ||
      (existingCustomer.externalReference || "") !== externalReference;

    if (shouldUpdate) {
      await updateCustomer({
        baseUrl,
        apiKey,
        customerId: existingCustomer.id,
        name,
        email,
        externalReference,
        cpfCnpj,
        phone,
      });
    }

    return existingCustomer.id as string;
  }

  const createResponse = await fetch(`${baseUrl}/customers`, {
    method: "POST",
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(
      buildCustomerPayload({
        name,
        email,
        externalReference,
        cpfCnpj,
        phone,
      }),
    ),
  });

  const createPayload = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok || !createPayload?.id) {
    throw new AsaasApiError(
      getAsaasErrorMessage(createPayload, createResponse.status) || "Nao foi possivel criar o cliente no Asaas.",
      createResponse.status,
      createPayload,
    );
  }

  return createPayload.id as string;
};

const createPayment = async (
  baseUrl: string,
  apiKey: string,
  customerId: string,
  amount: number,
  description: string,
  paymentMethod: PaymentMethod,
) => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const response = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: paymentMethod === "credit_card" ? "CREDIT_CARD" : "PIX",
      value: amount,
      dueDate: dueDate.toISOString().slice(0, 10),
      description,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) {
    throw new AsaasApiError(
      getAsaasErrorMessage(payload, response.status) || "Nao foi possivel criar a cobranca no Asaas.",
      response.status,
      payload,
    );
  }

  return payload;
};

const fetchPixQrCode = async (baseUrl: string, apiKey: string, paymentId: string) => {
  const response = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
    headers: {
      access_token: apiKey,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  return await response.json().catch(() => null);
};

const shouldRetryInFallbackEnv = (error: unknown) =>
  error instanceof AsaasApiError && [401, 403, 404].includes(error.status);

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const deriveEncryptionKey = async () => {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) {
    throw new Error("Chave interna indisponivel para proteger o cadastro pendente.");
  }

  const hash = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
};

const encryptPendingPassword = async (password: string) => {
  const key = await deriveEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(password),
  );

  return {
    iv: toBase64(iv),
    value: toBase64(new Uint8Array(cipher)),
  };
};

const createAsaasCheckout = async ({
  preferredEnv,
  apiKey,
  masterName,
  email,
  externalReference,
  cpfCnpj,
  phone,
  amount,
  description,
  paymentMethod,
}: {
  preferredEnv: AsaasEnvironment;
  apiKey: string;
  masterName: string;
  email: string;
  externalReference: string;
  cpfCnpj: string;
  phone: string;
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
}) => {
  const fallbackEnv: AsaasEnvironment = preferredEnv === "production" ? "sandbox" : "production";
  const candidates: AsaasEnvironment[] = [preferredEnv, fallbackEnv];
  let lastError: unknown = null;

  for (const env of candidates) {
    try {
      const baseUrl = getBaseUrl(env);
      const customerId = await getOrCreateCustomer(baseUrl, apiKey, masterName, email, externalReference, cpfCnpj, phone);
      const payment = await createPayment(baseUrl, apiKey, customerId, amount, description, paymentMethod);
      return {
        env,
        baseUrl,
        customerId,
        payment,
      };
    } catch (error) {
      lastError = error;
      if (env === preferredEnv && shouldRetryInFallbackEnv(error)) {
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Nao foi possivel criar o checkout no Asaas.");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get("Authorization");
    const authClient = authHeader?.startsWith("Bearer ")
      ? createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      : null;

    const body = await req.json();
    const planId = typeof body?.plan_id === "string" ? body.plan_id : "";
    const billingCycle: BillingCycle = body?.billing_cycle === "yearly" ? "yearly" : "monthly";
    const paymentMethod: PaymentMethod = body?.payment_method === "credit_card" ? "credit_card" : "pix";
    const ctName = String(body?.ct_name || "").trim();
    const masterName = String(body?.master_name || "").trim();
    const username = normalizeUsername(String(body?.username || ""));
    const password = String(body?.password || "");
    const email = String(body?.email || "").trim().toLowerCase();
    const cpfCnpj = normalizeDocument(String(body?.cpf_cnpj || ""));
    const phone = normalizePhone(String(body?.phone || ""));

    if (!planId || !ctName || !masterName || !email || !cpfCnpj || !phone) {
      return json({ error: "Preencha nome do CT, nome do mestre, e-mail, CPF/CNPJ, telefone e plano." }, 400);
    }

    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return json({ error: "Para criar esta cobranca e necessario preencher o CPF ou CNPJ do cliente." }, 400);
    }

    if (phone.length < 10 || phone.length > 11) {
      return json({ error: "Para criar esta cobranca e necessario preencher um telefone valido com DDD." }, 400);
    }

    const { data: plan, error: planError } = await adminClient
      .from("billing_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return json({ error: "Plano nao encontrado ou inativo." }, 404);
    }

    const amount = Number(
      billingCycle === "yearly"
        ? Number(plan.price_yearly ?? 0) * 12
        : Number(plan.price_monthly ?? 0)
    );
    if (!amount || amount <= 0) {
      return json({ error: "Este plano nao possui preco configurado para o ciclo selecionado." }, 400);
    }

    const settingsMap = await loadScopedConfigMap(adminClient, "billing_admin", null);

    const asaasApiKey = (settingsMap["asaas_api_key"] || "").trim();
    const asaasEnv = (settingsMap["asaas_env"] || "sandbox").trim() === "production" ? "production" : "sandbox";

    if (!asaasApiKey) {
      return json({ error: "A integracao com o Asaas ainda nao foi configurada pelo admin." }, 400);
    }

    let userId: string | null = null;
    let ctId: string | null = null;
    let accountUsername: string | null = username || null;
    let pendingSignup:
      | {
          username: string;
          password_encrypted: string;
          password_iv: string;
          email: string;
          phone: string;
        }
      | null = null;

    if (authClient) {
      const {
        data: { user },
      } = await authClient.auth.getUser();

      if (user) {
        userId = user.id;
        const { data: profile } = await adminClient.from("profiles").select("ct_id, username").eq("user_id", user.id).maybeSingle();
        ctId = profile?.ct_id || null;
        accountUsername = profile?.username || username || null;
      }
    }

    if (!userId) {
      if (!username || !password) {
        return json({ error: "Escolha nome de usuario e senha para criar a conta do mestre." }, 400);
      }

      if (!USERNAME_REGEX.test(username)) {
        return json({ error: "Escolha um nome de usuario com 3 a 30 caracteres usando letras, numeros, ponto, underline ou hifen." }, 400);
      }

      if (password.length < 8) {
        return json({ error: "A senha deve ter pelo menos 8 caracteres." }, 400);
      }

      // Para criação de novo CT público ainda não existe ct_id,
      // então não podemos recruzar username por CT na fase de checkout.
      // A validação por CT é feita mais tarde no fluxo de provisionamento e pelo índice único no banco.
      const encryptedPassword = await encryptPendingPassword(password);
      pendingSignup = {
        username,
        password_encrypted: encryptedPassword.value,
        password_iv: encryptedPassword.iv,
        email,
        phone,
      };
      accountUsername = username;
    }

    const checkout = await createAsaasCheckout({
      preferredEnv: asaasEnv,
      apiKey: asaasApiKey,
      masterName,
      email,
      externalReference: ctId || accountUsername || email,
      cpfCnpj,
      phone,
      amount,
      description: `${plan.name} - ${billingCycle === "yearly" ? "anual" : "mensal"}`,
      paymentMethod,
    });

    const { env: resolvedEnv, baseUrl, customerId, payment } = checkout;

    let pixPayload: string | null = null;
    let pixQrCode: string | null = null;
    if (paymentMethod === "pix") {
      const pixData = await fetchPixQrCode(baseUrl, asaasApiKey, payment.id);
      pixPayload = pixData?.payload || null;
      pixQrCode = pixData?.encodedImage || null;
    }

    const invoiceUrl = payment.invoiceUrl || null;
    if (paymentMethod === "credit_card" && !invoiceUrl) {
      return json(
        {
          error: "O Asaas criou a cobranca, mas nao retornou um link de checkout para cartao. Verifique se sua conta esta habilitada para cobranca com cartao e se os dados comerciais foram aprovados.",
        },
        400,
      );
    }

    const periodEnd = new Date();
    if (billingCycle === "yearly") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const { data: inserted, error: insertError } = await adminClient
      .from("billing_subscriptions")
      .insert({
        user_id: userId,
        ct_id: ctId,
        plan_id: plan.id,
        status: "pending",
        billing_cycle: billingCycle,
        payment_method: paymentMethod,
        amount,
        expires_at: periodEnd.toISOString(),
        asaas_customer_id: customerId,
        asaas_payment_id: payment.id,
        asaas_invoice_url: payment.invoiceUrl || null,
        asaas_pix_qrcode: pixQrCode,
        asaas_pix_copia_cola: pixPayload,
        customer_name: masterName,
        customer_email: email,
        master_name: masterName,
        ct_name: ctName,
        metadata: {
          source: "public_plans",
          master_username: accountUsername,
          asaas_env: resolvedEnv,
          billing_type: payment.billingType || null,
          customer_document: cpfCnpj,
          customer_phone: phone,
          pending_signup: pendingSignup,
        },
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return json({ error: insertError?.message || "Nao foi possivel registrar a assinatura." }, 500);
    }

    return json({
      success: true,
      subscription_id: inserted.id,
      payment_method: paymentMethod,
      invoice_url: invoiceUrl,
      pix_qrcode: pixQrCode,
      pix_copia_cola: pixPayload,
      amount,
      environment: resolvedEnv,
      username: accountUsername,
    });
  } catch (error) {
    console.error("billing-create-checkout error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro inesperado ao criar checkout." }, 500);
  }
});
