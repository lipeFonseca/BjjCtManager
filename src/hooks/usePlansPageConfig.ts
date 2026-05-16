import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeConfigValue } from "@/hooks/useLoginConfig";

export interface TrustItem {
  label: string;
  enabled: boolean;
}

export interface ReviewItem {
  name: string;
  role: string;
  text: string;
  image_url: string;
  enabled: boolean;
}

export interface FeatureCarouselItem {
  title: string;
  description: string;
  image_url: string;
  enabled: boolean;
}

export interface ComparisonColumn {
  title: string;
  items: string[];
  enabled: boolean;
}

export interface ProblemColumn {
  title: string;
  items: string[];
  enabled: boolean;
}

export interface PlansPageConfig {
  plans_page_title: string;
  plans_page_subtitle: string;
  plans_page_motivational_text: string;
  plans_page_header_image_url: string;
  plans_page_footer_image_url: string;
  plans_page_show_popup: string;
  plans_page_popup_interval_ms: string;
  plans_page_popup_names: string;
  plans_page_trust_items: string;
  plans_page_feature_carousel_enabled: string;
  plans_page_feature_carousel_items: string;
  plans_page_comparison_enabled: string;
  plans_page_comparison_eyebrow: string;
  plans_page_comparison_intro: string;
  plans_page_comparison_title: string;
  plans_page_comparison_footer: string;
  plans_page_comparison_columns: string;
  plans_page_problems_enabled: string;
  plans_page_problems_title: string;
  plans_page_problems_left_label: string;
  plans_page_problems_right_label: string;
  plans_page_problems_pre_cta_text: string;
  plans_page_problems_cta_enabled: string;
  plans_page_problems_cta_text: string;
  plans_page_problems_columns: string;
  plans_page_reviews_enabled: string;
  plans_page_reviews: string;
}

export const DEFAULT_PLANS_PAGE_CONFIG: PlansPageConfig = {
  plans_page_title: "Escolha o plano ideal para o seu CT",
  plans_page_subtitle: "Gestao operacional, cobranca, comunicacao e crescimento do seu centro em uma estrutura pronta para SaaS.",
  plans_page_motivational_text: "Cada faixa exige disciplina. Cada academia exige estrutura. O BJJ Manager entrega as duas coisas.",
  plans_page_header_image_url: "",
  plans_page_footer_image_url: "",
  plans_page_show_popup: "true",
  plans_page_popup_interval_ms: "10000",
  plans_page_popup_names: "Ana | Recife\nCarlos | Sao Paulo\nJuliana | Fortaleza\nMestre Bruno | Belo Horizonte\nFernanda | Curitiba",
  plans_page_trust_items: JSON.stringify([
    { label: "Pagamento seguro via Asaas", enabled: true },
    { label: "Suporte humano e onboarding guiado", enabled: true },
    { label: "Gestao pronta para escalar o seu CT", enabled: true },
    { label: "Ativacao rapida sem mudar sua rotina", enabled: true },
  ]),
  plans_page_feature_carousel_enabled: "true",
  plans_page_feature_carousel_items: JSON.stringify([
    {
      title: "Operacao e Retencao",
      description: "Organize aulas, acompanhe alunos e reduza a dependencia de controles soltos no dia a dia.",
      image_url: "",
      enabled: true,
    },
    {
      title: "Processos Internos",
      description: "Instrutores, contratos e servicos centralizados em um fluxo mais limpo e previsivel.",
      image_url: "",
      enabled: true,
    },
    {
      title: "Insights e Analytics",
      description: "Decisoes com base em dados reais sobre presenca, financeiro e crescimento do CT.",
      image_url: "",
      enabled: true,
    },
  ]),
  plans_page_comparison_enabled: "true",
  plans_page_comparison_eyebrow: "Quem vive o tatame sabe:",
  plans_page_comparison_intro: "Nao da pra gerenciar Jiu-Jitsu como se fosse musculacao.",
  plans_page_comparison_title: "Por que academias de Jiu-Jitsu escolhem o BJJ Manager?",
  plans_page_comparison_footer: "O BJJ Manager entende a hierarquia, o tempo de faixa e a historia de cada aluno no tatame.",
  plans_page_comparison_columns: JSON.stringify([
    {
      title: "Sistemas genericos",
      items: [
        "Pensado para academias fitness",
        "Fluxos engessados",
        "Sem visao do aluno",
        "Apenas financeiro",
        "Suporte generico",
      ],
      enabled: true,
    },
    {
      title: "BJJ Manager",
      items: [
        "Criado para Jiu-Jitsu",
        "Controle de faixa e graduacao",
        "Historico completo no tatame",
        "Gestao + experiencia do aluno",
        "Time que entende o tatame",
      ],
      enabled: true,
    },
    {
      title: "Gestao manual",
      items: [
        "Caos total",
        "Anotacoes soltas",
        "Tudo na memoria",
        "Retrabalho constante",
        "Voce sozinho",
      ],
      enabled: true,
    },
  ]),
  plans_page_problems_enabled: "true",
  plans_page_problems_title: "Voce tem esses problemas em sua academia de Artes Marciais?",
  plans_page_problems_left_label: "Isso acontece em sua academia?",
  plans_page_problems_right_label: "Voce sofre com:",
  plans_page_problems_pre_cta_text: "Se voce disse sim para qualquer um desses pontos, existe um jeito mais inteligente de operar o seu CT.",
  plans_page_problems_cta_enabled: "true",
  plans_page_problems_cta_text: "Ver planos e encontrar a melhor opcao",
  plans_page_problems_columns: JSON.stringify([
    {
      title: "Operacao",
      items: [
        "Processos desorganizados e dependentes de voce",
        "Informacoes espalhadas entre WhatsApp, planilhas e anotacoes",
        "Falta de indicadores claros para acompanhar crescimento",
        "Inadimplencia que so aparece quando ja virou problema",
        "Gestao reativa, sempre apagando incendios",
        "Alunos que somem aos poucos e um dia simplesmente nao voltam",
      ],
      enabled: true,
    },
    {
      title: "Impacto pessoal",
      items: [
        "Sobrecarga de trabalho e jornadas longas todos os dias",
        "Falta de tempo para treinar, ensinar e estar presente no tatame",
        "Dificuldade em se ausentar ou tirar ferias sem culpa",
        "Estresse constante por nao saber exatamente como esta a empresa",
        "Sensacao de que a academia cresce, mas voce nao ganha liberdade",
        "Perda de alunos por falta de acompanhamento, engajamento e relacao continua",
      ],
      enabled: true,
    },
  ]),
  plans_page_reviews_enabled: "true",
  plans_page_reviews: JSON.stringify([
    {
      name: "Rafael Costa",
      role: "Mestre - Recife",
      text: "A plataforma trouxe organizacao, clareza e profissionalismo para a nossa rotina.",
      image_url: "",
      enabled: true,
    },
    {
      name: "Amanda Souza",
      role: "Gestora - Sao Paulo",
      text: "Conseguimos centralizar comunicacao, operacao e crescimento em um unico lugar.",
      image_url: "",
      enabled: true,
    },
    {
      name: "Bruno Almeida",
      role: "Professor - Fortaleza",
      text: "O visual passa confianca e o sistema economiza um tempo enorme do time.",
      image_url: "",
      enabled: true,
    },
  ]),
};

