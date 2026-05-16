import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CalendarCheck, Users } from "lucide-react";
import ChartCard from "./ChartCard";

interface AlunoOption {
  user_id: string;
  nome: string;
  sobrenome: string | null;
  faixa: string | null;
}

interface MonthData {
  mes: string;
  presencas: number;
}

const AttendanceChart = ({ ctId }: { ctId: string }) => {
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [selectedAluno, setSelectedAluno] = useState<string>("todos");
  const [chartData, setChartData] = useState<MonthData[]>([]);
  const [totalPresencas, setTotalPresencas] = useState(0);
  const [loading, setLoading] = useState(true);

  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  useEffect(() => {
    const fetchAlunos = async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, sobrenome, faixa")
        .eq("ct_id", ctId);

      if (profiles) {
        const userIds = profiles.map(p => p.user_id);
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const mestreIds = new Set((roles || []).filter(r => r.role === "mestre").map(r => r.user_id));
        const alunoList = (profiles as AlunoOption[])
          .filter(p => !mestreIds.has(p.user_id))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        setAlunos(alunoList);
      }
      setLoading(false);
    };
    fetchAlunos();
  }, [ctId]);

  useEffect(() => {
    const fetchPresencas = async () => {
      let query = supabase
        .from("presencas")
        .select("data_treino, aluno_id")
        .eq("ct_id", ctId);

      if (selectedAluno !== "todos") {
        query = query.eq("aluno_id", selectedAluno);
      }

      const { data } = await query;
      const presencas = data || [];
      setTotalPresencas(presencas.length);

      // Group by month for current year
      const currentYear = new Date().getFullYear();
      const monthCounts: Record<number, number> = {};
      for (let i = 0; i < 12; i++) monthCounts[i] = 0;

      presencas.forEach(p => {
        const date = new Date(p.data_treino);
        if (date.getFullYear() === currentYear) {
          monthCounts[date.getMonth()]++;
        }
      });

      const data_ = MESES.map((mes, i) => ({ mes, presencas: monthCounts[i] }));
      setChartData(data_);
    };
    fetchPresencas();
  }, [ctId, selectedAluno]);

  if (loading) {
    return (
      <ChartCard title="Acompanhamento de presenças" icon={CalendarCheck}>
        <p className="text-muted-foreground text-sm animate-pulse">Carregando...</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Acompanhamento de presenças"
      icon={CalendarCheck}
      subtitle="Leitura mensal do volume de treinos registrados no CT."
      action={
        <div className="flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:w-auto sm:flex-row sm:items-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
            <Users className="h-4 w-4" />
            <span>Total: <strong className="text-foreground">{totalPresencas}</strong></span>
          </div>
          <Select value={selectedAluno} onValueChange={setSelectedAluno}>
            <SelectTrigger className="h-10 w-full rounded-xl bg-secondary border-border text-foreground text-sm sm:h-9 sm:w-[200px]">
              <SelectValue placeholder="Selecione aluno" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border max-h-64">
              <SelectItem value="todos">Todos os alunos</SelectItem>
              {alunos.map(a => (
                <SelectItem key={a.user_id} value={a.user_id}>
                  {a.nome} {a.sobrenome || ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.22} />
            <XAxis
              dataKey="mes"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border) / 0.9)",
                borderRadius: 16,
                color: "hsl(var(--foreground))",
                boxShadow: "0 24px 50px -32px hsl(var(--shadow-color) / 0.6)",
              }}
              formatter={(value: number) => [value, "Presenças"]}
            />
            <Bar dataKey="presencas" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-muted-foreground text-sm text-center py-8">Nenhuma presença registrada.</p>
      )}
    </ChartCard>
  );
};

export default AttendanceChart;
