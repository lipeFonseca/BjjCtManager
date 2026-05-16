import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import FaixaBadge from "../FaixaBadge";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FAIXA_ORDER_ADULTO, FAIXA_ORDER_INFANTIL, getNextFaixa } from "./faixaConfig";

interface AlunoElegivel {
  user_id: string;
  nome: string;
  sobrenome: string | null;
  faixa: string;
  grau: number;
  mediaGeral: number;
  mesesNaFaixa: number;
  mesesNecessarios: number;
  metricasOk: boolean;
  tempoOk: boolean;
  elegivel: boolean;
}

interface Props {
  ctId: string;
  refreshKey: number;
}

// Detect classe based on faixa
function detectClasse(faixa: string): string {
  const infantilOnly = ["cinza", "amarela", "laranja", "verde"];
  return infantilOnly.includes(faixa) ? "infantil" : "adulto";
}

function monthsDiff(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

const AlunosElegiveisTab = ({ ctId, refreshKey }: Props) => {
  const [alunos, setAlunos] = useState<AlunoElegivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch active metrics with their targets
      const { data: metricas } = await supabase
        .from("metricas_graduacao")
        .select("id, nome, valor_meta")
        .eq("ct_id", ctId)
        .eq("ativo", true);

      if (!metricas || metricas.length === 0) {
        setAlunos([]);
        setLoading(false);
        return;
      }

      // Fetch all aluno profiles (include created_at for fallback)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, sobrenome, faixa, grau, created_at")
        .eq("ct_id", ctId);

      if (!profiles || profiles.length === 0) {
        setAlunos([]);
        setLoading(false);
        return;
      }

      const userIds = profiles.map((p) => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const alunoIds = new Set((roles || []).filter((r) => r.role === "aluno").map((r) => r.user_id));
      const alunoProfiles = profiles.filter((p) => alunoIds.has(p.user_id));

      if (alunoProfiles.length === 0) {
        setAlunos([]);
        setLoading(false);
        return;
      }

      // Fetch tempo_graduacao configs
      const { data: tempos } = await supabase
        .from("tempo_graduacao")
        .select("faixa_origem, faixa_destino, meses, classe")
        .eq("ct_id", ctId) as any;

      // Fetch faixa_historico for all alunos (latest graduation date)
      const alunoIdList = alunoProfiles.map((p) => p.user_id);
      const { data: historicos } = await supabase
        .from("faixa_historico")
        .select("aluno_id, faixa_nova, data_graduacao")
        .in("aluno_id", alunoIdList)
        .order("data_graduacao", { ascending: false });

      // Fetch all progresso_metricas for grade totals
      const { data: progressos } = await supabase
        .from("progresso_metricas")
        .select("aluno_id, metrica_id, valor_atual")
        .eq("ct_id", ctId);

      // Fetch attendance (presenças) count per aluno
      const { data: presencas } = await supabase
        .from("presencas")
        .select("aluno_id")
        .eq("ct_id", ctId)
        .in("aluno_id", alunoIdList);

      // Count check-ins per aluno
      const presencaCount = new Map<string, number>();
      (presencas || []).forEach((p: any) => {
        presencaCount.set(p.aluno_id, (presencaCount.get(p.aluno_id) || 0) + 1);
      });

      // Fetch existing alerts to avoid duplicates
      const { data: existingAlerts } = await supabase
        .from("alertas_graduacao")
        .select("aluno_id, status")
        .eq("ct_id", ctId)
        .eq("status", "elegivel") as any;

      const alertedSet = new Set((existingAlerts || []).map((a: any) => a.aluno_id));

      // Compute total grades per aluno per metrica
      const sumMap = new Map<string, Map<string, number>>();
      (progressos || []).forEach((p: any) => {
        if (!sumMap.has(p.aluno_id)) sumMap.set(p.aluno_id, new Map());
        const m = sumMap.get(p.aluno_id)!;
        m.set(p.metrica_id, (m.get(p.metrica_id) || 0) + p.valor_atual);
      });

      const now = new Date();

      const result: AlunoElegivel[] = alunoProfiles.map((p) => {
        const faixa = (p as any).faixa || "branca";
        const grau = (p as any).grau || 0;
        const classe = detectClasse(faixa);
        const nextFaixa = getNextFaixa(faixa, classe);

        // Calculate time at current belt (fallback to profile created_at)
        const hist = (historicos || []).find(
          (h: any) => h.aluno_id === p.user_id && h.faixa_nova === faixa
        );
        const dataGraduacao = hist
          ? new Date(hist.data_graduacao)
          : new Date((p as any).created_at || now);
        const mesesNaFaixa = monthsDiff(dataGraduacao, now);

        // Find tempo requirement
        const tempoConfig = (tempos || []).find(
          (t: any) => t.faixa_origem === faixa && t.faixa_destino === nextFaixa
        );
        const mesesNecessarios = tempoConfig?.meses ?? 6;

        // Calculate metric averages based on attendance count
        const alunoSums = sumMap.get(p.user_id);
        const numCheckins = presencaCount.get(p.user_id) || 1; // avoid division by zero
        let metricasOk = true;
        let totalMedia = 0;
        let metCount = 0;

        metricas.forEach((met: any) => {
          const totalGrade = alunoSums?.get(met.id) || 0;
          const avg = totalGrade / numCheckins;
          totalMedia += avg;
          metCount++;
          if (avg < (met.valor_meta || 10)) metricasOk = false;
        });

        const mediaGeral = metCount > 0 ? Math.round((totalMedia / metCount) * 10) / 10 : 0;
        const tempoOk = mesesNaFaixa >= mesesNecessarios;
        const elegivel = metricasOk && tempoOk && nextFaixa !== null;

        return {
          user_id: p.user_id,
          nome: p.nome,
          sobrenome: p.sobrenome || null,
          faixa,
          grau,
          mediaGeral,
          mesesNaFaixa,
          mesesNecessarios,
          metricasOk,
          tempoOk,
          elegivel,
        };
      });

      // Auto-create alerts for newly eligible students
      const newElegiveis = result.filter((a) => a.elegivel && !alertedSet.has(a.user_id));
      for (const a of newElegiveis) {
        const nextFaixa = getNextFaixa(a.faixa, detectClasse(a.faixa));
        if (nextFaixa) {
          await supabase.from("alertas_graduacao").insert({
            aluno_id: a.user_id,
            ct_id: ctId,
            faixa_origem: a.faixa as any,
            faixa_destino: nextFaixa as any,
            status: "elegivel",
          });
        }
      }

      setAlunos(result.sort((a, b) => (b.elegivel ? 1 : 0) - (a.elegivel ? 1 : 0) || b.mediaGeral - a.mediaGeral));
      setLoading(false);
    };
    fetchData();
  }, [ctId, refreshKey]);

  if (loading) return <div className="text-muted-foreground animate-pulse p-4">Carregando...</div>;

  if (alunos.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center">
        <p className="text-muted-foreground">Nenhum aluno cadastrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        A elegibilidade é calculada pela <strong>média geral das notas dividida pelo número de check-ins (presenças)</strong> e pelo <strong>tempo mínimo na faixa atual</strong>. A meta é definida na aba de Métricas.
      </p>
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-foreground">Aluno</th>
              <th className="text-center p-3 font-medium text-foreground">Faixa</th>
              <th className="text-center p-3 font-medium text-foreground">Média Geral</th>
              <th className="text-center p-3 font-medium text-foreground">Tempo na Faixa</th>
              <th className="text-center p-3 font-medium text-foreground">Notas</th>
              <th className="text-center p-3 font-medium text-foreground">Tempo</th>
              <th className="text-center p-3 font-medium text-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map((a) => (
              <tr key={a.user_id} className={`border-b border-border last:border-0 hover:bg-muted/10 transition-colors ${a.elegivel ? "bg-green-500/5" : ""}`}>
                <td className="p-3 text-foreground">{a.nome} {a.sobrenome || ""}</td>
                <td className="p-3 text-center">
                  <div className="flex justify-center">
                    <FaixaBadge faixa={a.faixa as any} grau={a.grau} />
                  </div>
                </td>
                <td className="p-3 text-center text-foreground font-medium">{a.mediaGeral.toFixed(1)}</td>
                <td className="p-3 text-center text-foreground text-xs">
                  {a.mesesNaFaixa} / {a.mesesNecessarios} meses
                </td>
                <td className="p-3 text-center">
                  {a.metricasOk
                    ? <span className="text-green-500 text-xs font-semibold">✅</span>
                    : <span className="text-red-400 text-xs font-semibold">❌</span>}
                </td>
                <td className="p-3 text-center">
                  {a.tempoOk
                    ? <span className="text-green-500 text-xs font-semibold">✅</span>
                    : <span className="text-red-400 text-xs font-semibold">❌</span>}
                </td>
                <td className="p-3 text-center">
                  {a.elegivel ? (
                    <span className="text-green-500 font-semibold text-xs flex items-center justify-center gap-1">
                      <Bell className="h-3 w-3" /> Elegível
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Pendente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlunosElegiveisTab;
