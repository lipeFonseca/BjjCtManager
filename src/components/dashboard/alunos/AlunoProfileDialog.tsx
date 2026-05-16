import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Award, FileText, TrendingUp, Star } from "lucide-react";
import FaixaTimeline from "./FaixaTimeline";
import FaixaBadge from "../FaixaBadge";
import DocumentosTab from "./DocumentosTab";
import EstatisticasTab from "./EstatisticasTab";
import AvaliacoesTab from "./AvaliacoesTab";

interface Aluno {
  id: string;
  nome: string;
  sobrenome: string | null;
  telefone: string | null;
  faixa: string | null;
  grau: number;
  sexo: string | null;
  email: string | null;
  ct_id: string | null;
  user_id: string;
  username: string;
}

interface AlunoProfileDialogProps {
  aluno: Aluno | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onAlunoUpdated?: (alunoId: string, novaFaixa: string, novoGrau: number) => void;
}

const AlunoProfileDialog = ({ aluno, open, onOpenChange, canEdit, onAlunoUpdated }: AlunoProfileDialogProps) => {
  const [currentFaixa, setCurrentFaixa] = useState<string | null>(aluno?.faixa || null);
  const [currentGrau, setCurrentGrau] = useState<number>(aluno?.grau || 0);

  useEffect(() => {
    setCurrentFaixa(aluno?.faixa || null);
    setCurrentGrau(aluno?.grau || 0);
  }, [aluno]);

  if (!aluno) return null;

  const handleFaixaUpdated = (novaFaixa: string, novoGrau: number) => {
    setCurrentFaixa(novaFaixa);
    setCurrentGrau(novoGrau);
    onAlunoUpdated?.(aluno.user_id, novaFaixa, novoGrau);
  };

  const faixaLabel = currentFaixa || "branca";
  const grausLabel = currentGrau === 1 ? "1 grau" : `${currentGrau} graus`;

  const getFaixaColor = (faixa: string | null) => {
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
    return colors[faixa || "branca"] || "bg-secondary text-foreground";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-left text-foreground">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getFaixaColor(currentFaixa)}`}>
              <User className="h-5 w-5" />
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-1">
              <span className="truncate font-heading text-xl leading-none">
                {aluno.nome} {aluno.sobrenome || ""}
              </span>
              <div className="flex items-center gap-2">
                <FaixaBadge faixa={currentFaixa} grau={currentGrau} size="sm" className="shrink-0" />
                <span className="text-sm text-muted-foreground">
                  <span className="capitalize text-foreground/90">{faixaLabel}</span>
                  {" • "}
                  {grausLabel}
                </span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="historico" className="mt-4">
          <TabsList className="grid w-full grid-cols-4 bg-secondary">
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span className="hidden sm:inline">Graduações</span>
            </TabsTrigger>
            <TabsTrigger value="avaliacoes" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Avaliações</span>
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documentos</span>
            </TabsTrigger>
            <TabsTrigger value="estatisticas" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Estatísticas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="mt-4">
            <FaixaTimeline alunoId={aluno.user_id} ctId={aluno.ct_id} canEdit={canEdit} currentFaixa={currentFaixa} currentGrau={currentGrau} onFaixaUpdated={handleFaixaUpdated} />
          </TabsContent>

          <TabsContent value="avaliacoes" className="mt-4">
            <AvaliacoesTab alunoId={aluno.user_id} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="documentos" className="mt-4">
            <DocumentosTab alunoId={aluno.user_id} ctId={aluno.ct_id} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="estatisticas" className="mt-4">
            <EstatisticasTab alunoId={aluno.user_id} alunoNome={aluno.nome} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AlunoProfileDialog;
