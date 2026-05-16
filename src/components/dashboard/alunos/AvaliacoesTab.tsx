import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Avaliacao {
  id: string;
  nota_tecnica: number;
  nota_frequencia: number;
  nota_disciplina: number;
  observacoes: string | null;
  created_at: string;
  avaliador_id: string;
}

interface AvaliacoesTabProps {
  alunoId: string;
  canEdit: boolean;
}

const AvaliacoesTab = ({ alunoId, canEdit }: AvaliacoesTabProps) => {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [notaTecnica, setNotaTecnica] = useState(5);
  const [notaFrequencia, setNotaFrequencia] = useState(5);
  const [notaDisciplina, setNotaDisciplina] = useState(5);
  const [observacoes, setObservacoes] = useState("");

  const fetchAvaliacoes = async () => {
    const { data, error } = await supabase
      .from("avaliacoes")
      .select("*")
      .eq("aluno_id", alunoId)
      .order("created_at", { ascending: false });

    if (!error) setAvaliacoes((data as Avaliacao[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void fetchAvaliacoes();
  }, [alunoId]);

  const handleSave = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Usuario nao autenticado");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("avaliacoes").insert({
      aluno_id: alunoId,
      avaliador_id: user.id,
      nota_tecnica: notaTecnica,
      nota_frequencia: notaFrequencia,
      nota_disciplina: notaDisciplina,
      observacoes: observacoes || null,
    } as any);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Avaliacao salva!");
      setDialogOpen(false);
      resetForm();
      void fetchAvaliacoes();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setNotaTecnica(5);
    setNotaFrequencia(5);
    setNotaDisciplina(5);
    setObservacoes("");
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-red-500";
  };

  const getAvgScore = (avaliacao: Avaliacao) =>
    ((avaliacao.nota_tecnica + avaliacao.nota_frequencia + avaliacao.nota_disciplina) / 3).toFixed(1);

  const ScoreInput = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
  }) => (
    <div className="space-y-2">
      <Label className="flex justify-between text-foreground">
        {label} <span className={`font-bold ${getScoreColor(value)}`}>{value}</span>
      </Label>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );

  if (loading) return <p className="text-sm text-muted-foreground">Carregando avaliacoes...</p>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="default">
              <Plus className="mr-2 h-4 w-4" /> Nova Avaliacao
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground">Nova Avaliacao</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <ScoreInput label="Tecnica" value={notaTecnica} onChange={setNotaTecnica} />
              <ScoreInput label="Frequencia" value={notaFrequencia} onChange={setNotaFrequencia} />
              <ScoreInput label="Disciplina" value={notaDisciplina} onChange={setNotaDisciplina} />

              <div className="space-y-2">
                <Label className="text-foreground">Observacoes (opcional)</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observacoes sobre o desempenho do aluno..."
                  className="border-border bg-secondary text-foreground"
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Salvando..." : "Salvar Avaliacao"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {avaliacoes.length === 0 ? (
        <div className="py-8 text-center">
          <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma avaliacao registrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {avaliacoes.map((avaliacao) => (
            <div key={avaliacao.id} className="glass-card space-y-3 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {new Date(avaliacao.created_at).toLocaleDateString("pt-BR")}
                </span>
                <span className={`text-lg font-bold ${getScoreColor(Number(getAvgScore(avaliacao)))}`}>
                  Media: {getAvgScore(avaliacao)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Tecnica", value: avaliacao.nota_tecnica },
                  { label: "Frequencia", value: avaliacao.nota_frequencia },
                  { label: "Disciplina", value: avaliacao.nota_disciplina },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className={`text-xl font-bold ${getScoreColor(value)}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {avaliacao.observacoes && <p className="text-sm italic text-muted-foreground">"{avaliacao.observacoes}"</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvaliacoesTab;
