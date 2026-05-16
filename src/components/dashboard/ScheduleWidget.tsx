import { useEffect, useState } from "react";
import FaixaBadge from "./FaixaBadge";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ChevronDown, Check, UserCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ChartCard from "./ChartCard";

interface Horario {
  id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  descricao: string | null;
}

interface AlunoProfile {
  id: string;
  user_id: string;
  nome: string;
  sobrenome: string | null;
  faixa: string | null;
  grau: number;
}

const DIAS_SEMANA = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const DIAS_SEMANA_FULL: Record<number, string> = {
  0: "Domingo", 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado",
};

const getFaixaColor = (faixa: string | null) => {
  const colors: Record<string, string> = {
    branca: "bg-white text-black", cinza: "bg-gray-400 text-black", amarela: "bg-yellow-400 text-black",
    laranja: "bg-orange-500 text-white", verde: "bg-green-600 text-white", azul: "bg-blue-600 text-white",
    roxa: "bg-purple-600 text-white", marrom: "bg-amber-800 text-white", preta: "bg-black text-white border border-white/20",
  };
  return colors[faixa || "branca"] || "bg-secondary text-foreground";
};

interface ScheduleWidgetProps {
  ctId: string;
  showAttendance?: boolean;
}

const ScheduleWidget = ({ ctId, showAttendance = false }: ScheduleWidgetProps) => {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [alunos, setAlunos] = useState<AlunoProfile[]>([]);
  const [presencasByDate, setPresencasByDate] = useState<Record<string, Set<string>>>({});
  const [savingPresenca, setSavingPresenca] = useState(false);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [selectedDates, setSelectedDates] = useState<Record<number, string>>({});
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  });

  const todayStr = new Date().toISOString().split("T")[0];

  // Get the date for a given day of week within the selected month's current/nearest week
  const getDateForDayInMonth = (dayOfWeek: number): string => {
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const today = new Date();
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth()).padStart(2, "0")}`;
    
    if (selectedMonth === todayMonth) {
      // Current month: use the most recent occurrence
      const currentDay = today.getDay();
      let diff = currentDay - dayOfWeek;
      if (diff < 0) diff += 7;
      const target = new Date(today);
      target.setDate(today.getDate() - diff);
      return target.toISOString().split("T")[0];
    } else {
      // Other month: find the first occurrence of this day in that month
      const firstOfMonth = new Date(year, month, 1);
      const firstDow = firstOfMonth.getDay();
      let diff = dayOfWeek - firstDow;
      if (diff < 0) diff += 7;
      const target = new Date(year, month, 1 + diff);
      return target.toISOString().split("T")[0];
    }
  };

  const getSelectedDate = (dayOfWeek: number): string => {
    return selectedDates[dayOfWeek] || getDateForDayInMonth(dayOfWeek);
  };

  const getPresencasForDate = (dateStr: string): Set<string> => {
    return presencasByDate[dateStr] || new Set();
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("horarios_aulas")
        .select("id, dia_semana, horario_inicio, horario_fim, descricao")
        .eq("ct_id", ctId)
        .order("dia_semana")
        .order("horario_inicio");
      setHorarios((data as Horario[]) || []);

      if (showAttendance) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_id, nome, sobrenome, faixa")
          .eq("ct_id", ctId);

        if (profiles && profiles.length > 0) {
          const userIds = profiles.map(p => p.user_id);
          const { data: roles } = await supabase
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", userIds);

          const mestreIds = new Set((roles || []).filter(r => r.role === "mestre").map(r => r.user_id));
          const alunoProfiles = (profiles as AlunoProfile[]).filter(p => !mestreIds.has(p.user_id));
          setAlunos(alunoProfiles.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [ctId, showAttendance]);

  const fetchPresencasForDate = async (dateStr: string) => {
    const { data: presencas } = await supabase
      .from("presencas")
      .select("aluno_id")
      .eq("ct_id", ctId)
      .eq("data_treino", dateStr);
    setPresencasByDate(prev => ({
      ...prev,
      [dateStr]: new Set((presencas || []).map(p => p.aluno_id)),
    }));
  };

  // Fetch attendance when a day is opened
  useEffect(() => {
    if (openDay !== null && showAttendance) {
      const dateStr = getSelectedDate(openDay);
      fetchPresencasForDate(dateStr);
    }
  }, [openDay, selectedDates]);

  const togglePresenca = async (alunoUserId: string, dateStr: string) => {
    setSavingPresenca(true);
    const presencas = getPresencasForDate(dateStr);
    const isPresent = presencas.has(alunoUserId);

    if (isPresent) {
      const { error } = await supabase
        .from("presencas")
        .delete()
        .eq("aluno_id", alunoUserId)
        .eq("ct_id", ctId)
        .eq("data_treino", dateStr);
      if (error) { toast.error("Erro ao remover presença"); setSavingPresenca(false); return; }
      setPresencasByDate(prev => {
        const n = new Set(prev[dateStr]);
        n.delete(alunoUserId);
        return { ...prev, [dateStr]: n };
      });
    } else {
      const { error } = await supabase
        .from("presencas")
        .insert({ aluno_id: alunoUserId, ct_id: ctId, data_treino: dateStr });
      if (error) { toast.error("Erro ao registrar presença"); setSavingPresenca(false); return; }
      setPresencasByDate(prev => ({
        ...prev,
        [dateStr]: new Set(prev[dateStr]).add(alunoUserId),
      }));
    }
    setSavingPresenca(false);
  };

  const markAllPresent = async (dateStr: string) => {
    setSavingPresenca(true);
    const presencas = getPresencasForDate(dateStr);
    const notPresent = alunos.filter(a => !presencas.has(a.user_id));
    if (notPresent.length === 0) { setSavingPresenca(false); return; }

    const inserts = notPresent.map(a => ({ aluno_id: a.user_id, ct_id: ctId, data_treino: dateStr }));
    const { error } = await supabase.from("presencas").insert(inserts);
    if (error) { toast.error("Erro ao registrar presenças"); setSavingPresenca(false); return; }
    setPresencasByDate(prev => ({
      ...prev,
      [dateStr]: new Set(alunos.map(a => a.user_id)),
    }));
    toast.success("Todos marcados como presentes!");
    setSavingPresenca(false);
  };

  if (loading) {
    return (
      <ChartCard title="Quadro de horários" icon={Clock}>
        <p className="text-muted-foreground text-sm animate-pulse">Carregando...</p>
      </ChartCard>
    );
  }

  if (horarios.length === 0) {
    return (
      <ChartCard title="Quadro de horários" icon={Clock}>
        <div className="text-center py-6">
          <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhum horário cadastrado.</p>
        </div>
      </ChartCard>
    );
  }

  const today = new Date().getDay();
  const daysWithClasses = DIAS_SEMANA.filter(d => horarios.some(h => h.dia_semana === d.value));

  // Generate month options (current month + 6 months forward)
  const monthOptions: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    monthOptions.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    setSelectedDates({});
    setOpenDay(null);
  };

  return (
    <ChartCard
      title="Quadro de horários"
      icon={Clock}
      subtitle="Calendário operacional com presença, aulas e navegação mensal."
      action={
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="h-10 w-full max-w-sm rounded-xl text-sm sm:h-9 sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >

      <div className="grid gap-3">
        {daysWithClasses.map((dia) => {
          const dayHorarios = horarios.filter(h => h.dia_semana === dia.value);
          const isToday = dia.value === today;
          const isOpen = openDay === dia.value;
          const dateStr = getSelectedDate(dia.value);
          const presencas = getPresencasForDate(dateStr);
          const isSelectedToday = dateStr === todayStr;

          const changeDate = (offset: number) => {
            const current = new Date(dateStr + "T12:00:00");
            current.setDate(current.getDate() + (offset * 7));
            const newDate = current.toISOString().split("T")[0];
            setSelectedDates(prev => ({ ...prev, [dia.value]: newDate }));
          };

          return (
            <div key={dia.value}>
              <div
                className={`rounded-md border transition-colors ${
                  isToday
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card/50"
                }`}
              >
                <div
                  className={`flex items-start gap-3 px-4 py-3 sm:gap-4 ${showAttendance ? "cursor-pointer" : ""}`}
                  onClick={() => showAttendance && setOpenDay(isOpen ? null : dia.value)}
                >
                    <div className={`min-w-[52px] pt-0.5 text-center font-heading text-sm uppercase tracking-wider sm:min-w-fit sm:text-left ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    <div>{dia.label}</div>
                    <div className="text-[10px] font-normal">{new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR")}</div>
                    {isToday && <span className="block text-[10px] text-primary/70">Hoje</span>}
                  </div>
                  <div className="flex-1 flex flex-wrap gap-2 justify-center sm:justify-start">
                    {dayHorarios.map((h) => (
                      <div
                        key={h.id}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                          isToday
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <span>{h.horario_inicio.slice(0, 5)} - {h.horario_fim.slice(0, 5)}</span>
                        {h.descricao && (
                          <span className="text-muted-foreground ml-1">· {h.descricao}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {showAttendance && (
                    <div className="flex items-center gap-2">
                      {isOpen && (
                        <span className="text-xs text-primary font-medium">
                          {presencas.size}/{alunos.length}
                        </span>
                      )}
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  )}
                </div>

                {/* Attendance dropdown - now available for any day */}
                {showAttendance && isOpen && (
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center justify-center gap-2 sm:justify-start">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); changeDate(-1); }}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <p className={`text-xs uppercase tracking-wider font-heading ${isSelectedToday ? "text-primary" : "text-muted-foreground"}`}>
                          Chamada — {DIAS_SEMANA_FULL[dia.value]} ({dateStr})
                          {isSelectedToday && <span className="ml-1 text-primary/70">(Hoje)</span>}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); changeDate(1); }}
                          disabled={dateStr >= todayStr}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-xs sm:h-7 sm:w-auto"
                        onClick={(e) => { e.stopPropagation(); markAllPresent(dateStr); }}
                        disabled={savingPresenca}
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" /> Todos presentes
                      </Button>
                    </div>
                    {alunos.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhum aluno cadastrado neste CT.</p>
                    ) : (
                      <div className="grid gap-2 max-h-64 overflow-y-auto">
                        {alunos.map(a => (
                          <label
                            key={a.user_id}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors ${
                              presencas.has(a.user_id)
                                ? "bg-primary/10 border border-primary/30"
                                : "bg-card/80 border border-border hover:bg-muted/50"
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={presencas.has(a.user_id)}
                              onCheckedChange={() => togglePresenca(a.user_id, dateStr)}
                              disabled={savingPresenca}
                            />
                            <FaixaBadge faixa={a.faixa || "branca"} grau={a.grau} size="sm" />
                            <span className="text-foreground text-sm flex-1">
                              {a.nome} {a.sobrenome || ""}
                            </span>
                            {presencas.has(a.user_id) && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
};

export default ScheduleWidget;
