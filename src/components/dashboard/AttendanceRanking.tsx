import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal } from "lucide-react";
import ChartCard from "./ChartCard";

interface RankItem {
  aluno_id: string;
  nome: string;
  sobrenome: string | null;
  faixa: string;
  total: number;
}

const FAIXA_COLORS: Record<string, string> = {
  branca: "bg-white text-black",
  cinza: "bg-gray-400 text-white",
  amarela: "bg-yellow-400 text-black",
  laranja: "bg-orange-500 text-white",
  verde: "bg-green-600 text-white",
  azul: "bg-blue-600 text-white",
  roxa: "bg-purple-600 text-white",
  marrom: "bg-amber-800 text-white",
  preta: "bg-neutral-900 text-white border border-border",
};

const MEDAL_COLORS = ["text-yellow-400", "text-gray-300", "text-amber-600"];

const AttendanceRanking = ({ ctId, role }: { ctId?: string | null; role: "admin" | "mestre" | "aluno" }) => {
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"month" | "year" | "all">("month");

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        // Build date filter
        const now = new Date();
        let dateFilter: string | null = null;
        if (period === "month") {
          dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        } else if (period === "year") {
          dateFilter = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
        }

        // Fetch presences
        let query = supabase.from("presencas").select("aluno_id, data_treino");
        if (ctId && role !== "admin") {
          query = query.eq("ct_id", ctId);
        }
        if (dateFilter) {
          query = query.gte("data_treino", dateFilter);
        }

        const { data: presencas, error: presError } = await query;
        if (presError) throw presError;

        if (!presencas || presencas.length === 0) {
          setRanking([]);
          setLoading(false);
          return;
        }

        // Count per aluno
        const countMap: Record<string, number> = {};
        presencas.forEach((p) => {
          countMap[p.aluno_id] = (countMap[p.aluno_id] || 0) + 1;
        });

        const alunoIds = Object.keys(countMap);

        // Fetch profiles
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome, sobrenome, faixa")
          .in("user_id", alunoIds);

        const items: RankItem[] = (profiles || [])
          .map((p) => ({
            aluno_id: p.user_id,
            nome: p.nome,
            sobrenome: p.sobrenome,
            faixa: p.faixa || "branca",
            total: countMap[p.user_id] || 0,
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);

        setRanking(items);
      } catch (err) {
        console.error("Erro ao buscar ranking:", err);
      }
      setLoading(false);
    };

    fetchRanking();
  }, [ctId, role, period]);

  const periodLabels = {
    month: "Mês",
    year: "Ano",
    all: "Total",
  };

  return (
    <ChartCard
      title="Ranking de presença"
      icon={Trophy}
      subtitle="Top 10 alunos com maior frequência no período selecionado."
      action={
        <div className="flex w-full max-w-sm justify-center gap-1 sm:max-w-none sm:w-auto">
          {(["month", "year", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`min-w-[56px] px-3 py-1.5 text-xs rounded-xl transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      }
    >

      {loading ? (
        <p className="text-muted-foreground text-sm animate-pulse">Carregando ranking...</p>
      ) : ranking.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma presença registrada no período.</p>
      ) : (
        <div className="space-y-2">
          {ranking.map((item, index) => {
            const fullName = item.sobrenome
              ? `${item.nome} ${item.sobrenome}`
              : item.nome;
            const faixaClass = FAIXA_COLORS[item.faixa] || "bg-muted text-foreground";
            const isTop3 = index < 3;

            return (
              <div
                key={item.aluno_id}
                className={`flex items-center gap-3 rounded-[18px] px-4 py-3 transition-colors ${
                  isTop3
                    ? "bg-primary/8 border border-primary/25"
                    : "bg-background/45 border border-border/55"
                }`}
              >
                {/* Position */}
                <div className="w-8 flex items-center justify-center">
                  {isTop3 ? (
                    <Medal className={`h-5 w-5 ${MEDAL_COLORS[index]}`} />
                  ) : (
                    <span className="text-sm font-heading text-muted-foreground">
                      {index + 1}º
                    </span>
                  )}
                </div>

                {/* Faixa badge */}
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${faixaClass}`}
                >
                  {item.faixa}
                </span>

                {/* Name */}
                <span className="flex-1 text-sm text-foreground truncate">
                  {fullName}
                </span>

                {/* Count */}
                <div className="flex items-center gap-1">
                  <span className="text-lg font-heading text-foreground">
                    {item.total}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase">
                    treinos
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
};

export default AttendanceRanking;
