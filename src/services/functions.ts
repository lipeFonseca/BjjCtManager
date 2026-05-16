import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const formatFunctionPayloadMessage = (payload: any, fallbackMessage: string) => {
  const baseMessage =
    payload?.error ||
    payload?.message ||
    fallbackMessage;
  const requestId = payload?.request_id ? ` [request_id: ${String(payload.request_id)}]` : "";
  const phase = payload?.phase ? ` [phase: ${String(payload.phase)}]` : "";
  return `${String(baseMessage)}${phase}${requestId}`;
};

export const getFunctionsErrorMessage = async (error: unknown, fallbackMessage: string) => {
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
        // ignore
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
          // ignore
        }
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};

export const getRequiredAccessToken = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Sessao expirada ou ausente. Entre novamente para continuar.");
  }

  return session.access_token;
};

export const getAuthHeaders = async () => {
  const accessToken = await getRequiredAccessToken();
  return {
    Authorization: `Bearer ${accessToken}`,
  };
};
