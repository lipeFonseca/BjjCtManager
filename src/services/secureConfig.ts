import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAuthHeaders } from "@/services/functions";

export type SecureConfigScope = "payment" | "messaging" | "billing_admin";

export type SecureConfigSecrets = Record<string, { configured: boolean; maskedValue: string }>;

type SecureConfigResponse = {
  success?: boolean;
  request_id?: string;
  ct_id?: string | null;
  values?: Record<string, string>;
  secrets?: SecureConfigSecrets;
  error?: string;
};

const formatFunctionPayloadMessage = (payload: any, fallbackMessage: string) => {
  const baseMessage =
    payload?.error ||
    payload?.message ||
    fallbackMessage;
  const requestId = payload?.request_id ? ` [request_id: ${String(payload.request_id)}]` : "";
  const phase = payload?.phase ? ` [phase: ${String(payload.phase)}]` : "";
  return `${String(baseMessage)}${phase}${requestId}`;
};

const isMissingSecureConfigFunctionError = (message: string) => {
  const normalized = message.toLowerCase();
  const mentionsMissingFunction =
    normalized.includes("secure-config") ||
    normalized.includes("not found") ||
    normalized.includes("404");

  return mentionsMissingFunction;
};

const getMissingSecureConfigDeploymentMessage = (_scope: SecureConfigScope) => {
  return "As chaves secretas da mensageria e do financeiro exigem a edge function `secure-config` publicada e atualizada com as migrations de seguranca. Os campos publicos podem ser exibidos, mas os segredos nao sao salvos fora dela.";
};

const getFunctionsErrorMessage = async (error: unknown, fallbackMessage: string) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      if (payload?.error || payload?.message) {
        return formatFunctionPayloadMessage(payload, fallbackMessage);
      }
    } catch {
      try {
        const text = await error.context.text();
        if (text) {
          return text;
        }
      } catch {
        // Ignore parsing errors and continue with generic handling below.
      }
    }
  }

  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        if (payload?.error || payload?.message) {
          return formatFunctionPayloadMessage(payload, fallbackMessage);
        }
      } catch {
        try {
          const text = await context.clone().text();
          if (text) {
            return text;
          }
        } catch {
          // Ignore parsing errors and use fallback below.
        }
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};

export const getSecureConfig = async (scope: SecureConfigScope, ctId?: string | null) => {
  const headers = await getAuthHeaders();
  const { data, error } = await supabase.functions.invoke("secure-config", {
    headers,
    body: {
      action: "get",
      scope,
      ct_id: ctId || null,
    },
  });

  if (error) {
    const message = await getFunctionsErrorMessage(error, "Falha ao carregar a configuracao segura.");
    if (isMissingSecureConfigFunctionError(message)) {
      throw new Error(getMissingSecureConfigDeploymentMessage(scope));
    }
    throw new Error(message);
  }

  const payload = (data || {}) as SecureConfigResponse;
  if (!payload.success) {
    throw new Error(payload.error || "Falha ao carregar a configuracao segura.");
  }

  return {
    ctId: payload.ct_id || null,
    values: payload.values || {},
    secrets: payload.secrets || {},
  };
};

export const saveSecureConfig = async (
  scope: SecureConfigScope,
  values: Record<string, string>,
  ctId?: string | null,
) => {
  const headers = await getAuthHeaders();
  const { data, error } = await supabase.functions.invoke("secure-config", {
    headers,
    body: {
      action: "save",
      scope,
      ct_id: ctId || null,
      values,
    },
  });

  if (error) {
    const message = await getFunctionsErrorMessage(error, "Falha ao salvar a configuracao segura.");
    if (isMissingSecureConfigFunctionError(message)) {
      throw new Error(getMissingSecureConfigDeploymentMessage(scope));
    }
    throw new Error(message);
  }

  const payload = (data || {}) as SecureConfigResponse;
  if (!payload.success) {
    throw new Error(payload.error || "Falha ao salvar a configuracao segura.");
  }

  return {
    ctId: payload.ct_id || null,
    values: payload.values || {},
    secrets: payload.secrets || {},
  };
};
