import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award } from "lucide-react";
import FaixaBadge from "./FaixaBadge";

interface AlunoElegivel {
  nome: string;
  sobrenome: string | null;
  faixa: string;
  grau: number;
  total: number;
}

function getCurrentMonthDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

const ElegiveisWidget = ({ ctId }: { ctId: string }) => {
  const [alunos, setAlunos] = useState<AlunoElegivel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const mesRef = getCurrentMonthDate();

      const { data: metricas } = await supabase
        .from("metricas_graduacao")
        .select("id")
        .eq("ct_id", ctId)
        .eq("ativo", true);

      if (!metricas || metricas.length === 0) {
        setAlunos([]);
        setLoading(false);
        return;
      }

      const metricaIds = metricas.map((m) => m.id);

      const { data: progressos } = await (supabase
        .from("progresso_metricas")
        .select("aluno_id, metrica_id, valor_atual, atingido")
        .eq("ct_id", ctId) as any)
        .eq("mes_referencia", mesRef);

      const alunoMap = new Map<string, { atingidos: Set<string>; total: number }>();
      (progressos || []).forEach((p: any) => {
        if (!metricaIds.includes(p.metrica_id)) return;
        if (!alunoMap.has(p.aluno_id)) alunoMap.set(p.aluno_id, { atingidos: new Set(), total: 0 });
        const entry = alunoMap.get(p.aluno_id)!;
        entry.total += p.valor_atual || 0;
        if (p.atingido) entry.atingidos.add(p.metrica_id);
      });

      const elegiveisIds = Array.from(alunoMap.entries())
        .filter(([, v]) => v.atingidos.size >= metricaIds.length)
        .map(([id]) => id);

      if (elegiveisIds.length === 0) {
        setAlunos([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, sobrenome, faixa, grau")
        .in("user_id", elegiveisIds);

      setAlunos(
        (profiles || []).map((p) => ({
          nome: p.nome,
          sobrenome: p.sobrenome || null,
          faixa: (p as any).faixa || "branca",
          grau: (p as any).grau || 0,
          total: alunoMap.get(p.user_id)?.total || 0,
        })).sort((a, b) => b.total - a.total)
      );
      setLoading(false);
    };
    fetch();
  }, [ctId]);

  if (loading) return null;
  if (alunos.length === 0) return null;

  return (
    <div className="glass-card rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award className="h-5 w-5 text-primary" />
        <h3 className="font-heading text-lg uppercase text-foreground">Alunos Elegíveis para Graduação</h3>
      </div>
      <div className="space-y-2">
        {alunos.map((a, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-border">
            <span className="text-foreground text-sm font-medium">{a.nome} {a.sobrenome || ""}</span>
            <div className="flex items-center gap-2">
              <FaixaBadge faixa={a.faixa as any} grau={a.grau} />
              <span className="text-foreground font-bold text-xs">{a.total} pts</span>
              <span className="text-xs font-semibold text-green-500">✅ Elegível</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ElegiveisWidget;
