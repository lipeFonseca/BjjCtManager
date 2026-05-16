import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Clock, Calendar } from "lucide-react";

interface Horario {
  id: string;
  ct_id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  descricao: string | null;
  created_by: string;
}

interface HorariosSectionProps {
  role: "admin" | "mestre" | "aluno";
  userId: string;
  ctId?: string; // For admin viewing a specific CT
}

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const HorariosSection = ({ role, userId, ctId }: HorariosSectionProps) => {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userCtId, setUserCtId] = useState<string | null>(ctId || null);
  const [currentUserId, setCurrentUserId] = useState<string>(userId);

  const [diaSemana, setDiaSemana] = useState<number>(1);
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("09:00");
  const [descricao, setDescricao] = useState("");

  const canEdit = role === "admin" || role === "mestre";

  useEffect(() => {
    const init = async () => {
      // Get current user ID if not provided
      let uid = userId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || "";
        setCurrentUserId(uid);
      }

      let targetCtId = ctId;
      if (!targetCtId && role !== "admin") {
        const { data } = await supabase
          .from("profiles")
          .select("ct_id")
          .eq("user_id", uid)
          .single();
        targetCtId = data?.ct_id || null;
        setUserCtId(targetCtId);
      }
      if (targetCtId) {
        await fetchHorarios(targetCtId);
      }
      setLoading(false);
    };
    init();
  }, [ctId, userId, role]);

  const fetchHorarios = async (targetCtId: string) => {
    const { data, error } = await supabase
      .from("horarios_aulas")
      .select("*")
      .eq("ct_id", targetCtId)
      .order("dia_semana")
      .order("horario_inicio");

    if (error) {
      console.error("Error fetching horarios:", error);
      return;
    }
    setHorarios((data as any[]) || []);
  };

  const resetForm = () => {
    setDiaSemana(1);
    setHorarioInicio("08:00");
    setHorarioFim("09:00");
    setDescricao("");
    setEditingId(null);
  };

  const handleSave = async () => {
    const targetCt = ctId || userCtId;
    if (!targetCt) {
      toast.error("CT não identificado");
      return;
    }

    if (horarioInicio >= horarioFim) {
      toast.error("O horário de início deve ser antes do fim");
      return;
    }

    const payload = {
      ct_id: targetCt,
      dia_semana: diaSemana,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      descricao: descricao || null,
      created_by: currentUserId,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("horarios_aulas")
        .update(payload)
        .eq("id", editingId));
    } else {
      ({ error } = await supabase
        .from("horarios_aulas")
        .insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar horário");
      console.error(error);
      return;
    }

    toast.success(editingId ? "Horário atualizado" : "Horário adicionado");
    resetForm();
    setDialogOpen(false);
    await fetchHorarios(targetCt);
  };

  const handleEdit = (h: Horario) => {
    setEditingId(h.id);
    setDiaSemana(h.dia_semana);
    setHorarioInicio(h.horario_inicio.slice(0, 5));
    setHorarioFim(h.horario_fim.slice(0, 5));
    setDescricao(h.descricao || "");
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const targetCt = ctId || userCtId;
    const { error } = await supabase.from("horarios_aulas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir horário");
      return;
    }
    toast.success("Horário excluído");
    if (targetCt) await fetchHorarios(targetCt);
  };

  // Group horarios by day
  const horariosByDay = DIAS_SEMANA.map((dia) => ({
    ...dia,
    horarios: horarios.filter((h) => h.dia_semana === dia.value),
  })).filter((dia) => dia.horarios.length > 0 || canEdit);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Carregando horários...</div>
      </div>
    );
  }

  if (!ctId && !userCtId && role !== "admin") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Você não está vinculado a um Centro de Treinamento.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-3">
          <Calendar className="h-7 w-7 text-primary" />
          <h1 className="font-heading text-3xl uppercase text-foreground">Quadro de Horários</h1>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2 sm:w-auto">
                <Plus className="h-4 w-4" /> Novo Horário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Horário" : "Novo Horário"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Dia da Semana</Label>
                  <Select value={String(diaSemana)} onValueChange={(v) => setDiaSemana(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Início</Label>
                    <Input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Turma iniciantes, Competição..." />
                </div>
                <Button onClick={handleSave} className="w-full">
                  {editingId ? "Salvar Alterações" : "Adicionar Horário"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {horarios.length === 0 ? (
        <div className="glass-card rounded-[24px] p-8 text-center sm:rounded-lg">
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhum horário cadastrado ainda.</p>
          {canEdit && <p className="text-muted-foreground text-sm mt-1">Clique em "Novo Horário" para começar.</p>}
        </div>
      ) : (
        <div className="grid gap-4">
          {horariosByDay.map((dia) => (
            <div key={dia.value} className="glass-card overflow-hidden rounded-[24px] sm:rounded-lg">
              <div className="bg-primary/10 px-5 py-3 border-b border-border">
                <h3 className="font-heading text-sm uppercase tracking-wider text-primary">{dia.label}</h3>
              </div>
              {dia.horarios.length === 0 ? (
                <div className="px-5 py-4 text-muted-foreground text-sm">Sem aulas neste dia</div>
              ) : (
                <div className="divide-y divide-border">
                  {dia.horarios.map((h) => (
                    <div key={h.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex items-center gap-2 text-foreground font-medium sm:min-w-[120px]">
                          <Clock className="h-4 w-4 text-primary" />
                          {h.horario_inicio.slice(0, 5)} - {h.horario_fim.slice(0, 5)}
                        </div>
                        {h.descricao && (
                          <span className="text-muted-foreground text-sm">{h.descricao}</span>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex justify-center gap-2 sm:gap-1">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl sm:h-8 sm:w-8" onClick={() => handleEdit(h)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive hover:text-destructive sm:h-8 sm:w-8" onClick={() => handleDelete(h.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HorariosSection;
