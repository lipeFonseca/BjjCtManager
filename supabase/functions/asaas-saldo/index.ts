import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadScopedConfigMap } from "../_shared/secure-config.ts";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getProfileByUserId } from "../_shared/profiles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URLS = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://api-sandbox.asaas.com/v3",
} as const;

const getErrorMessage = (payload: any, status: number) => {
  const description = payload?.errors?.[0]?.description;
  if (description) return description;
  if (status === 401) return "A chave de API do Asaas é inválida ou pertence a outro ambiente.";
  if (status === 403) return "A chave de API do Asaas não tem permissão para esta operação.";
  return `Erro ${status} ao consultar o Asaas`;
};

const fetchBalance = async (apiKey: string, env: "production" | "sandbox") => {
  const response = await fetch(`${ASAAS_BASE_URLS[env]}/finance/balance`, {
    method: "GET",
    headers: {
      access_token: apiKey,
      accept: "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data,
    environment: env,
    errorMessage: getErrorMessage(data, response.status),
  };
};

const getStoredAsaasConfig = async (
  adminClient: ReturnType<typeof createClient>,
  role: string,
  userId: string,
  requestedCtId?: string | null,
) => {
  if (role === "admin") {
    if (requestedCtId) {
      const configMap = await loadScopedConfigMap(adminClient, "payment", requestedCtId);

      return {
        apiKey: (configMap["asaas_api_key"] || "").trim(),
        env: configMap["asaas_env"] === "production" ? "production" : "sandbox",
      } as const;
    }

    const settingsMap = await loadScopedConfigMap(adminClient, "billing_admin", null);

    return {
      apiKey: (settingsMap["asaas_api_key"] || "").trim(),
      env: settingsMap["asaas_env"] === "production" ? "production" : "sandbox",
    } as const;
  }

  const profileData = await getProfileByUserId(adminClient, userId, "ct_id");

  const effectiveCtId = profileData?.ct_id || requestedCtId;
  if (!effectiveCtId) {
    throw new Error("CT nao informado");
  }

  const configMap = await loadScopedConfigMap(adminClient, "payment", effectiveCtId);

  return {
    apiKey: (configMap["asaas_api_key"] || "").trim(),
    env: configMap["asaas_env"] === "production" ? "production" : "sandbox",
  } as const;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roles = await getUserRoles(supabaseAdmin, user.id);
    const highestRole = getHighestRole(roles);

    if (highestRole !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { api_key, env, ct_id } = await req.json();
    const providedApiKey = typeof api_key === "string" ? api_key.trim() : "";
    const storedConfig = await getStoredAsaasConfig(supabaseAdmin, highestRole, user.id, ct_id);
    const apiKey = providedApiKey || storedConfig.apiKey;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key não informada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const preferredEnv: "production" | "sandbox" =
      env === "production" || env === "sandbox"
        ? env
        : storedConfig.env;
    const fallbackEnv: "production" | "sandbox" = preferredEnv === "production" ? "sandbox" : "production";

    const firstAttempt = await fetchBalance(apiKey, preferredEnv);
    if (firstAttempt.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          balance: Number(firstAttempt.data?.balance ?? 0),
          totalBalance: Number(firstAttempt.data?.totalBalance ?? firstAttempt.data?.balance ?? 0),
          environment: firstAttempt.environment,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shouldTryFallback = firstAttempt.status === 401 || firstAttempt.status === 404 || firstAttempt.status === 403;
    if (shouldTryFallback) {
      const secondAttempt = await fetchBalance(apiKey, fallbackEnv);
      if (secondAttempt.ok) {
        return new Response(
          JSON.stringify({
            success: true,
            balance: Number(secondAttempt.data?.balance ?? 0),
            totalBalance: Number(secondAttempt.data?.totalBalance ?? secondAttempt.data?.balance ?? 0),
            environment: secondAttempt.environment,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: firstAttempt.errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
