import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { FileText, Download, Users, TrendingUp, CalendarCheck, UserMinus, Calendar, ArrowLeft, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, subWeeks, startOfWeek, endOfWeek, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface RelatoriosSectionProps {
  ctId: string;
  ctNome: string;
  onBack: () => void;
}

interface MonthData {
  mes: string;
  presencas: number;
  mesNum: number;
}

interface WeekData {
  semana: string;
  presencas: number;
}

interface AlunoStats {
  nome: string;
  sobrenome: string | null;
  faixa: string | null;
  totalPresencas: number;
  presencasMes: number;
  diasSemTreino: number;
}

const FAIXA_CORES: Record<string, string> = {
  branca: "#ffffff",
  cinza: "#6b7280",
  amarela: "#eab308",
  laranja: "#f97316",
  verde: "#22c55e",
  azul: "#3b82f6",
  roxa: "#a855f7",
  marrom: "#78350f",
  preta: "#171717",
};

const RelatoriosSection = ({ ctId, ctNome, onBack }: RelatoriosSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [alunoStats, setAlunoStats] = useState<AlunoStats[]>([]);
  const [totalAlunos, setTotalAlunos] = useState(0);
  const [alunosAtivos, setAlunosAtivos] = useState(0);
  const [alunosInativos, setAlunosInativos] = useState(0);
  const [taxaRetencao, setTaxaRetencao] = useState(0);
  const [periodoExport, setPeriodoExport] = useState<"mes" | "trimestre" | "ano">("mes");
  const [periodoFiltro, setPeriodoFiltro] = useState<"mes" | "trimestre" | "ano">("mes");

  // Comparison state
  const [presencasAtual, setPresencasAtual] = useState(0);
  const [presencasAnterior, setPresencasAnterior] = useState(0);
  const [ativosAnterior, setAtivosAnterior] = useState(0);
  const [comparisonMonthly, setComparisonMonthly] = useState<{ mes: string; atual: number; anterior: number }[]>([]);

  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  useEffect(() => {
    fetchAllData();
  }, [ctId, periodoFiltro]);

  const getDateRange = () => {
    const now = new Date();
    switch (periodoFiltro) {
      case "mes":
        return { inicio: subMonths(now, 1), fim: now, label: "Último Mês", labelAnterior: "Mês Anterior", meses: 1 };
      case "trimestre":
        return { inicio: subMonths(now, 3), fim: now, label: "Último Trimestre", labelAnterior: "Trimestre Anterior", meses: 3 };
      case "ano":
        return { inicio: subMonths(now, 12), fim: now, label: "Último Ano", labelAnterior: "Ano Anterior", meses: 12 };
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    const now = new Date();
    const { inicio: periodoInicio, meses } = getDateRange();
    const prevInicio = subMonths(periodoInicio, meses);

    // Fetch all profiles (students only)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome, sobrenome, faixa")
      .eq("ct_id", ctId);

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Get mestres to filter out
    const userIds = profiles.map((p) => p.user_id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const mestreIds = new Set((roles || []).filter((r) => r.role === "mestre").map((r) => r.user_id));
    const alunos = profiles.filter((p) => !mestreIds.has(p.user_id));
    setTotalAlunos(alunos.length);

    // Fetch presencas for current period
    const { data: presencas } = await supabase
      .from("presencas")
      .select("aluno_id, data_treino")
      .eq("ct_id", ctId)
      .gte("data_treino", format(periodoInicio, "yyyy-MM-dd"))
      .lte("data_treino", format(now, "yyyy-MM-dd"));

    const presencasList = presencas || [];
    setPresencasAtual(presencasList.length);

    // Fetch presencas for previous period (comparison)
    const { data: prevPresencas } = await supabase
      .from("presencas")
      .select("aluno_id, data_treino")
      .eq("ct_id", ctId)
      .gte("data_treino", format(prevInicio, "yyyy-MM-dd"))
      .lt("data_treino", format(periodoInicio, "yyyy-MM-dd"));

    const prevPresencasList = prevPresencas || [];
    setPresencasAnterior(prevPresencasList.length);

    // Build comparison monthly data
    const monthsToShow = periodoFiltro === "mes" ? 1 : periodoFiltro === "trimestre" ? 3 : 12;
    const compMonthly: { mes: string; atual: number; anterior: number }[] = [];
    const monthCounts: Record<string, { label: string; count: number; sortKey: number }> = {};

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const refAtual = subMonths(now, i);
      const refAnterior = subMonths(refAtual, meses);
      const keyAtual = `${refAtual.getFullYear()}-${refAtual.getMonth()}`;
      const keyAnterior = `${refAnterior.getFullYear()}-${refAnterior.getMonth()}`;
      const label = monthsToShow <= 3
        ? `${MESES[refAtual.getMonth()]}/${refAtual.getFullYear()}`
        : MESES[refAtual.getMonth()];

      monthCounts[keyAtual] = {
        label,
        count: 0,
        sortKey: refAtual.getFullYear() * 100 + refAtual.getMonth(),
      };

      const atualCount = presencasList.filter((p) => {
        const d = new Date(p.data_treino);
        return `${d.getFullYear()}-${d.getMonth()}` === keyAtual;
      }).length;

      const anteriorCount = prevPresencasList.filter((p) => {
        const d = new Date(p.data_treino);
        return `${d.getFullYear()}-${d.getMonth()}` === keyAnterior;
      }).length;

      compMonthly.push({ mes: label, atual: atualCount, anterior: anteriorCount });
    }

    presencasList.forEach((p) => {
      const date = new Date(p.data_treino);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthCounts[key]) monthCounts[key].count++;
    });

    const monthly: MonthData[] = Object.values(monthCounts)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((m) => ({ mes: m.label, presencas: m.count, mesNum: m.sortKey }));
    setMonthlyData(monthly);
    setComparisonMonthly(compMonthly);

    // Weekly data based on period
    const weeksToShow = periodoFiltro === "mes" ? 4 : periodoFiltro === "trimestre" ? 12 : 8;
    const weekData: WeekData[] = [];
    for (let i = weeksToShow - 1; i >= 0; i--) {
      const weekRef = subWeeks(now, i);
      const inicio = startOfWeek(weekRef, { weekStartsOn: 1 });
      const fim = endOfWeek(weekRef, { weekStartsOn: 1 });

      const count = presencasList.filter((p) => {
        const d = new Date(p.data_treino);
        return d >= inicio && d <= fim;
      }).length;

      weekData.push({
        semana: format(inicio, "dd/MM", { locale: ptBR }),
        presencas: count,
      });
    }
    setWeeklyData(weekData);

    // Aluno stats with retention calculation
    const limite30Dias = subMonths(now, 1);
    const limitePrev30Dias = subMonths(limite30Dias, 1);

    // Also fetch ALL presencas for total count and dias sem treino
    const { data: allPresencas } = await supabase
      .from("presencas")
      .select("aluno_id, data_treino")
      .eq("ct_id", ctId);

    const allPresencasList = allPresencas || [];

    let ativos = 0;
    let inativos = 0;

    // Count previous period active students
    let prevAtivos = 0;
    for (const aluno of alunos) {
      const alunoAllPresencas = allPresencasList.filter((p) => p.aluno_id === aluno.user_id);
      const hasPrevPresenca = alunoAllPresencas.some((p) => {
        const d = new Date(p.data_treino);
        return d >= limitePrev30Dias && d < limite30Dias;
      });
      if (hasPrevPresenca) prevAtivos++;
    }
    setAtivosAnterior(prevAtivos);

    const statsMap: Record<string, AlunoStats> = {};
    for (const aluno of alunos) {
      const alunoAllPresencas = allPresencasList.filter((p) => p.aluno_id === aluno.user_id);
      const presencasPeriodo = presencasList.filter((p) => p.aluno_id === aluno.user_id).length;

      const ultimaPresenca = alunoAllPresencas
        .map((p) => new Date(p.data_treino))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const diasSemTreino = ultimaPresenca ? differenceInDays(now, ultimaPresenca) : 999;

      if (ultimaPresenca && ultimaPresenca >= limite30Dias) {
        ativos++;
      } else {
        inativos++;
      }

      statsMap[aluno.user_id] = {
        nome: aluno.nome,
        sobrenome: aluno.sobrenome,
        faixa: aluno.faixa,
        totalPresencas: alunoAllPresencas.length,
        presencasMes: presencasPeriodo,
        diasSemTreino: diasSemTreino === 999 ? -1 : diasSemTreino,
      };
    }

    setAlunosAtivos(ativos);
    setAlunosInativos(inativos);
    setTaxaRetencao(alunos.length > 0 ? Math.round((ativos / alunos.length) * 100) : 0);

    const sortedStats = Object.values(statsMap).sort((a, b) => b.totalPresencas - a.totalPresencas);
    setAlunoStats(sortedStats);

    setLoading(false);
  };

  // Delta helper
  const getDelta = (atual: number, anterior: number) => {
    if (anterior === 0) return atual > 0 ? 100 : 0;
    return Math.round(((atual - anterior) / anterior) * 100);
  };

  const DeltaIndicator = ({ atual, anterior }: { atual: number; anterior: number }) => {
    const delta = getDelta(atual, anterior);
    if (delta === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> 0%</span>;
    if (delta > 0) return <span className="text-xs text-primary flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" /> +{delta}%</span>;
    return <span className="text-xs text-destructive flex items-center gap-0.5"><ArrowDownRight className="h-3 w-3" /> {delta}%</span>;
  };

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.text(`Relatório - ${ctNome}`, pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, pageWidth / 2, 28, { align: "center" });

    // Summary
    doc.setFontSize(12);
    doc.text("Resumo", 14, 40);
    doc.setFontSize(10);
    doc.text(`Total de Alunos: ${totalAlunos}`, 14, 48);
    doc.text(`Alunos Ativos (últimos 30 dias): ${alunosAtivos}`, 14, 54);
    doc.text(`Alunos Inativos: ${alunosInativos}`, 14, 60);
    doc.text(`Taxa de Retenção: ${taxaRetencao}%`, 14, 66);

    // Alunos table
    doc.setFontSize(12);
    doc.text("Detalhamento por Aluno", 14, 80);

    const tableData = alunoStats.map((a) => [
      `${a.nome} ${a.sobrenome || ""}`.trim(),
      a.faixa || "—",
      a.totalPresencas.toString(),
      a.presencasMes.toString(),
      a.diasSemTreino === -1 ? "Nunca treinou" : `${a.diasSemTreino} dias`,
    ]);

    autoTable(doc, {
      startY: 85,
      head: [["Aluno", "Faixa", "Total Presenças", "Presenças (Mês)", "Dias sem Treino"]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 38, 38] },
    });

    doc.save(`relatorio_${ctNome.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  // Export Excel
  const exportExcel = () => {
    const summaryData = [
      ["Relatório - " + ctNome],
      ["Gerado em", format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })],
      [],
      ["Resumo"],
      ["Total de Alunos", totalAlunos],
      ["Alunos Ativos", alunosAtivos],
      ["Alunos Inativos", alunosInativos],
      ["Taxa de Retenção", `${taxaRetencao}%`],
      [],
    ];

    const alunosHeader = ["Aluno", "Faixa", "Total Presenças", "Presenças (Mês)", "Dias sem Treino"];
    const alunosData = alunoStats.map((a) => [
      `${a.nome} ${a.sobrenome || ""}`.trim(),
      a.faixa || "—",
      a.totalPresencas,
      a.presencasMes,
      a.diasSemTreino === -1 ? "Nunca treinou" : a.diasSemTreino,
    ]);

    const wsData = [...summaryData, alunosHeader, ...alunosData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");

    // Monthly data sheet
    const monthlySheet = XLSX.utils.json_to_sheet(monthlyData.map((m) => ({ Mês: m.mes, Presenças: m.presencas })));
    XLSX.utils.book_append_sheet(wb, monthlySheet, "Frequência Mensal");

    // Weekly data sheet
    const weeklySheet = XLSX.utils.json_to_sheet(weeklyData.map((w) => ({ Semana: w.semana, Presenças: w.presencas })));
    XLSX.utils.book_append_sheet(wb, weeklySheet, "Frequência Semanal");

    XLSX.writeFile(wb, `relatorio_${ctNome.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  // Retention pie chart data
  const retentionData = useMemo(() => [
    { name: "Ativos", value: alunosAtivos, color: "hsl(var(--primary))" },
    { name: "Inativos", value: alunosInativos, color: "hsl(var(--muted))" },
  ], [alunosAtivos, alunosInativos]);

  // Belt distribution data
  const faixaDistribuicao = useMemo(() => {
    const counts: Record<string, number> = {};
    alunoStats.forEach((a) => {
      const faixa = a.faixa || "branca";
      counts[faixa] = (counts[faixa] || 0) + 1;
    });
    const ordem = ["branca", "cinza", "amarela", "laranja", "verde", "azul", "roxa", "marrom", "preta"];
    return ordem
      .filter((f) => counts[f])
      .map((f) => ({
        faixa: f.charAt(0).toUpperCase() + f.slice(1),
        quantidade: counts[f],
        fill: FAIXA_CORES[f],
      }));
  }, [alunoStats]);

  if (loading) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div className="glass-card rounded-lg p-8">
          <p className="text-muted-foreground text-sm animate-pulse">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div>
            <h1 className="font-heading text-2xl uppercase text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Relatórios & Analytics
            </h1>
            <p className="text-muted-foreground text-sm">{ctNome}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodoFiltro} onValueChange={(v) => setPeriodoFiltro(v as "mes" | "trimestre" | "ano")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Último Mês</SelectItem>
              <SelectItem value="trimestre">Último Trimestre</SelectItem>
              <SelectItem value="ano">Último Ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Presenças no Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{presencasAtual}</p>
            <DeltaIndicator atual={presencasAtual} anterior={presencasAnterior} />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Alunos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{alunosAtivos}</p>
            <DeltaIndicator atual={alunosAtivos} anterior={ativosAnterior} />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
              <UserMinus className="h-4 w-4" />
              Alunos Inativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{alunosInativos}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Taxa Retenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{taxaRetencao}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="mensal" className="w-full">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="mensal">Frequência Mensal</TabsTrigger>
          <TabsTrigger value="semanal">Frequência Semanal</TabsTrigger>
          <TabsTrigger value="comparacao">Comparação</TabsTrigger>
          <TabsTrigger value="faixas">Distribuição por Faixa</TabsTrigger>
          <TabsTrigger value="retencao">Retenção</TabsTrigger>
        </TabsList>

        <TabsContent value="mensal">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Presenças por Mês ({getDateRange().label})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [value, "Presenças"]}
                  />
                  <Bar dataKey="presencas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="semanal">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Presenças por Semana ({getDateRange().label})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="semana" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [value, "Presenças"]}
                  />
                  <Line type="monotone" dataKey="presencas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparacao">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {getDateRange().label} vs {getDateRange().labelAnterior}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Presenças (Atual)</p>
                  <p className="text-2xl font-bold text-foreground">{presencasAtual}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Presenças (Anterior)</p>
                  <p className="text-2xl font-bold text-muted-foreground">{presencasAnterior}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Variação</p>
                  <div className="text-2xl font-bold">
                    <DeltaIndicator atual={presencasAtual} anterior={presencasAnterior} />
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="atual" name="Período Atual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="anterior" name="Período Anterior" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faixas">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Distribuição de Alunos por Faixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-72 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={faixaDistribuicao}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="quantidade"
                        nameKey="faixa"
                      >
                        {faixaDistribuicao.map((entry, index) => (
                          <Cell key={`faixa-${index}`} fill={entry.fill} stroke="hsl(var(--border))" strokeWidth={1} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          color: "hsl(var(--foreground))",
                        }}
                        formatter={(value: number, name: string) => [value, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {faixaDistribuicao.map((item) => (
                    <div key={item.faixa} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border border-border"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-foreground text-sm">
                        {item.faixa}: <strong>{item.quantidade}</strong>
                      </span>
                    </div>
                  ))}
                  {faixaDistribuicao.length === 0 && (
                    <p className="text-muted-foreground text-sm col-span-2">Nenhum aluno encontrado.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retencao">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Taxa de Retenção de Alunos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-64 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={retentionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {retentionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-primary" />
                    <span className="text-foreground">Ativos: <strong>{alunosAtivos}</strong> ({totalAlunos > 0 ? Math.round((alunosAtivos / totalAlunos) * 100) : 0}%)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-muted" />
                    <span className="text-foreground">Inativos: <strong>{alunosInativos}</strong> ({totalAlunos > 0 ? Math.round((alunosInativos / totalAlunos) * 100) : 0}%)</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    Alunos são considerados <strong>ativos</strong> se treinaram nos últimos 30 dias.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      {/* Alunos Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Detalhamento por Aluno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Aluno</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Faixa</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">Total</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">No Período</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">Dias sem Treino</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {alunoStats.map((aluno, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-3 px-2 text-foreground">{aluno.nome} {aluno.sobrenome || ""}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded border border-border"
                          style={{ backgroundColor: FAIXA_CORES[aluno.faixa || "branca"] }}
                        />
                        <span className="text-foreground capitalize">{aluno.faixa || "—"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center text-foreground font-medium">{aluno.totalPresencas}</td>
                    <td className="py-3 px-2 text-center text-foreground">{aluno.presencasMes}</td>
                    <td className="py-3 px-2 text-center text-muted-foreground">
                      {aluno.diasSemTreino === -1 ? "—" : `${aluno.diasSemTreino}d`}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {aluno.diasSemTreino <= 30 && aluno.diasSemTreino !== -1 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive">
                          Inativo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {alunoStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum aluno encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RelatoriosSection;
