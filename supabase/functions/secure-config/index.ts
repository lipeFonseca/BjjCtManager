import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getPublicConfigDefault,
  loadScopedConfigMap,
  normalizePublicConfigValue,
  scopeConfigs,
  type SecureConfigScope,
} from "../_shared/secure-config.ts";
import { getProfileByUserId } from "../_shared/profiles.ts";
import { getContentHeaders, getOptionsHeaders, isOriginAllowed } from "../_shared/cors.ts";

type Scope = SecureConfigScope;
type Action = "get" | "save";

type DiagnosticContext = {
  requestId: string;
  phase: string;
  userId?: string | null;
  ctId?: string | null;
  role?: string | null;
  details?: Record<string, unknown>;
};

const maskSecret = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";
  if (normalized.length <= 4) return "*".repeat(normalized.length);
  if (normalized.length <= 8) return `${normalized.slice(0, 1)}${"*".repeat(normalized.length - 2)}${normalized.slice(-1)}`;
  return `${normalized.slice(0, 2)}${"*".repeat(Math.min(8, normalized.length - 4))}${normalized.slice(-2)}`;
};

const errorResponse = (requestHeaders: Headers, message: string, status = 400, context?: DiagnosticContext) =>
  new Response(JSON.stringify({
    error: message,
    request_id: context?.requestId,
    phase: context?.phase,
    details: context?.details || {},
  }), {
    status,
    headers: getContentHeaders(requestHeaders),
  });

const jsonResponse = (requestHeaders: Headers, payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: getContentHeaders(requestHeaders),
  });

const safeErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error || "Erro desconhecido");
};

const persistDiagnostic = async (
  adminClient: ReturnType<typeof createClient> | null,
  context: DiagnosticContext,
  error: unknown,
) => {
  if (!adminClient) return;

  try {
    await adminClient.from("edge_function_diagnostics").insert({
      request_id: context.requestId,
      function_name: "secure-config",
      phase: context.phase,
      error_message: safeErrorMessage(error),
      user_id: context.userId || null,
      ct_id: context.ctId || null,
      role: context.role || null,
      details: context.details || {},
    });
  } catch (diagnosticError) {
    console.error("Erro ao persistir diagnostico de secure-config:", diagnosticError);
  }
};

const getCallerContext = async (authHeader: string) => {
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await adminClient.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: roleRows, error: roleError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .order("role");

  if (roleError || !roleRows?.length) {
    throw new Error("Forbidden");
  }

  const roles = roleRows.map((row) => row.role as string);
  const role = roles.includes("admin") ? "admin" : roles.includes("mestre") ? "mestre" : null;

  if (!role) {
    throw new Error("Forbidden");
  }

  let ctId: string | null = null;
  let canManageCtSecureConfig = role === "admin";

  if (role === "mestre") {
    const profileData = await getProfileByUserId(adminClient, user.id, "ct_id");
    ctId = profileData?.ct_id || null;

    if (ctId) {
      const { data: ct, error: ctError } = await adminClient
        .from("centros_treinamento")
        .select("mestre_lider_id")
        .eq("id", ctId)
        .maybeSingle();

      if (ctError) {
        throw ctError;
      }

      canManageCtSecureConfig = ct?.mestre_lider_id === user.id;
    }
  }

  return { adminClient, userId: user.id, role, ctId, canManageCtSecureConfig };
};

const resolveTargetCtId = (
  scope: Scope,
  requestedCtId: string | null | undefined,
  role: string,
  callerCtId: string | null,
  canManageCtSecureConfig: boolean,
) => {
  if (scopeConfigs[scope].scopeType === "global") {
    if (role !== "admin") throw new Error("Forbidden");
    return null;
  }

  if (role === "admin") {
    if (!requestedCtId) throw new Error("CT nao informado");
    return requestedCtId;
  }

  if (role !== "mestre" || !callerCtId || !canManageCtSecureConfig) {
    throw new Error("Forbidden");
  }

  return callerCtId;
};

