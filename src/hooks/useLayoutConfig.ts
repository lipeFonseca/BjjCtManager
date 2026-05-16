import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SidebarPosition = "left" | "top";
type SidebarSize = "normal" | "compact" | "mini";

interface LayoutConfig {
  sidebar_mestre: string[];
  sidebar_aluno: string[];
  widgets_admin: string[];
  widgets_mestre: string[];
  widgets_aluno: string[];
  sidebar_position: SidebarPosition;
  sidebar_size: SidebarSize;
  sidebar_icon_only: boolean;
  sidebar_image_url: string;
  sidebar_image_size: string;
  sidebar_text: string;
  sidebar_text_size: string;
}

const DEFAULT_CONFIG: LayoutConfig = {
  sidebar_mestre: ["dashboard", "mestres", "alunos", "horarios", "mensagens"],
  sidebar_aluno: ["dashboard", "horarios", "faixa", "mensagens", "pagamentos"],
  widgets_admin: ["centros", "mestres", "alunos", "faixasPretas", "faixaChart"],
  widgets_mestre: ["mestresCT", "alunosCT", "mensagens", "presencasHoje", "attendanceChart", "schedule", "attendanceRanking"],
  widgets_aluno: ["faixaAtual", "presencas", "mensagens", "avaliacoesResumo", "schedule", "attendanceRanking"],
  sidebar_position: "left",
  sidebar_size: "normal",
  sidebar_icon_only: false,
  sidebar_image_url: "",
  sidebar_image_size: "64",
  sidebar_text: "",
  sidebar_text_size: "14",
};

export function useLayoutConfig() {
  const [config, setConfig] = useState<LayoutConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from("layout_config")
          .select("config_key, config_value");
        
        if (error) {
          console.warn("Error fetching layout config:", error);
          return;
        }

        if (data) {
          const loaded = { ...DEFAULT_CONFIG };
          data.forEach((row: any) => {
            if (row.config_key in loaded) {
              const val = row.config_value;
              // Array fields that come as JSON strings from the database
              if (["sidebar_mestre", "sidebar_aluno", "widgets_admin", "widgets_mestre", "widgets_aluno"].includes(row.config_key)) {
                try {
                  if (typeof val === "string") {
                    const parsed = JSON.parse(val);
                    (loaded as any)[row.config_key] = Array.isArray(parsed) ? parsed : (DEFAULT_CONFIG as any)[row.config_key];
                  } else if (Array.isArray(val)) {
                    (loaded as any)[row.config_key] = val;
                  } else {
                    (loaded as any)[row.config_key] = (DEFAULT_CONFIG as any)[row.config_key];
                  }
                } catch (e) {
                  console.warn(`Failed to parse ${row.config_key}:`, e);
                  (loaded as any)[row.config_key] = (DEFAULT_CONFIG as any)[row.config_key];
                }
              } else if (row.config_key === "sidebar_position") {
                loaded.sidebar_position = (typeof val === "string" ? val : "left") as any;
              } else if (row.config_key === "sidebar_size") {
                loaded.sidebar_size = (typeof val === "string" ? val : "normal") as any;
              } else if (row.config_key === "sidebar_icon_only") {
                loaded.sidebar_icon_only = val === true || val === "true";
              } else if (["sidebar_image_url", "sidebar_image_size", "sidebar_text", "sidebar_text_size"].includes(row.config_key)) {
                (loaded as any)[row.config_key] = typeof val === "string" ? val : String(val ?? "");
              } else {
                (loaded as any)[row.config_key] = val;
              }
            }
          });
          setConfig(loaded);
        }
      } catch (error) {
        console.error("Exception fetching layout config:", error);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { config, loading };
}

export type { LayoutConfig, SidebarPosition, SidebarSize };
export { DEFAULT_CONFIG };
