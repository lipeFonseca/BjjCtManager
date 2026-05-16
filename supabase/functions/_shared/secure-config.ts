import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SecureConfigScope = "payment" | "messaging" | "billing_admin";

type ScopeConfig = {
  table: string;
  scopeType: "ct" | "global";
  keyColumn: string;
  valueColumn: string;
  publicKeys: string[];
  secretKeys: string[];
};

const NULL_UUID = "00000000-0000-0000-0000-000000000000";

export const scopeConfigs: Record<SecureConfigScope, ScopeConfig> = {
  payment: {
    table: "config_pagamento",
    scopeType: "ct",
    keyColumn: "config_key",
    valueColumn: "config_value",
    publicKeys: [
      "recebimento_modo",
      "pix_tipo",
      "pix_chave",
      "pix_beneficiario",
      "pix_banco_nome",
      "template_titulo",
      "template_mensagem",
    ],
    secretKeys: [],
  },
  messaging: {
    table: "webhook_config",
    scopeType: "ct",
    keyColumn: "config_key",
    valueColumn: "config_value",
    publicKeys: [
      "gmail_email",
      "gmail_from_name",
      "gmail_format",
      "whatsapp_send_mode",
      "uazapi_base_url",
      "uazapi_instance_name",
      "telegram_chat_id",
      "mensageria_auto_notice_enabled",
      "mensageria_auto_notice_message",
    ],
    secretKeys: ["gmail_app_password", "uazapi_instance_apikey", "telegram_bot_token"],
  },
  billing_admin: {
    table: "billing_settings",
    scopeType: "global",
    keyColumn: "setting_key",
    valueColumn: "setting_value",
    publicKeys: ["asaas_env"],
    secretKeys: ["asaas_api_key", "asaas_webhook_token"],
  },
};

const publicConfigDefaults: Partial<Record<SecureConfigScope, Record<string, string>>> = {
  messaging: {
    gmail_format: "html",
    whatsapp_send_mode: "wa_me",
    mensageria_auto_notice_enabled: "true",
  },
  payment: {
    recebimento_modo: "pix_manual",
  },
  billing_admin: {
    asaas_env: "sandbox",
  },
};

export const normalizePublicConfigValue = (
  scope: SecureConfigScope,
  key: string,
  value: string,
) => {
  const normalized = String(value || "").trim();

  if (scope === "messaging") {
    if (key === "gmail_format") {
      return normalized === "text" || normalized === "html" ? normalized : "html";
    }

    if (key === "whatsapp_send_mode") {
      return normalized === "wa_me" || normalized === "uazapi" ? normalized : "wa_me";
    }

    if (key === "mensageria_auto_notice_enabled") {
      return normalized === "true" || normalized === "false" ? normalized : "true";
    }
  }

  if (scope === "billing_admin" && key === "asaas_env") {
    return normalized === "production" || normalized === "sandbox" ? normalized : "sandbox";
  }

  return normalized;
};

export const getPublicConfigDefault = (
  scope: SecureConfigScope,
  key: string,
) => publicConfigDefaults[scope]?.[key] || "";

type LatestValueRow = {
  id: string;
  value: string;
};

const cleanupDuplicateRows = async (
  adminClient: ReturnType<typeof createClient>,
  table: string,
  ids: string[],
) => {
  if (!ids.length) return;

  const { error } = await adminClient.from(table).delete().in("id", ids);
  if (error) {
    console.error(`Erro ao limpar duplicatas de ${table}:`, error);
  }
};

const loadLatestPublicRows = async (
  adminClient: ReturnType<typeof createClient>,
  scope: SecureConfigScope,
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

  const latestByKey = new Map<string, LatestValueRow>();
  const duplicateIds: string[] = [];

  for (const row of data || []) {
    const key = String(row[scopeConfig.keyColumn] || "");
    const value = String(row[scopeConfig.valueColumn] || "");

    if (!latestByKey.has(key)) {
      latestByKey.set(key, { id: String(row.id), value });
    } else {
      duplicateIds.push(String(row.id));
    }
  }

  await cleanupDuplicateRows(adminClient, scopeConfig.table, duplicateIds);
  return latestByKey;
};

const loadLatestSecretRows = async (
  adminClient: ReturnType<typeof createClient>,
  scope: SecureConfigScope,
  targetCtId: string | null,
) => {
  let query = adminClient
    .from("secure_config_entries")
    .select("id, config_key, secret_value, updated_at")
    .eq("scope", scope)
    .order("updated_at", { ascending: false });

  query = targetCtId ? query.eq("ct_id", targetCtId) : query.is("ct_id", null);

  const { data, error } = await query;
  if (error) throw error;

  const latestByKey = new Map<string, LatestValueRow>();
  const duplicateIds: string[] = [];

  for (const row of data || []) {
    const key = String(row.config_key || "");
    const value = String(row.secret_value || "");

    if (!latestByKey.has(key)) {
      latestByKey.set(key, { id: String(row.id), value });
    } else {
      duplicateIds.push(String(row.id));
    }
  }

  await cleanupDuplicateRows(adminClient, "secure_config_entries", duplicateIds);
  return latestByKey;
};

export const loadScopedConfigMap = async (
  adminClient: ReturnType<typeof createClient>,
  scope: SecureConfigScope,
  targetCtId: string | null,
) => {
  const scopeConfig = scopeConfigs[scope];
  const [publicRows, secretRows] = await Promise.all([
    loadLatestPublicRows(adminClient, scope, targetCtId),
    loadLatestSecretRows(adminClient, scope, targetCtId),
  ]);

  const values: Record<string, string> = {};

  for (const key of scopeConfig.publicKeys) {
    const rawValue = publicRows.get(key)?.value || "";
    values[key] = rawValue || getPublicConfigDefault(scope, key);
  }

  for (const key of scopeConfig.secretKeys) {
    values[key] = secretRows.get(key)?.value || "";
  }

  return values;
};

export const loadScopedSecret = async (
  adminClient: ReturnType<typeof createClient>,
  scope: SecureConfigScope,
  configKey: string,
  targetCtId: string | null,
) => {
  const { data, error } = await adminClient
    .from("secure_config_entries")
    .select("secret_value")
    .eq("scope", scope)
    .eq("config_key", configKey)
    .eq("ct_scope", targetCtId || NULL_UUID)
    .limit(1);

  if (error) throw error;

  return String(data?.[0]?.secret_value || "").trim();
};