const PLANS_KEYS = Object.keys(DEFAULT_PLANS_PAGE_CONFIG) as (keyof PlansPageConfig)[];

const normalizePlansConfigValue = (value: unknown) => {
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

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return normalizeConfigValue(value);
};

export const parseTrustItems = (value: string): TrustItem[] => {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          label: String(item?.label || "").trim(),
          enabled: item?.enabled !== false,
        }))
        .filter((item) => item.label);
    }
  } catch {
    // ignore
  }
  return [];
};

export const parseReviewItems = (value: string): ReviewItem[] => {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        name: String(item?.name || "").trim(),
        role: String(item?.role || "").trim(),
        text: String(item?.text || "").trim(),
        image_url: String(item?.image_url || "").trim(),
        enabled: item?.enabled !== false,
      })).filter((item) => item.name || item.text);
    }
  } catch {
    // ignore
  }
  return [];
};

export const parseFeatureCarouselItems = (value: string): FeatureCarouselItem[] => {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        title: String(item?.title || "").trim(),
        description: String(item?.description || "").trim(),
        image_url: String(item?.image_url || "").trim(),
        enabled: item?.enabled !== false,
      })).filter((item) => item.title || item.description || item.image_url);
    }
  } catch {
    // ignore
  }
  return [];
};

export const parseComparisonColumns = (value: string): ComparisonColumn[] => {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          title: String(item?.title || "").trim(),
          items: Array.isArray(item?.items)
            ? item.items.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
            : [],
          enabled: item?.enabled !== false,
        }))
        .filter((item) => item.title || item.items.length > 0);
    }
  } catch {
    // ignore
  }
  return [];
};

export const parseProblemColumns = (value: string): ProblemColumn[] => {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          title: String(item?.title || "").trim(),
          items: Array.isArray(item?.items)
            ? item.items.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
            : [],
          enabled: item?.enabled !== false,
        }))
        .filter((item) => item.title || item.items.length > 0);
    }
  } catch {
    // ignore
  }
  return [];
};

export const parsePopupNames = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export const getSafeTrustItems = (value: string) => {
  const parsed = parseTrustItems(value);
  return parsed.length > 0 ? parsed : parseTrustItems(DEFAULT_PLANS_PAGE_CONFIG.plans_page_trust_items);
};

export const getSafeReviewItems = (value: string) => {
  const parsed = parseReviewItems(value);
  return parsed.length > 0 ? parsed : parseReviewItems(DEFAULT_PLANS_PAGE_CONFIG.plans_page_reviews);
};

export const getSafeFeatureCarouselItems = (value: string) => {
  const parsed = parseFeatureCarouselItems(value);
  return parsed.length > 0 ? parsed : parseFeatureCarouselItems(DEFAULT_PLANS_PAGE_CONFIG.plans_page_feature_carousel_items);
};

export const getSafeComparisonColumns = (value: string) => {
  const parsed = parseComparisonColumns(value);
  return parsed.length > 0 ? parsed : parseComparisonColumns(DEFAULT_PLANS_PAGE_CONFIG.plans_page_comparison_columns);
};

export const getSafeProblemColumns = (value: string) => {
  const parsed = parseProblemColumns(value);
  return parsed.length > 0 ? parsed : parseProblemColumns(DEFAULT_PLANS_PAGE_CONFIG.plans_page_problems_columns);
};

export function usePlansPageConfig() {
  const [config, setConfig] = useState<PlansPageConfig>({ ...DEFAULT_PLANS_PAGE_CONFIG });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await supabase
          .from("layout_config")
          .select("config_key, config_value")
          .in("config_key", PLANS_KEYS);

        if (data) {
          const loaded = { ...DEFAULT_PLANS_PAGE_CONFIG };
          data.forEach((row: any) => {
            const key = row.config_key as keyof PlansPageConfig;
            if (key in loaded) {
              loaded[key] = normalizePlansConfigValue(row.config_value);
            }
          });
          setConfig(loaded);
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchConfig();
  }, []);

  return { config, loading, keys: PLANS_KEYS };
}
