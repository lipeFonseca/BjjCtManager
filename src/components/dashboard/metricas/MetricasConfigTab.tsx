import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface Metrica {
  id: string;
  nome: string;
  ativo: boolean;
  valor_meta: number;
}

interface Props {
  ctId: string;
  userId: string;
  refreshKey: number;
  onRefresh: () => void;
}

const MetricasConfigTab = ({ ctId, userId, refreshKey, onRefresh }: Props) => {
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaMetrica, setNovaMetrica] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("metricas_graduacao")
        .select("id, nome, ativo, valor_meta")
        .eq("ct_id", ctId)
        .order("created_at");
      setMetricas((data as any) || []);
      setLoading(false);
    };
    fetch();
  }, [ctId, refreshKey]);

  const toggleAtivo = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("metricas_graduacao")
      .update({ ativo: !current })
      .eq("id", id);
    if (error) toast.error("Erro ao atualizar");
    else { toast.success("Métrica atualizada"); onRefresh(); }
  };

  const updateMeta = async (id: string, valor: number) => {
    const { error } = await supabase
      .from("metricas_graduacao")
      .update({ valor_meta: valor })
      .eq("id", id);
    if (error) toast.error("Erro ao atualizar meta");
    else { toast.success("Meta atualizada"); onRefresh(); }
  };

  const deleteMetrica = async (id: string) => {
    // Delete related progresso first
    await supabase.from("progresso_metricas").delete().eq("metrica_id", id);
    const { error } = await supabase.from("metricas_graduacao").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Métrica excluída"); onRefresh(); }
  };

  const addMetrica = async () => {
    if (!novaMetrica.trim()) { toast.error("Digite o nome da métrica"); return; }
    setAdding(true);
    const { error } = await supabase.from("metricas_graduacao").insert({
      ct_id: ctId,
      nome: novaMetrica.trim(),
      valor_meta: 10,
      ativo: true,
      created_by: userId,
      faixa_origem: "branca",
      faixa_destino: "azul",
      tipo_metrica: novaMetrica.trim(),
      classe: "adulto",
    } as any);
    if (error) toast.error("Erro ao criar métrica");
    else { toast.success("Métrica adicionada!"); setNovaMetrica(""); onRefresh(); }
    setAdding(false);
  };

  if (loading) return <div className="text-muted-foreground animate-pulse p-4">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-lg border border-border overflow-hidden">
        {metricas.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">Nenhuma métrica cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-foreground">Métrica</th>
                <th className="text-center p-3 font-medium text-foreground">Meta (0-10)</th>
                <th className="text-center p-3 font-medium text-foreground">Ativa</th>
                <th className="text-center p-3 font-medium text-foreground w-16">Ações</th>
              </tr>
            </thead>
            <tbody>
              {metricas.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="p-3 text-foreground">{m.nome}</td>
                  <td className="p-3 text-center">
                    <Select
                      defaultValue={String(m.valor_meta)}
                      onValueChange={(val) => {
                        const num = parseFloat(val);
                        if (num !== m.valor_meta) updateMeta(m.id, num);
                      }}
                    >
                      <SelectTrigger className="w-20 mx-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 11 }, (_, i) => i).map((v) => (
                          <SelectItem key={v} value={String(v)}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-center">
                    <Switch checked={m.ativo} onCheckedChange={() => toggleAtivo(m.id, m.ativo)} />
                  </td>
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="icon" onClick={() => deleteMetrica(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={novaMetrica}
          onChange={(e) => setNovaMetrica(e.target.value)}
          placeholder="Nome da nova métrica..."
          onKeyDown={(e) => e.key === "Enter" && addMetrica()}
        />
        <Button onClick={addMetrica} disabled={adding} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
    </div>
  );
};

export default MetricasConfigTab;
