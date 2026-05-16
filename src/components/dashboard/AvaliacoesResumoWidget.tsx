import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Minus, Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Avaliacao {
  nota_tecnica: number;
  nota_frequencia: number;
  nota_disciplina: number;
  created_at: string;
}

const AvaliacoesResumoWidget = ({ userId }: { userId: string }) => {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("avaliacoes")
        .select("nota_tecnica, nota_frequencia, nota_disciplina, created_at")
        .eq("aluno_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      setAvaliacoes(data || []);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading) return null;
  if (avaliacoes.length === 0) {
    return (
      <div className="glass-card rounded-lg p-6">
        <h2 className="font-heading text-lg uppercase text-foreground mb-4">Minhas Avaliações</h2>
        <p className="text-muted-foreground text-sm">Nenhuma avaliação registrada ainda.</p>
      </div>
    );
  }

  const avg = (a: Avaliacao) => (a.nota_tecnica + a.nota_frequencia + a.nota_disciplina) / 3;
  const latest = avaliacoes[0];
  const previous = avaliacoes[1];
  const latestAvg = avg(latest);
  const previousAvg = previous ? avg(previous) : null;
  const diff = previousAvg !== null ? latestAvg - previousAvg : 0;

  const globalAvg = avaliacoes.reduce((sum, a) => sum + avg(a), 0) / avaliacoes.length;

  const getColor = (v: number) => v >= 8 ? "text-green-500" : v >= 5 ? "text-yellow-500" : "text-red-500";
  const getProgressColor = (v: number) => v >= 8 ? "bg-green-500" : v >= 5 ? "bg-yellow-500" : "bg-red-500";

  const categories = [
    { label: "Técnica", value: latest.nota_tecnica },
    { label: "Frequência", value: latest.nota_frequencia },
    { label: "Disciplina", value: latest.nota_disciplina },
  ];

  return (
    <div className="glass-card rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-lg uppercase text-foreground">Minhas Avaliações</h2>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 text-primary" />
          {avaliacoes.length} avaliação(ões)
        </div>
      </div>

      {/* Latest avg + trend */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-primary/30 bg-primary/5">
          <span className={`font-heading text-2xl ${getColor(latestAvg)}`}>{latestAvg.toFixed(1)}</span>
          <span className="text-[10px] text-muted-foreground">última</span>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            {diff > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : diff < 0 ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {previousAvg !== null
                ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)} vs anterior`
                : "Primeira avaliação"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Média geral: <span className={`font-semibold ${getColor(globalAvg)}`}>{globalAvg.toFixed(1)}</span>
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{cat.label}</span>
              <span className={`font-medium ${getColor(cat.value)}`}>{cat.value}/10</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-all ${getProgressColor(cat.value)}`}
                style={{ width: `${cat.value * 10}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AvaliacoesResumoWidget;
