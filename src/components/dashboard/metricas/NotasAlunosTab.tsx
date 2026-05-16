import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Trophy, CalendarDays } from "lucide-react";
import FaixaBadge from "../FaixaBadge";
import { Input } from "@/components/ui/input";

interface Metrica {
  id: string;
  nome: string;
}

interface AlunoProfile {
  user_id: string;
  nome: string;
  sobrenome: string | null;
  faixa: string;
  grau: number;
}

interface Props {
  ctId: string;
  refreshKey: number;
  onRefresh: () => void;
}

const NotasAlunosTab = ({ ctId, refreshKey, onRefresh }: Props) => {
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [alunos, setAlunos] = useState<AlunoProfile[]>([]);
  const [notas, setNotas] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dataAula, setDataAula] = useState(() => new Date().toISOString().slice(0, 10));
  const [mediaMensal, setMediaMensal] = useState<Record<string, Record<string, number>>>({});

  const mesLabel = (() => {
    const d = new Date(dataAula + "T12:00:00");
    const meses = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${meses[d.getMonth()]} ${d.getFullYear()}`;
  })();

  const mesRef = dataAula.slice(0, 7) + "-01";

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: metricasData } = await supabase
        .from("metricas_graduacao")
        .select("id, nome")
        .eq("ct_id", ctId)
        .eq("ativo", true)
        .order("created_at");

      const mets = (metricasData as any) || [];
      setMetricas(mets);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, sobrenome, faixa, grau")
        .eq("ct_id", ctId);

      if (!profiles || profiles.length === 0) {
        setAlunos([]);
        setLoading(false);
        return;
      }

      const userIds = profiles.map((p) => p.user_id);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);

      const alunoIds = new Set((roles || []).filter((r) => r.role === "aluno").map((r) => r.user_id));
      const alunoProfiles = profiles
        .filter((p) => alunoIds.has(p.user_id))
        .map((p) => ({
          user_id: p.user_id,
          nome: p.nome,
          sobrenome: p.sobrenome || null,
          faixa: (p as any).faixa || "branca",
          grau: (p as any).grau || 0,
        }));
      setAlunos(alunoProfiles);

      if (mets.length > 0 && alunoProfiles.length > 0) {
        const { data: dayProgressos } = await (supabase
          .from("progresso_metricas")
          .select("aluno_id, metrica_id, valor_atual")
          .eq("ct_id", ctId) as any).eq("data_aula", dataAula);

        const notasMap: Record<string, Record<string, number>> = {};
        (dayProgressos || []).forEach((p: any) => {
          if (!notasMap[p.aluno_id]) notasMap[p.aluno_id] = {};
          notasMap[p.aluno_id][p.metrica_id] = p.valor_atual;
        });
        setNotas(notasMap);

        const monthStart = dataAula.slice(0, 7) + "-01";
        const nextMonth = new Date(monthStart + "T12:00:00");
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const monthEnd = nextMonth.toISOString().slice(0, 10);

        const { data: monthProgressos } = await (supabase
          .from("progresso_metricas")
          .select("aluno_id, metrica_id, valor_atual, data_aula")
          .eq("ct_id", ctId) as any)
          .gte("data_aula", monthStart)
          .lt("data_aula", monthEnd);

        const sums: Record<string, Record<string, { total: number; count: number }>> = {};
        (monthProgressos || []).forEach((p: any) => {
          if (!sums[p.aluno_id]) sums[p.aluno_id] = {};
          if (!sums[p.aluno_id][p.metrica_id]) sums[p.aluno_id][p.metrica_id] = { total: 0, count: 0 };
          sums[p.aluno_id][p.metrica_id].total += p.valor_atual;
          sums[p.aluno_id][p.metrica_id].count += 1;
        });

        const avgMap: Record<string, Record<string, number>> = {};
        for (const alunoId of Object.keys(sums)) {
          avgMap[alunoId] = {};
          for (const metricaId of Object.keys(sums[alunoId])) {
            avgMap[alunoId][metricaId] = Math.round((sums[alunoId][metricaId].total / sums[alunoId][metricaId].count) * 10) / 10;
          }
        }
        setMediaMensal(avgMap);
      } else {
        setNotas({});
        setMediaMensal({});
      }

      setLoading(false);
    };

    void fetchData();
  }, [ctId, refreshKey, dataAula]);

  const updateNota = (alunoId: string, metricaId: string, value: string) => {
    const num = Math.min(10, Math.max(0, parseInt(value) || 0));
    setNotas((prev) => ({
      ...prev,
      [alunoId]: { ...(prev[alunoId] || {}), [metricaId]: num },
    }));
  };

  const salvarNotas = async () => {
    setSaving(true);
    try {
      for (const alunoId of Object.keys(notas)) {
        for (const metricaId of Object.keys(notas[alunoId])) {
          const valor = notas[alunoId][metricaId];
          const { data: existing } = await (supabase
            .from("progresso_metricas")
            .select("id")
            .eq("aluno_id", alunoId)
            .eq("metrica_id", metricaId) as any)
            .eq("data_aula", dataAula)
            .maybeSingle();

          if (existing) {
            await (supabase
              .from("progresso_metricas")
              .update({ valor_atual: valor, atingido: valor >= 10 } as any) as any)
              .eq("id", existing.id);
          } else {
            await supabase.from("progresso_metricas").insert({
              aluno_id: alunoId,
              metrica_id: metricaId,
              ct_id: ctId,
              valor_atual: valor,
              atingido: valor >= 10,
              mes_referencia: mesRef,
              data_aula: dataAula,
            } as any);
          }
        }
      }
      toast.success("Notas salvas com sucesso!");
      onRefresh();
    } catch {
      toast.error("Erro ao salvar notas");
    }
    setSaving(false);
  };

  const ranking = alunos
    .map((a) => {
      const avg = mediaMensal[a.user_id] || {};
      const total = metricas.reduce((sum, m) => sum + (avg[m.id] || 0), 0);
      const allMax = metricas.length > 0 && metricas.every((m) => (avg[m.id] || 0) >= 10);
      return { ...a, total: Math.round(total * 10) / 10, allMax };
    })
    .sort((a, b) => b.total - a.total);

  if (loading) return <div className="p-4 text-muted-foreground animate-pulse">Carregando...</div>;
  if (metricas.length === 0) return <div className="rounded-lg border border-border p-8 text-center"><p className="text-muted-foreground">Nenhuma metrica ativa.</p></div>;
  if (alunos.length === 0) return <div className="rounded-lg border border-border p-8 text-center"><p className="text-muted-foreground">Nenhum aluno cadastrado.</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <CalendarDays className="h-5 w-5 text-primary" />
        <Input type="date" value={dataAula} onChange={(e) => setDataAula(e.target.value)} className="w-auto" />
        <span className="text-sm text-muted-foreground">({mesLabel})</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="sticky left-0 bg-muted/30 p-3 text-left font-medium text-foreground">Aluno</th>
              <th className="hidden p-3 text-center font-medium text-foreground sm:table-cell">Faixa</th>
              {metricas.map((m) => (
                <th key={m.id} className="min-w-[80px] p-3 text-center font-medium text-foreground">{m.nome}</th>
              ))}
              <th className="p-3 text-center font-medium text-foreground">Total Dia</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map((a) => {
              const alunoNotas = notas[a.user_id] || {};
              const total = metricas.reduce((sum, m) => sum + (alunoNotas[m.id] || 0), 0);
              return (
                <tr key={a.user_id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/10">
                  <td className="sticky left-0 whitespace-nowrap bg-background p-3 text-foreground">{a.nome} {a.sobrenome || ""}</td>
                  <td className="hidden p-3 text-center sm:table-cell">
                    <div className="flex justify-center"><FaixaBadge faixa={a.faixa as any} grau={a.grau} /></div>
                  </td>
                  {metricas.map((m) => (
                    <td key={m.id} className="p-2 text-center">
                      <Select value={String(alunoNotas[m.id] ?? "")} onValueChange={(v) => updateNota(a.user_id, m.id, v)}>
                        <SelectTrigger className="mx-auto h-8 w-16 text-sm"><SelectValue placeholder="-" /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 11 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>{i}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  ))}
                  <td className="p-3 text-center font-semibold text-foreground">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={salvarNotas} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Notas"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="border-b border-border bg-muted/30 p-3">
          <h3 className="font-heading text-sm uppercase text-foreground">Media Mensal - {mesLabel}</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="sticky left-0 bg-muted/10 p-3 text-left font-medium text-foreground">Aluno</th>
              {metricas.map((m) => (
                <th key={m.id} className="min-w-[80px] p-3 text-center font-medium text-foreground">{m.nome}</th>
              ))}
              <th className="p-3 text-center font-medium text-foreground">Media</th>
              <th className="p-3 text-center font-medium text-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((a) => {
              const avg = mediaMensal[a.user_id] || {};
              return (
                <tr key={a.user_id} className="border-b border-border last:border-0 hover:bg-muted/10">
                  <td className="sticky left-0 bg-background p-3 text-foreground">{a.nome} {a.sobrenome || ""}</td>
                  {metricas.map((m) => (
                    <td key={m.id} className="p-3 text-center text-foreground">{avg[m.id]?.toFixed(1) ?? "-"}</td>
                  ))}
                  <td className="p-3 text-center font-semibold text-foreground">{a.total.toFixed(1)}</td>
                  <td className="p-3 text-center">
                    {a.allMax ? <span className="text-xs font-semibold text-green-500">Meta atingida</span> : <span className="text-xs text-muted-foreground">Pendente</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border p-5">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-lg uppercase text-foreground">Ranking - {mesLabel}</h3>
        </div>
        <div className="space-y-2">
          {ranking.map((a, i) => (
            <div key={a.user_id} className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                  #{i + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{a.nome} {a.sobrenome || ""}</span>
              </div>
              <div className="flex items-center gap-3">
                <FaixaBadge faixa={a.faixa as any} grau={a.grau} />
                <span className="text-sm font-bold text-foreground">{a.total.toFixed(1)} pts</span>
                {a.allMax && <span className="text-xs font-semibold text-green-500">OK</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotasAlunosTab;