const loadConfigState = async (
  adminClient: ReturnType<typeof createClient>,
  scope: Scope,
  targetCtId: string | null,
) => {
  const scopeConfig = scopeConfigs[scope];
  let query = adminClient
    .from(scopeConfig.table)
    .select(`id, ${scopeConfig.keyColumn}, ${scopeConfig.valueColumn}, updated_at`)
    .order("updated_at", { ascending: false });

  if (scopeConfig.scopeType === "ct") {
    query = query.eq("ct_id", targetCtId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const latestByKey = new Map<string, { id: string; value: string }>();
  const duplicateIds: string[] = [];

  for (const row of data || []) {
    const rowKey = row[scopeConfig.keyColumn];
    const rowValue = row[scopeConfig.valueColumn];

    if (!latestByKey.has(rowKey)) {
      latestByKey.set(rowKey, { id: row.id, value: rowValue || "" });
    } else {
      duplicateIds.push(row.id);
    }
  }

  if (duplicateIds.length > 0) {
    const { error: deleteError } = await adminClient.from(scopeConfig.table).delete().in("id", duplicateIds);
    if (deleteError) {
      console.error(`Erro ao limpar duplicatas de ${scopeConfig.table}:`, deleteError);
    }
  }

  const values: Record<string, string> = {};
  const secrets: Record<string, { configured: boolean; maskedValue: string }> = {};
  const mergedConfig = await loadScopedConfigMap(adminClient, scope, targetCtId);

  for (const key of scopeConfig.publicKeys) {
    values[key] = normalizePublicConfigValue(
      scope,
      key,
      mergedConfig[key] || getPublicConfigDefault(scope, key),
    );
  }

  for (const key of scopeConfig.secretKeys) {
    const value = mergedConfig[key] || "";
    secrets[key] = {
      configured: value.trim().length > 0,
      maskedValue: maskSecret(value),
    };
  }

  return { latestByKey, values, secrets };
};

const persistValues = async (
  adminClient: ReturnType<typeof createClient>,
  scope: Scope,
  targetCtId: string | null,
  userId: string,
  values: Record<string, unknown>,
) => {
  const scopeConfig = scopeConfigs[scope];
  const allowedKeys = new Set([...scopeConfig.publicKeys, ...scopeConfig.secretKeys]);
  const secretKeys = new Set(scopeConfig.secretKeys);
  const { latestByKey } = await loadConfigState(adminClient, scope, targetCtId);

  for (const [key, rawValue] of Object.entries(values)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Chave de configuracao nao permitida: ${key}`);
    }

    const baseValue = typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "").trim();
    const normalizedValue = secretKeys.has(key)
      ? baseValue
      : normalizePublicConfigValue(scope, key, baseValue || getPublicConfigDefault(scope, key));

    if (secretKeys.has(key) && !normalizedValue) {
      continue;
    }

    const existing = latestByKey.get(key);
    const payload = {
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    let resultError: { message?: string } | null = null;

    if (secretKeys.has(key)) {
      const { error } = await adminClient
        .from("secure_config_entries")
        .upsert({
          scope,
          config_key: key,
          ct_id: targetCtId,
          secret_value: normalizedValue,
          ...payload,
        }, {
          onConflict: "scope,config_key,ct_scope",
        });
      resultError = error;
    } else if (existing?.id) {
      const { error } = await adminClient
        .from(scopeConfig.table)
        .update({
          [scopeConfig.valueColumn]: normalizedValue,
          ...payload,
        })
        .eq("id", existing.id);
      resultError = error;
    } else if (scopeConfig.scopeType === "ct") {
      const { error } = await adminClient
        .from(scopeConfig.table)
        .insert({ ct_id: targetCtId, [scopeConfig.keyColumn]: key, [scopeConfig.valueColumn]: normalizedValue, ...payload });
      resultError = error;
    } else {
      const { error } = await adminClient
        .from(scopeConfig.table)
        .insert({ [scopeConfig.keyColumn]: key, [scopeConfig.valueColumn]: normalizedValue, ...payload });
      resultError = error;
    }

    if (resultError) {
      throw new Error(resultError.message || `Erro ao salvar ${key}`);
    }
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getOptionsHeaders(req.headers) });
  }

  const requestId = crypto.randomUUID();
  let phase = "boot";
  let adminClient: ReturnType<typeof createClient> | null = null;
  let userId: string | null = null;
  let role: string | null = null;
  let targetCtId: string | null = null;
  let details: Record<string, unknown> = {};

  try {
    if (req.headers.get("origin") && !isOriginAllowed(req.headers)) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: getContentHeaders(req.headers),
      });
    }

    phase = "auth_header";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(req.headers, "Unauthorized", 401, {
        requestId,
        phase,
        details: { has_authorization_header: Boolean(authHeader) },
      });
    }

    phase = "parse_body";
    const body = await req.json().catch(() => ({}));
    const action = body.action as Action | undefined;
    const scope = body.scope as Scope | undefined;

    if (!action || !scope || !(scope in scopeConfigs)) {
      return errorResponse(req.headers, "Requisicao invalida", 400, {
        requestId,
        phase,
        details: { action: action || null, scope: scope || null },
      });
    }

    details = {
      action,
      scope,
      requested_ct_id: body.ct_id || null,
      value_keys: Object.keys(body.values || {}),
    };

    phase = "caller_context";
    const callerContext = await getCallerContext(authHeader);
    adminClient = callerContext.adminClient;
    userId = callerContext.userId;
    role = callerContext.role;
    const ctId = callerContext.ctId;
    const canManageCtSecureConfig = callerContext.canManageCtSecureConfig;

    if (role !== "admin" && role !== "mestre") {
      return errorResponse(req.headers, "Forbidden", 403, {
        requestId,
        phase,
        userId,
        role,
        details,
      });
    }

    phase = "resolve_ct";
    targetCtId = resolveTargetCtId(scope, body.ct_id, role, ctId, canManageCtSecureConfig);

    if (action === "save") {
      phase = "persist_values";
      await persistValues(adminClient, scope, targetCtId, userId, body.values || {});
    }

    phase = "load_state";
    const state = await loadConfigState(adminClient, scope, targetCtId);
    return jsonResponse(req.headers, {
      success: true,
      request_id: requestId,
      ct_id: targetCtId,
      values: state.values,
      secrets: state.secrets,
    });
  } catch (error) {
    const message = safeErrorMessage(error);
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    const context: DiagnosticContext = {
      requestId,
      phase,
      userId,
      ctId: targetCtId,
      role,
      details,
    };
    await persistDiagnostic(adminClient, context, error);
    return errorResponse(req.headers, message, status, context);
  }
});
