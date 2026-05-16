import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LoginConfig {
  login_banner_url: string;
  login_logo_url: string;
  login_bg_color: string;
  login_card_bg_color: string;
  login_primary_color: string;
  login_text_color: string;
  login_accent_color: string;
  login_title: string;
  login_subtitle: string;
  login_banner_position: string;
  login_banner_height: string;
  login_footer_image_url: string;
  login_footer_height: string;
  login_bg_image_url: string;
  login_logo_size: string;
  login_bg_image_opacity: string;
  login_side_image_url: string;
  login_side_image_opacity: string;
  login_side_image_size: string;
  login_glow_color: string;
  login_input_glow_color: string;
  login_side_image_enabled: string;
}

export const DEFAULT_LOGIN_CONFIG: LoginConfig = {
  login_banner_url: "",
  login_logo_url: "",
  login_bg_color: "#121212",
  login_card_bg_color: "#1a1a1a",
  login_primary_color: "#dc2626",
  login_text_color: "#f2f2f2",
  login_accent_color: "#262626",
  login_title: "BJJ Manager",
  login_subtitle: "Acesse sua conta",
  login_banner_position: "50",
  login_banner_height: "208",
  login_footer_image_url: "",
  login_footer_height: "150",
  login_bg_image_url: "",
  login_logo_size: "64",
  login_bg_image_opacity: "100",
  login_side_image_url: "",
  login_side_image_opacity: "40",
  login_side_image_size: "cover",
  login_glow_color: "#dc262640",
  login_input_glow_color: "#dc2626",
  login_side_image_enabled: "true",
};

const LOGIN_KEYS = Object.keys(DEFAULT_LOGIN_CONFIG) as (keyof LoginConfig)[];

export function normalizeConfigValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed || trimmed === "null" || trimmed === '""') {
      return "";
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed == null) {
        return "";
      }
      return String(parsed);
    } catch {
      return trimmed;
    }
  }

  return String(value);
}

export function useLoginConfig() {
  const [config, setConfig] = useState<LoginConfig>({ ...DEFAULT_LOGIN_CONFIG });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("layout_config")
          .select("config_key, config_value")
          .in("config_key", LOGIN_KEYS);

        if (error) {
          setLoading(false);
          return;
        }

        if (data) {
          const loaded = { ...DEFAULT_LOGIN_CONFIG };
          data.forEach((row: any) => {
            const key = row.config_key as keyof LoginConfig;
            if (key in loaded) {
              loaded[key] = normalizeConfigValue(row.config_value);
            }
          });
          setConfig(loaded);
        }
      } catch {
        // suppress technical details in the frontend
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  return { config, loading };
}
