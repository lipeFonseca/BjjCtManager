import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, UserCheck, UserMinus, Calendar, Clock, Plus, Minus, BellRing, Loader2, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Profile {
  id: string;
  nome: string;
  sobrenome: string | null;
  faixa: string | null;
  user_id: string;
}

interface Horario {
  id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  descricao: string | null;
}

interface Presenca {
  id: string;
  aluno_id: string;
  data_treino: string;
  ct_id: string | null;
}

interface ChamadaSectionProps {
  ctId: string;
  ctNome: string;
  onBack: () => void;
}

interface ActiveCall {
  id: string;
  titulo: string;
  mensagem: string | null;
  expira_em: string;
  status: string;
  horario_aula_id: string | null;
}

const FAIXA_DOT_COLORS: Record<string, string> = {
  branca: "bg-white border border-border",
  cinza: "bg-gray-400",
  amarela: "bg-yellow-400",
  laranja: "bg-orange-500",
  verde: "bg-green-600",
  azul: "bg-blue-600",
  roxa: "bg-purple-600",
  marrom: "bg-amber-800",
  preta: "bg-black border border-white/20",
};

const ChamadaSection = ({ ctId, ctNome, onBack }: ChamadaSectionProps) => {
  const [alunos, setAlunos] = useState<Profile[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState(format(new Date(), "yyyy-MM-dd"));
  const [horarioSelecionado, setHorarioSelecionado] = useState<string>("todos");
  const [saving, setSaving] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [selectedHorarioDisparo, setSelectedHorarioDisparo] = useState<string>("");
  const [triggeringCall, setTriggeringCall] = useState(false);
  const [ctGeoConfigured, setCtGeoConfigured] = useState(false);
  const [ctRadius, setCtRadius] = useState(100);

  // Track checked alunos for batch operations
  const [checkedAlunos, setCheckedAlunos] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, [ctId]);

  useEffect(() => {
    if (!loading) {
      fetchPresencas();
    }
  }, [dataSelecionada]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch alunos (profiles with role aluno in this CT)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nome, sobrenome, faixa, user_id")
      .eq("ct_id", ctId)
      .order("nome");

    if (profiles && profiles.length > 0) {
      const userIds = profiles.map(p => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
      const alunosList = profiles.filter(p => {
        const role = roleMap.get(p.user_id);
        return role === "aluno";
      });
      setAlunos(alunosList);
    } else {
      setAlunos([]);
    }

    // Fetch horarios for this CT
    const { data: horariosData } = await supabase
      .from("horarios_aulas")
      .select("*")
      .eq("ct_id", ctId)
      .order("dia_semana")
      .order("horario_inicio");

    setHorarios((horariosData as any[]) || []);

    const { data: ctData } = await supabase
      .from("centros_treinamento")
      .select("latitude, longitude, raio_presenca_metros")
      .eq("id", ctId)
      .single();

    setCtGeoConfigured(ctData?.latitude != null && ctData?.longitude != null);
    setCtRadius(Number(ctData?.raio_presenca_metros) || 100);

    await fetchActiveCall();

    // Fetch presencas for selected date
    await fetchPresencas();
    setLoading(false);
  };

  const fetchActiveCall = async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("aula_chamadas")
      .select("id, titulo, mensagem, expira_em, status, horario_aula_id")
      .eq("ct_id", ctId)
      .eq("status", "ativa")
      .gt("expira_em", now)
      .order("iniciada_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    setActiveCall(data || null);
  };

  const fetchPresencas = async () => {
    const { data } = await supabase
      .from("presencas")
      .select("*")
      .eq("ct_id", ctId)
      .eq("data_treino", dataSelecionada);

    const presencasList = (data || []) as Presenca[];
    setPresencas(presencasList);

    // Set checked alunos based on existing presencas
    const presentIds = new Set(presencasList.map(p => p.aluno_id));
    setCheckedAlunos(presentIds);
  };

  useEffect(() => {
    const today = new Date(dataSelecionada + "T12:00:00");
    const dayOfWeek = today.getDay();
    const firstHorario = horarios.find((h) => h.dia_semana === dayOfWeek);
    setSelectedHorarioDisparo(firstHorario?.id || "");
  }, [dataSelecionada, horarios]);

  useEffect(() => {
    const channel = supabase
      .channel(`aula-chamadas-mestre-${ctId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aula_chamadas", filter: `ct_id=eq.${ctId}` },
        () => { fetchActiveCall(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ctId]);

  const dispararChamada = async () => {
    setTriggeringCall(true);
    try {
      const selectedHorario = horarios.find((h) => h.id === selectedHorarioDisparo);
      const titulo = selectedHorario
        ? `Chamada liberada: ${selectedHorario.descricao || "Aula"} (${selectedHorario.horario_inicio.slice(0, 5)} - ${selectedHorario.horario_fim.slice(0, 5)})`
        : `Chamada liberada para a aula de hoje`;

      const mensagem = `A aula vai começar. Os alunos devem confirmar presença dentro do raio de ${ctRadius} m do CT.`;

      const { data, error } = await supabase.functions.invoke("disparar-chamada-aula", {
        body: {
          ct_id: ctId,
          horario_aula_id: selectedHorarioDisparo || null,
          titulo,
          mensagem,
          duracao_minutos: 15,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao disparar chamada");
      }

      toast.success("Chamada disparada para os alunos do CT.");
      await fetchActiveCall();
    } catch (error: any) {
      toast.error(error.message || "Erro ao disparar chamada");
    } finally {
      setTriggeringCall(false);
    }
  };

  const encerrarChamadaAtiva = async () => {
    if (!activeCall) return;
    const { error } = await supabase
      .from("aula_chamadas")
      .update({
        status: "encerrada",
        encerrada_em: new Date().toISOString(),
      })
      .eq("id", activeCall.id);

    if (error) {
      toast.error("Erro ao encerrar chamada");
      return;
    }

    toast.success("Chamada encerrada.");
    await fetchActiveCall();
  };

  const isPresent = (alunoUserId: string) => checkedAlunos.has(alunoUserId);

  const togglePresenca = async (alunoUserId: string) => {
    setSaving(true);
    const present = isPresent(alunoUserId);

    if (present) {
      // Remove presença
      const presenca = presencas.find(p => p.aluno_id === alunoUserId);
      if (presenca) {
        const { error } = await supabase
          .from("presencas")
          .delete()
          .eq("id", presenca.id);

        if (error) {
          toast.error("Erro ao remover presença");
        } else {
          setCheckedAlunos(prev => {
            const next = new Set(prev);
            next.delete(alunoUserId);
            return next;
          });
          setPresencas(prev => prev.filter(p => p.id !== presenca.id));
        }
      }
    } else {
      // Add presença
      const { data, error } = await supabase
        .from("presencas")
        .insert({
          aluno_id: alunoUserId,
          ct_id: ctId,
          data_treino: dataSelecionada,
        })
        .select()
        .single();

      if (error) {
        toast.error("Erro ao registrar presença");
      } else {
        setCheckedAlunos(prev => new Set(prev).add(alunoUserId));
        setPresencas(prev => [...prev, data as Presenca]);
      }
    }
    setSaving(false);
  };

  const marcarTodos = async () => {
    setSaving(true);
    const ausentes = alunos.filter(a => !isPresent(a.user_id));
    if (ausentes.length === 0) {
      toast.info("Todos já estão presentes");
      setSaving(false);
      return;
    }

    const inserts = ausentes.map(a => ({
      aluno_id: a.user_id,
      ct_id: ctId,
      data_treino: dataSelecionada,
    }));

    const { data, error } = await supabase
      .from("presencas")
      .insert(inserts)
      .select();

    if (error) {
      toast.error("Erro ao marcar todos");
    } else {
      toast.success(`${ausentes.length} presença(s) registrada(s)`);
      await fetchPresencas();
    }
    setSaving(false);
  };

  const desmarcarTodos = async () => {
    setSaving(true);
    const presentes = presencas.filter(p => alunos.some(a => a.user_id === p.aluno_id));
    if (presentes.length === 0) {
      toast.info("Nenhuma presença para remover");
      setSaving(false);
      return;
    }

    const ids = presentes.map(p => p.id);
    const { error } = await supabase
      .from("presencas")
      .delete()
      .in("id", ids);

    if (error) {
      toast.error("Erro ao desmarcar todos");
    } else {
      toast.success(`${presentes.length} presença(s) removida(s)`);
      await fetchPresencas();
    }
    setSaving(false);
  };

  // Get today's day of week (0=Sunday)
  const selectedDate = new Date(dataSelecionada + "T12:00:00");
  const diaSemana = selectedDate.getDay();
  const horariosHoje = horarios.filter(h => h.dia_semana === diaSemana);
  const isToday = dataSelecionada === format(new Date(), "yyyy-MM-dd");

  const totalAlunos = alunos.length;
  const totalPresentes = checkedAlunos.size;
  const totalAusentes = totalAlunos - totalPresentes;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Carregando chamada...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <div className="mb-6 flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
        <UserCheck className="h-7 w-7 text-primary" />
        <h1 className="font-heading text-3xl uppercase text-foreground">Chamada</h1>
        <span className="text-muted-foreground text-sm">— {ctNome}</span>
      </div>

      {/* Date selector and stats */}
      <div className="glass-card mb-6 rounded-[24px] p-4 sm:rounded-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data</Label>
            <Input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="bg-secondary border-border text-foreground w-44"
            />
          </div>
          {horariosHoje.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Aulas do dia</Label>
              <div className="flex gap-2">
                {horariosHoje.map(h => (
                  <span key={h.id} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {h.horario_inicio.slice(0, 5)} - {h.horario_fim.slice(0, 5)}
                    {h.descricao && <span className="text-muted-foreground ml-1">({h.descricao})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 sm:ml-auto sm:justify-start">
            <div className="text-center">
              <p className="text-lg font-heading text-green-500">{totalPresentes}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Presentes</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-heading text-red-500">{totalAusentes}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Ausentes</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-heading text-foreground">{totalAlunos}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="glass-card mb-4 rounded-[24px] p-4 sm:rounded-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-primary" />
              <p className="font-heading text-sm uppercase text-foreground">Chamada por Notificação</p>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Dispare uma chamada para os alunos confirmarem presença com geolocalização. A presença só será registrada para quem estiver dentro do raio de {ctRadius} m do CT.
            </p>
            {!ctGeoConfigured && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Configure a localização oficial do CT antes de usar esta funcionalidade.
              </div>
            )}
            {!isToday && (
              <div className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
                O disparo de chamada só fica habilitado para a data de hoje.
              </div>
            )}
          </div>

          <div className="w-full max-w-md space-y-3 self-center sm:self-auto">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Horário vinculado à chamada</Label>
              <Select value={selectedHorarioDisparo || "sem-horario"} onValueChange={(value) => setSelectedHorarioDisparo(value === "sem-horario" ? "" : value)}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Selecione a aula" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="sem-horario">Sem horário específico</SelectItem>
                  {horariosHoje.map((horario) => (
                    <SelectItem key={horario.id} value={horario.id}>
                      {(horario.descricao || "Aula")} - {horario.horario_inicio.slice(0, 5)} às {horario.horario_fim.slice(0, 5)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeCall ? (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-medium text-foreground">{activeCall.titulo}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ativa até {new Date(activeCall.expira_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                {activeCall.mensagem && (
                  <p className="text-xs text-muted-foreground mt-2">{activeCall.mensagem}</p>
                )}
                <Button variant="outline" size="sm" className="mt-3" onClick={encerrarChamadaAtiva}>
                  Encerrar chamada ativa
                </Button>
              </div>
            ) : (
              <Button
                onClick={dispararChamada}
                disabled={triggeringCall || !ctGeoConfigured || !isToday}
                className="w-full gap-2 sm:w-auto"
              >
                {triggeringCall ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                {triggeringCall ? "Disparando..." : "Disparar Chamada para os Alunos"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" size="sm" onClick={marcarTodos} disabled={saving} className="gap-1 w-full sm:w-auto">
          <Plus className="h-3.5 w-3.5" /> Marcar Todos
        </Button>
        <Button variant="outline" size="sm" onClick={desmarcarTodos} disabled={saving} className="gap-1 w-full text-destructive hover:text-destructive sm:w-auto">
          <Minus className="h-3.5 w-3.5" /> Desmarcar Todos
        </Button>
        <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground sm:ml-auto sm:justify-start sm:rounded-md sm:py-1">
          <MapPin className="h-3.5 w-3.5" />
          Raio configurado: {ctRadius} m
        </div>
      </div>

      {/* Student list */}
      {alunos.length === 0 ? (
        <div className="glass-card rounded-[24px] p-8 text-center sm:rounded-lg">
          <UserCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhum aluno cadastrado neste CT.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden rounded-[24px] sm:rounded-lg">
          <div className="divide-y divide-border">
            {alunos.map((aluno) => {
              const present = isPresent(aluno.user_id);
              return (
                <button
                  key={aluno.id}
                  onClick={() => togglePresenca(aluno.user_id)}
                  disabled={saving}
                  className={`w-full flex flex-col gap-2 px-5 py-3 text-center transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between sm:text-left ${
                    present ? "bg-green-500/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-center gap-3 sm:justify-start">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${FAIXA_DOT_COLORS[aluno.faixa || "branca"] || "bg-secondary"}`} />
                    <span className="text-foreground text-sm font-medium">
                      {aluno.nome} {aluno.sobrenome || ""}
                    </span>
                    <span className="text-muted-foreground text-xs capitalize">{aluno.faixa || "branca"}</span>
                  </div>
                  <div className={`flex items-center justify-center gap-2 text-sm font-medium ${present ? "text-green-500" : "text-muted-foreground"}`}>
                    {present ? (
                      <>
                        <UserCheck className="h-4 w-4" />
                        <span>Presente</span>
                      </>
                    ) : (
                      <>
                        <UserMinus className="h-4 w-4" />
                        <span>Ausente</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChamadaSection;
