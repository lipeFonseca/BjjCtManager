import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MetricasConfigTab from "./MetricasConfigTab";
import NotasAlunosTab from "./NotasAlunosTab";
import AlunosElegiveisTab from "./AlunosElegiveisTab";
import ProgressoAlunoTab from "./ProgressoAlunoTab";
import MetricasDashboardTab from "./MetricasDashboardTab";
import TempoGraduacaoTab from "./TempoGraduacaoTab";

interface Props {
  ctId: string;
  role: "admin" | "mestre" | "aluno";
  userId: string;
}

const DEFAULT_METRICAS = ["Frequência", "Técnica", "Boa Conduta", "Respeito"];

const MetricasGraduacaoSection = ({ ctId, role, userId: propUserId }: Props) => {
  const [activeTab, setActiveTab] = useState("notas");
  const [refreshKey, setRefreshKey] = useState(0);
  const [userId, setUserId] = useState(propUserId);
  const [seeding, setSeeding] = useState(true);

  useEffect(() => {
    if (!propUserId) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setUserId(data.session.user.id);
      });
    }
  }, [propUserId]);

  // Seed default metrics if none exist
  useEffect(() => {
    const seedDefaults = async () => {
      const { data } = await supabase
        .from("metricas_graduacao")
        .select("id")
        .eq("ct_id", ctId)
        .limit(1);

      if (!data || data.length === 0) {
        const uid = userId || propUserId;
        if (!uid) { setSeeding(false); return; }
        const inserts = DEFAULT_METRICAS.map((nome) => ({
          ct_id: ctId,
          nome,
          valor_meta: 10,
          ativo: true,
          created_by: uid,
          faixa_origem: "branca" as const,
          faixa_destino: "azul" as const,
          tipo_metrica: nome,
          classe: "adulto",
        }));
        await supabase.from("metricas_graduacao").insert(inserts as any);
        setRefreshKey((k) => k + 1);
      }
      setSeeding(false);
    };
    if (ctId && (userId || propUserId)) seedDefaults();
  }, [ctId, userId, propUserId]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const isAluno = role === "aluno";

  if (seeding) return <div className="text-muted-foreground p-4">Carregando...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl uppercase text-foreground">
          📊 Métricas de Graduação
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAluno
            ? "Acompanhe suas notas rumo à próxima graduação."
            : "Atribua notas de 0 a 10 para cada aluno e acompanhe a elegibilidade."}
        </p>
      </div>

      {isAluno ? (
        <ProgressoAlunoTab ctId={ctId} userId={userId} refreshKey={refreshKey} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="notas">Notas por Aula</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="config">Métricas</TabsTrigger>
            <TabsTrigger value="tempo">Tempo de Graduação</TabsTrigger>
            <TabsTrigger value="elegiveis">Elegíveis</TabsTrigger>
          </TabsList>

          <TabsContent value="notas">
            <NotasAlunosTab ctId={ctId} refreshKey={refreshKey} onRefresh={refresh} />
          </TabsContent>

          <TabsContent value="dashboard">
            <MetricasDashboardTab ctId={ctId} refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="config">
            <MetricasConfigTab ctId={ctId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
          </TabsContent>

          <TabsContent value="tempo">
            <TempoGraduacaoTab ctId={ctId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
          </TabsContent>

          <TabsContent value="elegiveis">
            <AlunosElegiveisTab ctId={ctId} refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default MetricasGraduacaoSection;
