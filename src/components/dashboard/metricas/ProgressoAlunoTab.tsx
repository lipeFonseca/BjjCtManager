import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import FaixaBadge from "../FaixaBadge";

interface NotaProgresso {
  metrica_nome: string;
  valor_atual: number;
  atingido: boolean;
}

interface Props {
  ctId: string;
  userId: string;
  refreshKey: number;
}

const ProgressoAlunoTab = ({ ctId, userId, refreshKey }: Props) => {
  const [notas, setNotas] = useState<NotaProgresso[]>([]);
  const [profile, setProfile] = useState<{ faixa: string; grau: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      const { data: prof } = await supabase
        .from("profiles")
        .select("faixa, grau")
        .eq("user_id", userId)
        .single();
      if (prof) setProfile(prof as any);

      const { data: metricas } = await supabase
        .from("metricas_graduacao")
        .select("id, nome")
        .eq("ct_id", ctId)
        .eq("ativo", true)
        .order("created_at");

      if (!metricas || metricas.length === 0) {
        setNotas([]);
        setLoading(false);
        return;
      }

      const metricaIds = metricas.map((m) => m.id);
      const { data: progs } = await supabase
        .from("progresso_metricas")
        .select("metrica_id, valor_atual, atingido")
        .eq("aluno_id", userId)
        .in("metrica_id", metricaIds);

      const progMap = new Map((progs || []).map((p: any) => [p.metrica_id, p]));

      setNotas(
        metricas.map((m: any) => {
          const p = progMap.get(m.id);
          return {
            metrica_nome: m.nome,
            valor_atual: p?.valor_atual || 0,
            atingido: p?.atingido || false,
          };
        })
      );
      setLoading(false);
    };
    fetch();
  }, [ctId, userId, refreshKey]);

  return (
    <div className="space-y-6">
      {profile && (
        <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
          <FaixaBadge faixa={(profile.faixa as any) || "branca"} grau={profile.grau} />
          <div>
            <p className="text-foreground font-medium">
              Faixa atual: <span className="capitalize">{profile.faixa}</span>
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground animate-pulse p-4">Carregando notas...</div>
      ) : notas.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-muted-foreground">Nenhuma métrica ativa para acompanhar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notas.map((n, idx) => {
            const pct = Math.min(Math.round((n.valor_atual / 10) * 100), 100);
            return (
              <div key={idx} className="rounded-lg border border-border p-4 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground font-medium text-sm">{n.metrica_nome}</span>
                  <span className={`text-xs font-semibold ${n.atingido ? "text-green-500" : "text-muted-foreground"}`}>
                    {n.atingido ? "✅ 10/10" : `${n.valor_atual}/10`}
                  </span>
                </div>
                <Progress value={pct} className="h-3" />
              </div>
            );
          })}

          {notas.every((n) => n.atingido) && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center">
              <p className="text-green-500 font-semibold">🎉 Parabéns! Você está elegível para graduação!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressoAlunoTab;
