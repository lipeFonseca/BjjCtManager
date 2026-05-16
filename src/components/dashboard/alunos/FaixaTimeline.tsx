import { useState, useEffect } from "react";
import FaixaBadge from "../FaixaBadge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Award } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FaixaHistorico {
  id: string;
  faixa_nova: string;
  faixa_anterior: string | null;
  grau_novo: number;
  grau_anterior: number | null;
  data_graduacao: string;
  observacoes: string | null;
  created_at: string;
}

interface FaixaTimelineProps {
  alunoId: string;
  ctId: string | null;
  canEdit: boolean;
  currentFaixa: string | null;
  currentGrau: number;
  onFaixaUpdated?: (novaFaixa: string, novoGrau: number) => void;
}

const faixas = Constants.public.Enums.faixa_tipo.filter(f => f !== "coral" && f !== "vermelha");

const FaixaTimeline = ({ alunoId, ctId, canEdit, currentFaixa, currentGrau, onFaixaUpdated }: FaixaTimelineProps) => {
  const [historico, setHistorico] = useState<FaixaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [novaFaixa, setNovaFaixa] = useState("");
  const [novoGrau, setNovoGrau] = useState<number>(0);
  const [dataGraduacao, setDataGraduacao] = useState(new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");

  const fetchHistorico = async () => {
    const { data, error } = await supabase
      .from("faixa_historico")
      .select("*")
      .eq("aluno_id", alunoId)
      .order("data_graduacao", { ascending: false });

    if (error) {
      console.error("Error fetching historico:", error);
    } else {
      setHistorico((data as FaixaHistorico[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistorico();
  }, [alunoId]);

  const handleAddGraduacao = async () => {
    if (!novaFaixa) {
      toast.error("Selecione a nova faixa");
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("faixa_historico").insert({
      aluno_id: alunoId,
      faixa_nova: novaFaixa as any,
      faixa_anterior: currentFaixa as any || null,
      grau_novo: novoGrau,
      grau_anterior: currentGrau,
      data_graduacao: dataGraduacao,
      observacoes: observacoes || null,
      ct_id: ctId,
      registrado_por: userData.user?.id || null,
    });

    if (error) {
      toast.error("Erro ao registrar graduação: " + error.message);
    } else {
      // Update profile with new faixa and grau
      await supabase.from("profiles").update({ faixa: novaFaixa as any, grau: novoGrau } as any).eq("user_id", alunoId);
      toast.success("Graduação registrada!");
      setShowForm(false);
      setNovaFaixa("");
      setNovoGrau(0);
      setObservacoes("");
      fetchHistorico();
      onFaixaUpdated?.(novaFaixa, novoGrau);
    }
    setSaving(false);
  };

  const getFaixaColor = (faixa: string) => {
    const colors: Record<string, string> = {
      branca: "bg-white text-black border border-border",
      cinza: "bg-gray-400 text-black",
      amarela: "bg-yellow-400 text-black",
      laranja: "bg-orange-500 text-white",
      verde: "bg-green-600 text-white",
      azul: "bg-blue-600 text-white",
      roxa: "bg-purple-600 text-white",
      marrom: "bg-amber-800 text-white",
      preta: "bg-black text-white border border-border",
    };
    return colors[faixa] || "bg-secondary text-foreground";
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm">Carregando histórico...</p>;
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Cancelar" : "Registrar Graduação"}
          </Button>
        </div>
      )}

      {showForm && (
        <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Nova Faixa</Label>
              <Select value={novaFaixa} onValueChange={setNovaFaixa}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {faixas.map((f) => (
                    <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Grau</Label>
              <Select value={String(novoGrau)} onValueChange={(v) => setNovoGrau(Number(v))}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {[0,1,2,3,4,5,6,7,8,9,10].map((g) => (
                    <SelectItem key={g} value={String(g)}>{g}º Grau</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Data da Graduação</Label>
              <Input
                type="date"
                value={dataGraduacao}
                onChange={(e) => setDataGraduacao(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Observações (opcional)</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Exame realizado no evento X..."
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <Button onClick={handleAddGraduacao} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Registrar Graduação"}
          </Button>
        </div>
      )}

      {historico.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhuma graduação registrada</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {historico.map((h, index) => (
              <div key={h.id} className="relative pl-10">
                <div className={`absolute left-2 w-5 h-5 rounded-full ${getFaixaColor(h.faixa_nova)} flex items-center justify-center`}>
                  <div className="w-2 h-2 rounded-full bg-current opacity-50" />
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                  <div className="flex items-center justify-between">
                    <FaixaBadge faixa={h.faixa_nova} grau={h.grau_novo} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(h.data_graduacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  {h.faixa_anterior && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Anterior: <span className="capitalize">{h.faixa_anterior}{h.grau_anterior ? ` ${h.grau_anterior}º` : ""}</span>
                    </p>
                  )}
                  {h.observacoes && (
                    <p className="text-sm text-foreground/80 mt-2">{h.observacoes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FaixaTimeline;
