import { supabase } from "@/integrations/supabase/client";
import { getAuthHeaders } from "@/services/functions";

export type AsaasEnvironment = "sandbox" | "production";
export type CheckoutPaymentMethod = "pix" | "credit_card";
export type CheckoutBillingCycle = "monthly" | "yearly";

const getFunctionsErrorMessage = async (error: unknown, fallbackMessage: string) => {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        if (payload?.error) {
          return String(payload.error);
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

export const testAsaasConnection = async (params: {
  apiKey?: string;
  environment?: AsaasEnvironment;
  ctId?: string;
}) => {
  const headers = await getAuthHeaders();
  const { data, error } = await supabase.functions.invoke("test-asaas", {
    headers,
    body: {
      api_key: params.apiKey,
      env: params.environment,
      ct_id: params.ctId,
    },
  });

  if (error) {
    throw new Error(await getFunctionsErrorMessage(error, "Falha ao testar a integracao com o Asaas."));
  }

  return data as {
    success?: boolean;
    balance?: number;
    environment?: AsaasEnvironment;
    error?: string;
  };
};

export const createBillingCheckout = async (payload: {
  planId: string;
  ctName: string;
  masterName: string;
  username: string;
  password: string;
  email: string;
  cpfCnpj: string;
  phone: string;
  billingCycle: CheckoutBillingCycle;
  paymentMethod: CheckoutPaymentMethod;
}) => {
  const { data, error } = await supabase.functions.invoke("billing-create-checkout", {
    body: {
      plan_id: payload.planId,
      ct_name: payload.ctName,
      master_name: payload.masterName,
      username: payload.username,
      password: payload.password,
      email: payload.email,
      cpf_cnpj: payload.cpfCnpj,
      phone: payload.phone,
      billing_cycle: payload.billingCycle,
      payment_method: payload.paymentMethod,
    },
  });

  if (error) {
    throw new Error(await getFunctionsErrorMessage(error, "Falha ao comunicar com o checkout."));
  }

  if (!data?.success) {
    throw new Error(data?.error || "Nao foi possivel criar o checkout.");
  }

  return data as {
    success: true;
    subscription_id: string;
    payment_method: CheckoutPaymentMethod;
    invoice_url: string | null;
    pix_qrcode: string | null;
    pix_copia_cola: string | null;
    amount: number;
    environment: AsaasEnvironment;
    username?: string | null;
  };
};
