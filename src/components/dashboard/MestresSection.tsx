import { useEffect, useState } from "react";
import FaixaBadge from "./FaixaBadge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Constants } from "@/integrations/supabase/types";
import { getFunctionsErrorMessage } from "@/services/functions";

interface Mestre {
  id: string;
  nome: string;
  sobrenome: string | null;
  telefone: string | null;
  faixa: string | null;
  grau: number;
  sexo: string | null;
  ct_id: string | null;
  user_id: string;
  username: string;
}

interface Centro {
  id: string;
  nome: string;
}

const faixas = Constants.public.Enums.faixa_tipo.filter(f => f !== "coral" && f !== "vermelha");

interface MestresSectionProps {
  callerRole?: string;
}

const MestresSection = ({ callerRole }: MestresSectionProps) => {
  const [mestres, setMestres] = useState<Mestre[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [faixa, setFaixa] = useState<string>("preta");
  const [grau, setGrau] = useState<number>(0);
  const [sexo, setSexo] = useState<string>("");
  const [ctId, setCtId] = useState<string>("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const isAdmin = callerRole === "admin";

  const fetchMestres = async () => {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "mestre");

    if (roleData && roleData.length > 0) {
      const userIds = roleData.map((r) => r.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds)
        .order("created_at", { ascending: false });
      if (error) toast.error("Erro ao carregar mestres");
      else setMestres((data as Mestre[]) || []);
    } else {
      setMestres([]);
    }
    setLoading(false);
  };

  const fetchCentros = async () => {
    const { data } = await supabase.from("centros_treinamento").select("id, nome");
    setCentros(data || []);
  };

  useEffect(() => { fetchMestres(); fetchCentros(); }, []);

  const resetForm = () => {
    setNome(""); setSobrenome(""); setTelefone(""); setFaixa("preta"); setGrau(0); setSexo(""); setCtId(""); setEditingId(null); setPassword(""); setUsername(""); setEmail("");
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);

    if (editingId) {
      const { error } = await supabase.from("profiles").update({
        nome, sobrenome, telefone: telefone || null, faixa: faixa as any, grau, sexo: sexo || null, ct_id: ctId || null, email: email || null,
      } as any).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar: " + error.message); setSaving(false); return; }

      if (username || password) {
        const { data, error: fnError } = await supabase.functions.invoke("update-user", {
          body: { profile_id: editingId, username: username || undefined, password: password || undefined },
        });
        if (fnError || data?.error) {
          toast.error(data?.error || await getFunctionsErrorMessage(fnError, "Erro ao atualizar credenciais"));
          setSaving(false);
          return;
        }
      }
      toast.success("Mestre atualizado!");
    } else {
      if ((username && !password) || (!username && password)) {
        toast.error("Para criar acesso, preencha usuário e senha");
        setSaving(false);
        return;
      }

      if (password && username) {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: { password, nome, sobrenome, telefone, faixa, grau, sexo, ct_id: ctId || null, role: "mestre", username, contact_email: email || null },
        });
        if (error || data?.error) {
          toast.error(data?.error || await getFunctionsErrorMessage(error, "Erro ao cadastrar"));
          setSaving(false);
          return;
        }
        toast.success("Mestre cadastrado com acesso!");
      } else {
        const newUserId = crypto.randomUUID();
        const { error: profileError } = await supabase.from("profiles").insert({
          nome, sobrenome, telefone: telefone || null, faixa: faixa as any, grau, ct_id: ctId || null, user_id: newUserId, sexo: sexo || null, email: email || null,
        } as any);
        if (profileError) {
          toast.error("Erro: " + profileError.message);
          setSaving(false);
          return;
        }
        const { error: roleError } = await supabase.from("user_roles").insert({ user_id: newUserId, role: "mestre" as any });
        if (roleError) {
          toast.error("Erro role: " + roleError.message);
          setSaving(false);
          return;
        }
        toast.success("Mestre cadastrado!");
      }
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchMestres();
  };

  const handleEdit = (mestre: Mestre) => {
    setEditingId(mestre.id);
    setNome(mestre.nome);
    setSobrenome(mestre.sobrenome || "");
    setTelefone(mestre.telefone || "");
    setFaixa(mestre.faixa || "preta");
    setGrau(mestre.grau || 0);
    setSexo(mestre.sexo || "");
    setCtId(mestre.ct_id || "");
    setUsername(mestre.username || "");
    setEmail((mestre as any).email || "");
    setPassword("");
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem excluir mestres");
      return;
    }
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir: " + error.message); else { toast.success("Mestre excluído!"); fetchMestres(); }
  };

  const getFaixaColor = (faixa: string | null) => {
    const colors: Record<string, string> = {
      branca: "bg-white text-black", preta: "bg-black text-white border border-white/20",
      marrom: "bg-amber-800 text-white",
    };
    return colors[faixa || "preta"] || "bg-secondary text-foreground";
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-8 flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <h1 className="font-heading text-3xl uppercase text-foreground">Mestres</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm" className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Novo Mestre</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground">{editingId ? "Editar Mestre" : "Novo Mestre"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground">Nome</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="bg-secondary border-border text-foreground" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Sobrenome</Label>
                  <Input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} placeholder="Sobrenome" className="bg-secondary border-border text-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground">Telefone</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="bg-secondary border-border text-foreground" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">E-mail</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="bg-secondary border-border text-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground">Faixa</Label>
                  <Select value={faixa} onValueChange={setFaixa}>
                    <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {faixas.map((f) => (
                        <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Grau</Label>
                  <Select value={String(grau)} onValueChange={(v) => setGrau(Number(v))}>
                    <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {[0,1,2,3,4,5,6,7,8,9,10].map((g) => (
                        <SelectItem key={g} value={String(g)}>{g}º Grau</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground">Sexo</Label>
                  <Select value={sexo} onValueChange={setSexo}>
                    <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {centros.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-foreground">Centro de Treinamento</Label>
                  <Select value={ctId} onValueChange={setCtId}>
                    <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue placeholder="Selecione um CT" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {centros.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="border-t border-border pt-4 space-y-4">
                  <p className="text-muted-foreground text-sm">
                    {editingId ? "Alterar credenciais (deixe em branco para manter)" : "Credenciais de acesso (opcional — preencha para o mestre poder fazer login)"}
                  </p>
                  <div className="space-y-2">
                    <Label className="text-foreground">Nome de Usuário</Label>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mestre.usuario" className="bg-secondary border-border text-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">{editingId ? "Nova Senha" : "Senha"}</Label>
                    <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" type="password" className="bg-secondary border-border text-foreground" />
                  </div>
                </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : mestres.length === 0 ? (
        <div className="glass-card rounded-[24px] p-8 text-center sm:rounded-lg">
          <p className="text-muted-foreground">Nenhum mestre cadastrado.</p>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-sm gap-4 sm:max-w-none">
          {mestres.map((mestre) => (
            <div key={mestre.id} className="glass-card rounded-[22px] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:rounded-lg">
              <div className="flex items-start gap-4">
                <FaixaBadge faixa={mestre.faixa || "preta"} grau={mestre.grau} />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-medium">{mestre.nome} {mestre.sobrenome || ""}</p>
                  <p className="text-muted-foreground text-sm">{mestre.telefone || "Sem telefone"} {mestre.sexo ? `• ${mestre.sexo}` : ""}</p>
                </div>
              </div>
              <div className="flex justify-center gap-2 sm:justify-end">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => handleEdit(mestre)}><Edit2 className="h-4 w-4" /></Button>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(mestre.id)} className="h-9 w-9 rounded-xl text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MestresSection;
