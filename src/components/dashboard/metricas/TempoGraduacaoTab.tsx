import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CLASSE_OPTIONS, getFaixaOrder, getNextFaixa } from "./faixaConfig";
import { FaixaBadge } from "../FaixaBadge";

interface Props {
  ctId: string;
  userId: string;
  refreshKey: number;
  onRefresh: () => void;
}

interface TempoRow {
  id?: string;
  faixa_origem: string;
  faixa_destino: string;
  meses: number;
}

const TempoGraduacaoTab = ({ ctId, userId, refreshKey, onRefresh }: Props) => {
  const [classe, setClasse] = useState("adulto");
  const [rows, setRows] = useState<TempoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const faixas = getFaixaOrder(classe);
      
      const { data } = await supabase
        .from("tempo_graduacao")
        .select("id, faixa_origem, faixa_destino, meses")
        .eq("ct_id", ctId)
        .eq("classe", classe) as any;

      const existing = (data || []) as TempoRow[];
      
      // Build rows for each transition
      const transitionRows: TempoRow[] = [];
      for (let i = 0; i < faixas.length - 1; i++) {
        const origem = faixas[i];
        const destino = faixas[i + 1];
        const found = existing.find(
          (r) => r.faixa_origem === origem && r.faixa_destino === destino
        );
        transitionRows.push({
          id: found?.id,
          faixa_origem: origem,
          faixa_destino: destino,
          meses: found?.meses ?? 6,
        });
      }
      setRows(transitionRows);
      setLoading(false);
    };
    fetch();
  }, [ctId, classe, refreshKey]);

  const updateMeses = (index: number, value: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, meses: Math.max(1, value) } : r))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const upserts = rows.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        ct_id: ctId,
        classe,
        faixa_origem: r.faixa_origem,
        faixa_destino: r.faixa_destino,
        meses: r.meses,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("tempo_graduacao")
        .upsert(upserts as any, { onConflict: "ct_id,classe,faixa_origem,faixa_destino" });

      if (error) throw error;
      toast.success("Tempos de graduação salvos com sucesso!");
      onRefresh();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-heading text-sm uppercase text-foreground">
          ⏱️ Tempo Médio de Graduação por Faixa
        </h3>
        <Select value={classe} onValueChange={setClasse}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLASSE_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-muted-foreground text-xs">
        Defina a média de tempo (em meses) necessária para cada transição de faixa.
      </p>

      {loading ? (
        <div className="text-muted-foreground animate-pulse p-4">Carregando...</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div
              key={`${row.faixa_origem}-${row.faixa_destino}`}
              className="flex items-center gap-3 rounded-lg border border-border p-3 bg-card"
            >
              <div className="flex items-center gap-2 min-w-[180px]">
                <FaixaBadge faixa={row.faixa_origem} grau={0} size="sm" />
                <span className="text-muted-foreground text-xs">→</span>
                <FaixaBadge faixa={row.faixa_destino} grau={0} size="sm" />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Select
                  value={String(row.meses)}
                  onValueChange={(val) => updateMeses(i, parseInt(val))}
                >
                  <SelectTrigger className="w-20 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 120 }, (_, j) => j + 1).map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground text-xs whitespace-nowrap">meses</span>
              </div>
            </div>
          ))}

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto mt-2">
            {saving ? "Salvando..." : "💾 Salvar Tempos"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TempoGraduacaoTab;
