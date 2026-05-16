import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeConfigValue } from "@/hooks/useLoginConfig";

export interface CheckoutPageConfig {
  checkout_page_badge_text: string;
  checkout_page_title: string;
  checkout_page_subtitle: string;
  checkout_page_security_badge: string;
  checkout_page_pix_title: string;
  checkout_page_pix_description: string;
  checkout_page_pix_hint: string;
  checkout_page_card_title: string;
  checkout_page_card_description: string;
  checkout_page_support_text: string;
  checkout_page_copy_button_label: string;
  checkout_page_invoice_button_label: string;
  checkout_page_login_button_label: string;
  checkout_page_close_button_label: string;
  checkout_page_artwork_url: string;
}

export const DEFAULT_CHECKOUT_PAGE_CONFIG: CheckoutPageConfig = {
  checkout_page_badge_text: "Checkout seguro",
  checkout_page_title: "Finalize sua assinatura com seguranca",
  checkout_page_subtitle: "O pagamento e processado em ambiente seguro. Assim que a cobranca for confirmada, sua assinatura podera ser ativada automaticamente.",
  checkout_page_security_badge: "Ambiente protegido via Asaas",
  checkout_page_pix_title: "Pague com PIX em segundos",
  checkout_page_pix_description: "Escaneie o QR Code no app do banco ou copie o codigo PIX para concluir agora.",
  checkout_page_pix_hint: "Se preferir, abra a pagina de pagamento para continuar em outra tela.",
  checkout_page_card_title: "Finalize com cartao no checkout do Asaas",
  checkout_page_card_description: "Os dados do cartao nao passam pelo frontend do BJJ Manager. A conclusao acontece no ambiente seguro do provedor.",
  checkout_page_support_text: "Se o pagamento nao aparecer de imediato, mantenha esta tela aberta ou volte ao login depois de concluir.",
  checkout_page_copy_button_label: "Copiar codigo PIX",
  checkout_page_invoice_button_label: "Abrir pagina de pagamento",
  checkout_page_login_button_label: "Ir para o login",
  checkout_page_close_button_label: "Fechar",
  checkout_page_artwork_url: "",
};

const CHECKOUT_KEYS = Object.keys(DEFAULT_CHECKOUT_PAGE_CONFIG) as (keyof CheckoutPageConfig)[];

const normalizeCheckoutConfigValue = (value: unknown) => {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed || trimmed === "null" || trimmed === '""') {
      return "";
    }

    return trimmed;
  }

  return normalizeConfigValue(value);
};

export function useCheckoutPageConfig() {
  const [config, setConfig] = useState<CheckoutPageConfig>(DEFAULT_CHECKOUT_PAGE_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from("layout_config")
        .select("config_key, config_value")
        .in("config_key", CHECKOUT_KEYS as string[]);

      if (!mounted) {
        return;
      }

      if (error) {
        setConfig(DEFAULT_CHECKOUT_PAGE_CONFIG);
        setLoading(false);
        return;
      }

      const nextConfig = { ...DEFAULT_CHECKOUT_PAGE_CONFIG };

      (data || []).forEach((row) => {
        const key = row.config_key as keyof CheckoutPageConfig;
        if (key in nextConfig) {
          nextConfig[key] = normalizeCheckoutConfigValue(row.config_value);
        }
      });

      setConfig(nextConfig);
      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return { config, loading };
}
