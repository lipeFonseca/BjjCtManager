import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingUp, Award, Clock } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EstatisticasTabProps {
  alunoId: string;
  alunoNome: string;
}

interface Stats {
  totalPresencas: number;
  presencasMes: number;
  totalGraduacoes: number;
  diasDesdeUltimaGraduacao: number | null;
  presencasPorMes: { mes: string; total: number }[];
}

const EstatisticasTab = ({ alunoId, alunoNome }: EstatisticasTabProps) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date();
      const inicioMes = startOfMonth(now);
      const fimMes = endOfMonth(now);

      // Total presenças
      const { count: totalPresencas } = await supabase
        .from("presencas")
        .select("*", { count: "exact", head: true })
        .eq("aluno_id", alunoId);

      // Presenças do mês
      const { count: presencasMes } = await supabase
        .from("presencas")
        .select("*", { count: "exact", head: true })
        .eq("aluno_id", alunoId)
        .gte("data_treino", inicioMes.toISOString())
        .lte("data_treino", fimMes.toISOString());

      // Total graduações
      const { count: totalGraduacoes } = await supabase
        .from("faixa_historico")
        .select("*", { count: "exact", head: true })
        .eq("aluno_id", alunoId);

      // Última graduação
      const { data: ultimaGraduacao } = await supabase
        .from("faixa_historico")
        .select("data_graduacao")
        .eq("aluno_id", alunoId)
        .order("data_graduacao", { ascending: false })
        .limit(1);

      let diasDesdeUltimaGraduacao: number | null = null;
      if (ultimaGraduacao && ultimaGraduacao.length > 0) {
        diasDesdeUltimaGraduacao = differenceInDays(now, new Date(ultimaGraduacao[0].data_graduacao));
      }

      // Presenças por mês (últimos 6 meses)
      const presencasPorMes: { mes: string; total: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const mesRef = subMonths(now, i);
        const inicio = startOfMonth(mesRef);
        const fim = endOfMonth(mesRef);

        const { count } = await supabase
          .from("presencas")
          .select("*", { count: "exact", head: true })
          .eq("aluno_id", alunoId)
          .gte("data_treino", inicio.toISOString())
          .lte("data_treino", fim.toISOString());

        presencasPorMes.push({
          mes: format(mesRef, "MMM", { locale: ptBR }),
          total: count || 0,
        });
      }

      setStats({
        totalPresencas: totalPresencas || 0,
        presencasMes: presencasMes || 0,
        totalGraduacoes: totalGraduacoes || 0,
        diasDesdeUltimaGraduacao,
        presencasPorMes,
      });
      setLoading(false);
    };

    fetchStats();
  }, [alunoId]);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Carregando estatísticas...</p>;
  }

  if (!stats) {
    return <p className="text-muted-foreground text-sm">Erro ao carregar estatísticas</p>;
  }

  const maxPresencas = Math.max(...stats.presencasPorMes.map((p) => p.total), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-secondary/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Presenças (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats.presencasMes}</p>
          </CardContent>
        </Card>

        <Card className="bg-secondary/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Presenças
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats.totalPresencas}</p>
          </CardContent>
        </Card>

        <Card className="bg-secondary/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              Graduações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats.totalGraduacoes}</p>
          </CardContent>
        </Card>

        <Card className="bg-secondary/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Última Graduação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {stats.diasDesdeUltimaGraduacao !== null ? `${stats.diasDesdeUltimaGraduacao}d` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-secondary/50 border-border">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            Frequência (últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-24">
            {stats.presencasPorMes.map((p, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary rounded-t transition-all"
                  style={{
                    height: `${(p.total / maxPresencas) * 100}%`,
                    minHeight: p.total > 0 ? "4px" : "0px",
                  }}
                />
                <span className="text-xs text-muted-foreground capitalize">{p.mes}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstatisticasTab;
