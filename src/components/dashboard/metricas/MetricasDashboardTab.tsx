import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  ctId: string;
  refreshKey: number;
}

const CORES = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

const MetricasDashboardTab = ({ ctId, refreshKey }: Props) => {
  const [metricas, setMetricas] = useState<{ id: string; nome: string }[]>([]);
  const [alunos, setAlunos] = useState<{ user_id: string; nome: string; faixa: string; grau: number }[]>([]);
  const [allProgressos, setAllProgressos] = useState<any[]>([]);
  const [selectedAluno, setSelectedAluno] = useState<string>("all");
  const [radarSelectedAluno, setRadarSelectedAluno] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const [metRes, profRes] = await Promise.all([
        supabase.from("metricas_graduacao").select("id, nome").eq("ct_id", ctId).eq("ativo", true).order("created_at"),
        supabase.from("profiles").select("user_id, nome, sobrenome, faixa, grau").eq("ct_id", ctId),
      ]);

      const mets = (metRes.data as any) || [];
      setMetricas(mets);

      const profiles = profRes.data || [];
      if (profiles.length === 0) { setLoading(false); return; }

      const userIds = profiles.map((p) => p.user_id);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
      const alunoIds = new Set((roles || []).filter((r) => r.role === "aluno").map((r) => r.user_id));
      const alunoList = profiles.filter((p) => alunoIds.has(p.user_id)).map((p) => ({
        user_id: p.user_id,
        nome: `${p.nome} ${p.sobrenome || ""}`.trim(),
        faixa: (p as any).faixa || "branca",
        grau: (p as any).grau || 0,
      }));
      setAlunos(alunoList);

      const { data: progData } = await supabase.from("progresso_metricas").select("aluno_id, metrica_id, valor_atual, data_aula, mes_referencia").eq("ct_id", ctId) as any;
      setAllProgressos(progData || []);
      setLoading(false);
    };
    fetchAll();
  }, [ctId, refreshKey]);

  if (loading) return <div className="text-muted-foreground animate-pulse p-4">Carregando...</div>;
  if (metricas.length === 0 || alunos.length === 0) return <div className="text-muted-foreground p-4">Sem dados suficientes para gráficos.</div>;

  // Radar data (current month averages per metric per student)
  const radarData = (() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const filteredProg = allProgressos.filter((p: any) => {
      const month = p.data_aula ? p.data_aula.slice(0, 7) : (p.mes_referencia ? p.mes_referencia.slice(0, 7) : null);
      return month === currentMonth;
    });

    return metricas.map((m) => {
      const entry: any = { metrica: m.nome };
      const baseAlunos = selectedAluno === "all" ? alunos : alunos.filter((a) => a.user_id === selectedAluno);
      const targetAlunos = radarSelectedAluno === "all" ? baseAlunos : baseAlunos.filter((a) => a.user_id === radarSelectedAluno);
      targetAlunos.forEach((a) => {
        const scores = filteredProg.filter((p: any) => p.aluno_id === a.user_id && p.metrica_id === m.id);
        entry[a.nome] = scores.length ? Math.round(scores.reduce((s: number, p: any) => s + p.valor_atual, 0) / scores.length * 10) / 10 : 0;
      });
      return entry;
    });
  })();

  const baseRadarAlunos = selectedAluno === "all" ? alunos : alunos.filter((a) => a.user_id === selectedAluno);
  const radarAlunos = radarSelectedAluno === "all" ? baseRadarAlunos : baseRadarAlunos.filter((a) => a.user_id === radarSelectedAluno);

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar aluno:</span>
        <Select value={selectedAluno} onValueChange={setSelectedAluno}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os alunos</SelectItem>
            {alunos.map((a) => (
              <SelectItem key={a.user_id} value={a.user_id}>{a.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Radar Chart */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-sm uppercase text-foreground">🎯 Comparativo de Métricas</h3>
          <Select value={radarSelectedAluno} onValueChange={setRadarSelectedAluno}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os alunos</SelectItem>
              {baseRadarAlunos.map((a) => (
                <SelectItem key={a.user_id} value={a.user_id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {radarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metrica" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              {radarAlunos.map((a, i) => (
                <Radar key={a.user_id} name={a.nome} dataKey={a.nome} stroke={CORES[i % CORES.length]} fill={CORES[i % CORES.length]} fillOpacity={0.15} />
              ))}
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        ) : <p className="text-muted-foreground text-sm">Sem dados</p>}
      </div>
    </div>
  );
};

export default MetricasDashboardTab;
