import { useEffect, useState, useMemo } from "react";
import FaixaBadge from "./FaixaBadge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, User, Filter, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Constants } from "@/integrations/supabase/types";
import AlunoProfileDialog from "./alunos/AlunoProfileDialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { getFunctionsErrorMessage } from "@/services/functions";

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

interface Centro {
  id: string;
  nome: string;
}

const faixas = Constants.public.Enums.faixa_tipo.filter(f => f !== "coral" && f !== "vermelha");

const FAIXA_COLORS: Record<string, string> = {
  branca: "#ffffff",
  cinza: "#9ca3af",
  amarela: "#facc15",
  laranja: "#f97316",
  verde: "#16a34a",
  azul: "#2563eb",
  roxa: "#9333ea",
  marrom: "#92400e",
  preta: "#171717",
};

const AlunosSection = ({ role, userId }: { role: string; userId: string }) => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileAluno, setProfileAluno] = useState<Aluno | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Filters
  const [filterFaixa, setFilterFaixa] = useState<string>("all");
  const [filterSexo, setFilterSexo] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Form fields
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [faixa, setFaixa] = useState<string>("branca");
  const [grau, setGrau] = useState<number>(0);
  const [sexo, setSexo] = useState<string>("");
  const [ctId, setCtId] = useState<string>("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const fetchAlunos = async () => {
    const { data: alunoRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "aluno");

    const { data: mestreRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "mestre");

    const mestreIds = new Set((mestreRoles || []).map(r => r.user_id));
    const pureAlunoIds = (alunoRoles || [])
      .map(r => r.user_id)
      .filter(id => !mestreIds.has(id));

    if (pureAlunoIds.length > 0) {
      let query = supabase.from("profiles").select("*").in("user_id", pureAlunoIds);
      if (role === "mestre") {
        const { data: mestreProfile } = await supabase.from("profiles").select("ct_id").eq("user_id", userId).maybeSingle();
        if (mestreProfile?.ct_id) {
          query = query.eq("ct_id", mestreProfile.ct_id);
        } else {
          setAlunos([]);
          setLoading(false);
          return;
        }
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) toast.error("Erro ao carregar alunos");
      else setAlunos((data as Aluno[]) || []);
    } else {
      setAlunos([]);
    }
    setLoading(false);
  };

  const fetchCentros = async () => {
    const { data } = await supabase.from("centros_treinamento").select("id, nome");
    setCentros(data || []);
  };

  useEffect(() => { fetchAlunos(); fetchCentros(); }, []);

  // Filtered alunos
  const filteredAlunos = useMemo(() => {
    return alunos.filter(a => {
      if (filterFaixa !== "all" && a.faixa !== filterFaixa) return false;
      if (filterSexo !== "all" && a.sexo !== filterSexo) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const fullName = `${a.nome} ${a.sobrenome || ""}`.toLowerCase();
        if (!fullName.includes(term)) return false;
      }
      return true;
    });
  }, [alunos, filterFaixa, filterSexo, searchTerm]);

  // Pie chart data – distribution by faixa
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    alunos.forEach(a => {
      const f = a.faixa || "branca";
      counts[f] = (counts[f] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, key: name }))
      .sort((a, b) => faixas.indexOf(a.key as any) - faixas.indexOf(b.key as any));
  }, [alunos]);

  // Pie chart data – distribution by sexo
  const pieSexoData = useMemo(() => {
    const counts: Record<string, number> = {};
    alunos.forEach(a => {
      const s = a.sexo || "Não informado";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [alunos]);

  const SEXO_COLORS = ["#3b82f6", "#ec4899", "#9ca3af"];

  const hasActiveFilters = filterFaixa !== "all" || filterSexo !== "all" || searchTerm !== "";

  const clearFilters = () => {
    setFilterFaixa("all");
    setFilterSexo("all");
    setSearchTerm("");
  };

  const resetForm = () => {
    setNome(""); setSobrenome(""); setTelefone(""); setFaixa("branca"); setGrau(0); setSexo(""); setCtId(""); setEditingId(null); setPassword(""); setUsername(""); setEmail("");
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
      toast.success("Aluno atualizado!");
    } else {
      if ((username && !password) || (!username && password)) {
        toast.error("Para criar acesso, preencha usuário e senha");
        setSaving(false);
        return;
      }

      if (password && username) {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: { password, nome, sobrenome, telefone, faixa, grau, sexo, ct_id: ctId || null, role: "aluno", username, contact_email: email || null },
        });
        if (error || data?.error) {
          toast.error(data?.error || await getFunctionsErrorMessage(error, "Erro ao cadastrar"));
          setSaving(false);
          return;
        }
        toast.success("Aluno cadastrado com acesso!");
      } else {
        const newUserId = crypto.randomUUID();
        const generatedUsername = `aluno_${newUserId.slice(0, 8)}`;
        const { error: profileError } = await supabase.from("profiles").insert({
          nome, sobrenome, telefone: telefone || null, faixa: faixa as any, grau, ct_id: ctId || null, user_id: newUserId,
          mestre_id: role === "mestre" ? userId : null, sexo: sexo || null, email: email || null,
          username: generatedUsername,
        } as any);
        if (profileError) {
          toast.error("Erro: " + profileError.message);
          setSaving(false);
          return;
        }
        const { error: roleError } = await supabase.from("user_roles").insert({ user_id: newUserId, role: "aluno" as any });
        if (roleError) {
          toast.error("Erro role: " + roleError.message);
          setSaving(false);
          return;
        }
        toast.success("Aluno cadastrado!");
      }
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchAlunos();
  };

  const handleEdit = (aluno: Aluno) => {
    setEditingId(aluno.id);
    setNome(aluno.nome);
    setSobrenome(aluno.sobrenome || "");
    setTelefone(aluno.telefone || "");
    setFaixa(aluno.faixa || "branca");
    setGrau(aluno.grau || 0);
    setSexo(aluno.sexo || "");
    setCtId(aluno.ct_id || "");
    setUsername(aluno.username || "");
    setEmail(aluno.email || "");
    setPassword("");
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir: " + error.message); else { toast.success("Aluno excluído!"); fetchAlunos(); }
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <h1 className="font-heading text-3xl uppercase text-foreground">
          {role === "mestre" ? "Meus Alunos" : "Alunos"}
        </h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm" className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Novo Aluno</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground">{editingId ? "Editar Aluno" : "Novo Aluno"}</DialogTitle>
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
                  {editingId ? "Alterar credenciais (deixe em branco para manter)" : "Credenciais de acesso (opcional — preencha para o aluno poder fazer login)"}
                </p>
                <div className="space-y-2">
                  <Label className="text-foreground">Nome de Usuário</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="aluno.usuario" className="bg-secondary border-border text-foreground" />
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

      {/* Charts */}
      {alunos.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Faixa Distribution */}
          <div className="bg-card border border-border rounded-[24px] p-4 sm:rounded-lg">
            <h3 className="text-foreground font-heading text-sm uppercase tracking-wider mb-3">Distribuição por Faixa</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={FAIXA_COLORS[entry.key] || "#6b7280"} stroke="hsl(var(--border))" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [`${value} aluno(s)`, ""]}
                />
                <Legend
                  formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Sexo Distribution */}
          <div className="bg-card border border-border rounded-[24px] p-4 sm:rounded-lg">
            <h3 className="text-foreground font-heading text-sm uppercase tracking-wider mb-3">Distribuição por Sexo</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieSexoData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieSexoData.map((_, idx) => (
                    <Cell key={idx} fill={SEXO_COLORS[idx % SEXO_COLORS.length]} stroke="hsl(var(--border))" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [`${value} aluno(s)`, ""]}
                />
                <Legend
                  formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-[24px] p-4 mb-6 sm:rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground text-sm font-medium">Filtros</span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto text-muted-foreground hover:text-foreground h-7 px-2">
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-secondary border-border text-foreground"
          />
          <Select value={filterFaixa} onValueChange={setFilterFaixa}>
            <SelectTrigger className="bg-secondary border-border text-foreground">
              <SelectValue placeholder="Todas as faixas" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todas as faixas</SelectItem>
              {faixas.map((f) => (
                <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSexo} onValueChange={setFilterSexo}>
            <SelectTrigger className="bg-secondary border-border text-foreground">
              <SelectValue placeholder="Todos os sexos" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <p className="text-muted-foreground text-xs mt-2">
            Mostrando {filteredAlunos.length} de {alunos.length} aluno(s)
          </p>
        )}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filteredAlunos.length === 0 ? (
        <div className="bg-card border border-border rounded-[24px] p-8 text-center sm:rounded-lg">
          <p className="text-muted-foreground">
            {hasActiveFilters ? "Nenhum aluno encontrado com os filtros aplicados." : "Nenhum aluno cadastrado."}
          </p>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-sm gap-3 sm:max-w-none">
          {filteredAlunos.map((aluno) => (
            <div key={aluno.id} className="bg-card border border-border rounded-[22px] p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors sm:flex-row sm:items-center sm:justify-between sm:rounded-lg">
              <div className="flex items-start gap-4 flex-1">
                <FaixaBadge faixa={aluno.faixa || "branca"} grau={aluno.grau} />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-medium">{aluno.nome} {aluno.sobrenome || ""}</p>
                  <p className="text-muted-foreground text-sm">{aluno.telefone || "Sem telefone"} {aluno.sexo ? `• ${aluno.sexo}` : ""}</p>
                </div>
              </div>
              <div className="flex justify-center gap-2 sm:justify-end">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => { setProfileAluno(aluno); setProfileOpen(true); }} title="Ver Perfil"><User className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => handleEdit(aluno)}><Edit2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(aluno.id)} className="h-9 w-9 rounded-xl text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlunoProfileDialog
        aluno={profileAluno}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        canEdit={role === "admin" || role === "mestre"}
        onAlunoUpdated={(alunoUserId, novaFaixa, novoGrau) => {
          setAlunos(prev => prev.map(a => a.user_id === alunoUserId ? { ...a, faixa: novaFaixa, grau: novoGrau } : a));
          if (profileAluno?.user_id === alunoUserId) {
            setProfileAluno(prev => prev ? { ...prev, faixa: novaFaixa, grau: novoGrau } : prev);
          }
        }}
      />
    </div>
  );
};

export default AlunosSection;
