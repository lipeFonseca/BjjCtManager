import { useEffect, useState } from "react";
import FaixaBadge from "./FaixaBadge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, ArrowLeft, Users, Award, Phone, Mail, User, ChevronDown, Filter, Settings, Clock, Eye, FileText, UserCheck, MessageSquare, BarChart3, DollarSign } from "lucide-react";
import CTConfigSection from "./CTConfigSection";
import HorariosSection from "./HorariosSection";
import ChamadaSection from "./ChamadaSection";
import ScheduleWidget from "./ScheduleWidget";
import AttendanceChart from "./AttendanceChart";
import AttendanceRanking from "./AttendanceRanking";
import RelatoriosSection from "./RelatoriosSection";
import MensagensSection from "./MensagensSection";
import FinanceiroSection from "./FinanceiroSection";
import AlunoProfileDialog from "./alunos/AlunoProfileDialog";
import MetricasGraduacaoSection from "./metricas/MetricasGraduacaoSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { Constants } from "@/integrations/supabase/types";
import { getFunctionsErrorMessage } from "@/services/functions";
import { useResolvedCtAssetUrls } from "@/hooks/useResolvedCtAssetUrls";
import HeroPanel from "./HeroPanel";
import DashboardCard from "./DashboardCard";
import ChartCard from "./ChartCard";
import ActionButton from "./ActionButton";

const faixas = Constants.public.Enums.faixa_tipo.filter(f => f !== "coral" && f !== "vermelha");

const FAIXA_COLORS_HEX: Record<string, string> = {
  branca: "#ffffff", cinza: "#9ca3af", amarela: "#facc15", laranja: "#f97316",
  verde: "#16a34a", azul: "#2563eb", roxa: "#9333ea", marrom: "#92400e",
  preta: "#171717",
};

const FAIXA_ORDER = ["branca", "cinza", "amarela", "laranja", "verde", "azul", "roxa", "marrom", "preta"];

const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");

const isValidUsername = (value: string) => /^[a-z0-9._-]{3,30}$/.test(value);

interface Centro {
  id: string;
  nome: string;
  endereco: string | null;
  mestre_lider_id: string | null;
  created_at: string;
  cor_primaria?: string;
  cor_secundaria?: string;
  cor_fundo?: string;
  cor_texto?: string;
  logo_url?: string | null;
  banner_url?: string | null;
}

interface ProfileWithRole {
  id: string;
  nome: string;
  sobrenome: string | null;
  faixa: string | null;
  grau: number;
  sexo: string | null;
  telefone: string | null;
  email: string | null;
  user_id: string;
  role: string;
  username?: string;
}

interface CentrosSectionProps {
  selectedCentroId?: string;
  onBack?: () => void;
  onRefresh?: () => void;
  callerRole?: string;
  initialShowConfig?: boolean;
  initialDetailView?: CtDetailView;
  initialMemberView?: "mestres" | "alunos";
  onConfigOpened?: () => void;
}

type CtDetailView =
  | "overview"
  | "config"
  | "horarios"
  | "relatorios"
  | "chamada"
  | "mensagens"
  | "metricas"
  | "financeiro"
  | "members";

const CentrosSection = ({ selectedCentroId, onBack, onRefresh, callerRole = "admin", initialShowConfig, initialDetailView, initialMemberView, onConfigOpened }: CentrosSectionProps) => {
  const isCallerAdmin = callerRole === "admin";
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [centros, setCentros] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCentro, setSelectedCentro] = useState<Centro | null>(null);
  const [centroProfiles, setCentroProfiles] = useState<ProfileWithRole[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ProfileWithRole | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<ProfileWithRole | null>(null);

  // Member CRUD state
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberDialogType, setMemberDialogType] = useState<"mestre" | "aluno">("aluno");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberNome, setMemberNome] = useState("");
  const [memberSobrenome, setMemberSobrenome] = useState("");
  const [memberTelefone, setMemberTelefone] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberFaixa, setMemberFaixa] = useState("branca");
  const [memberGrau, setMemberGrau] = useState<number>(0);
  const [memberSexo, setMemberSexo] = useState("");
  const [memberUsername, setMemberUsername] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberSaving, setMemberSaving] = useState(false);

  // Filter state
  const [mestreFaixaFilter, setMestreFaixaFilter] = useState("todas");
  const [mestreSexoFilter, setMestreSexoFilter] = useState("todos");
  const [alunoFaixaFilter, setAlunoFaixaFilter] = useState("todas");
  const [alunoSexoFilter, setAlunoSexoFilter] = useState("todos");
  const [activeMemberView, setActiveMemberView] = useState<"mestres" | "alunos">(initialMemberView || "alunos");
  const [activeDetailView, setActiveDetailView] = useState<CtDetailView>(initialDetailView || (initialShowConfig ? "config" : "overview"));
  const selectedCentroAssetUrls = useResolvedCtAssetUrls([
    selectedCentro?.banner_url,
    selectedCentro?.logo_url,
  ], Boolean(selectedCentro));

  useEffect(() => {
    if (initialDetailView && selectedCentro) {
      setActiveDetailView(initialDetailView);
    } else if (initialShowConfig && selectedCentro) {
      setActiveDetailView("config");
      onConfigOpened?.();
    }
  }, [initialDetailView, initialShowConfig, selectedCentro]);

  useEffect(() => {
    if (initialMemberView) {
      setActiveMemberView(initialMemberView);
    }
  }, [initialMemberView]);

  const filterAndSort = (list: ProfileWithRole[], faixaFilter: string, sexoFilter: string) => {
    return list
      .filter(p => faixaFilter === "todas" || (p.faixa || "branca") === faixaFilter)
      .filter(p => sexoFilter === "todos" || (p.sexo || "") === sexoFilter)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  };

  const getCallerCtId = async () => {
    if (callerRole !== "mestre") return null;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("ct_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return profile?.ct_id || null;
  };

  const fetchCentros = async () => {
    let query = supabase.from("centros_treinamento").select("*");

    if (callerRole === "mestre") {
      const callerCtId = await getCallerCtId();
      if (!callerCtId) {
        setCentros([]);
        setLoading(false);
        return;
      }
      query = query.eq("id", callerCtId);
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) toast.error("Erro ao carregar centros");
    else setCentros(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCentros(); }, []);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setCurrentUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (selectedCentroId && centros.length > 0) {
      const ct = centros.find(c => c.id === selectedCentroId);
      if (ct) fetchCentroDetails(ct, { resetDetailView: true, targetDetailView: initialDetailView, targetMemberView: initialMemberView });
    } else if (selectedCentroId && !loading) {
      const fetchSingle = async () => {
        if (callerRole === "mestre") {
          const callerCtId = await getCallerCtId();
          if (!callerCtId || callerCtId !== selectedCentroId) {
            toast.error("Voce nao pode acessar outro CT.");
            return;
          }
        }

        const { data } = await supabase.from("centros_treinamento").select("*").eq("id", selectedCentroId).single();
        if (data) fetchCentroDetails(data, { resetDetailView: true, targetDetailView: initialDetailView, targetMemberView: initialMemberView });
      };
      fetchSingle();
    }
  }, [callerRole, selectedCentroId, centros, loading, initialDetailView, initialMemberView]);

  const fetchCentroDetails = async (centro: Centro, options?: { resetDetailView?: boolean; targetDetailView?: CtDetailView; targetMemberView?: "mestres" | "alunos" }) => {
    setLoadingDetail(true);
    setSelectedCentro(centro);
    setSelectedMember(null);
    if (options?.resetDetailView) {
      setActiveDetailView(options.targetDetailView || initialDetailView || (initialShowConfig ? "config" : "overview"));
      if (options.targetMemberView) {
        setActiveMemberView(options.targetMemberView);
      }
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nome, sobrenome, faixa, grau, sexo, user_id, telefone, email, username")
      .eq("ct_id", centro.id);

    if (profiles && profiles.length > 0) {
      const userIds = profiles.map(p => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
      setCentroProfiles(profiles.map(p => ({
        id: p.id,
        nome: p.nome,
        sobrenome: p.sobrenome,
        faixa: p.faixa,
        grau: p.grau,
        sexo: (p as any).sexo || null,
        telefone: p.telefone,
        email: p.email,
        user_id: p.user_id,
        username: p.username,
        role: roleMap.get(p.user_id) || "aluno",
      })));
    } else {
      setCentroProfiles([]);
    }
    setLoadingDetail(false);
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from("centros_treinamento").update({ nome, endereco: endereco || null }).eq("id", editingId);
      if (error) toast.error("Erro ao atualizar"); else toast.success("Centro atualizado!");
    } else {
      const { error } = await supabase.from("centros_treinamento").insert({ nome, endereco: endereco || null });
      if (error) toast.error("Erro ao criar centro"); else toast.success("Centro criado!");
    }
    setSaving(false);
    setDialogOpen(false);
    setNome(""); setEndereco(""); setEditingId(null);
    fetchCentros();
    onRefresh?.();
  };

  const handleEdit = (e: React.MouseEvent, centro: Centro) => {
    e.stopPropagation();
    setEditingId(centro.id);
    setNome(centro.nome);
    setEndereco(centro.endereco || "");
    setDialogOpen(true);
  };

  const openEditCentro = (centro: Centro) => {
    setEditingId(centro.id);
    setNome(centro.nome);
    setEndereco(centro.endereco || "");
    setDialogOpen(true);
  };

  const [ctDeleteConfirmOpen, setCtDeleteConfirmOpen] = useState(false);
  const [ctToDelete, setCtToDelete] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCtToDelete(id);
    setCtDeleteConfirmOpen(true);
  };

  const openDeleteCentro = (id: string) => {
    setCtToDelete(id);
    setCtDeleteConfirmOpen(true);
  };

  const confirmDeleteCentro = async () => {
    if (!ctToDelete) return;
    const id = ctToDelete;
    try {
      const { data, error } = await supabase.functions.invoke("delete-ct-users", {
        body: { ct_id: id },
      });

      if (error || data?.error) {
        throw new Error(data?.error || await getFunctionsErrorMessage(error, "Erro ao excluir centro"));
      }

      toast.success(`Centro excluído! ${data?.deleted_users || 0} usuário(s) removido(s).`);
      if (selectedCentro?.id === id) { setSelectedCentro(null); setCentroProfiles([]); }
      fetchCentros();
      onRefresh?.();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err.message || ""));
    }
    setCtDeleteConfirmOpen(false);
    setCtToDelete(null);
  };

  // Member CRUD
  const resetMemberForm = () => {
    setMemberNome(""); setMemberSobrenome(""); setMemberTelefone(""); setMemberEmail(""); setMemberFaixa("branca");
    setMemberGrau(0); setMemberSexo(""); setMemberUsername(""); setMemberPassword(""); setEditingMemberId(null);
  };

  const openAddMember = (type: "mestre" | "aluno") => {
    resetMemberForm();
    setMemberDialogType(type);
    setMemberFaixa(type === "mestre" ? "preta" : "branca");
    setMemberDialogOpen(true);
  };

  const openEditMember = (member: ProfileWithRole) => {
    setEditingMemberId(member.id);
    setMemberDialogType(member.role === "mestre" ? "mestre" : "aluno");
    setMemberNome(member.nome);
    setMemberSobrenome(member.sobrenome || "");
    setMemberTelefone(member.telefone || "");
    setMemberEmail(member.email || "");
    setMemberFaixa(member.faixa || "branca");
    setMemberGrau(member.grau || 0);
    setMemberSexo(member.sexo || "");
    setMemberUsername(member.username || "");
    setMemberPassword("");
    setMemberDialogOpen(true);
  };

  const handleSaveMember = async () => {
    if (!memberNome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!selectedCentro) return;
    setMemberSaving(true);
    const normalizedMemberUsername = normalizeUsername(memberUsername);

    if (memberUsername && !isValidUsername(normalizedMemberUsername)) {
      toast.error("Use um nome de usuário com 3 a 30 caracteres: letras, números, ponto, underline ou hífen.");
      setMemberSaving(false);
      return;
    }

    if (editingMemberId) {
      const { error } = await supabase.from("profiles").update({
        nome: memberNome, sobrenome: memberSobrenome, telefone: memberTelefone || null,
        email: memberEmail || null, faixa: memberFaixa as any, grau: memberGrau, sexo: memberSexo || null,
      } as any).eq("id", editingMemberId);
      if (error) { toast.error("Erro ao atualizar: " + error.message); setMemberSaving(false); return; }

      if (memberUsername || memberPassword) {
        const { data, error: fnError } = await supabase.functions.invoke("update-user", {
          body: { profile_id: editingMemberId, username: normalizedMemberUsername || undefined, password: memberPassword || undefined },
        });
        if (fnError || data?.error) {
          toast.error(data?.error || await getFunctionsErrorMessage(fnError, "Erro ao atualizar credenciais"));
          setMemberSaving(false);
          return;
        }
      }
      toast.success(`${memberDialogType === "mestre" ? "Mestre" : "Aluno"} atualizado!`);
    } else {
      const role = memberDialogType === "mestre" ? "mestre" : "aluno";

      if ((memberUsername && !memberPassword) || (!memberUsername && memberPassword)) {
        toast.error("Para criar acesso, preencha usuário e senha");
        setMemberSaving(false);
        return;
      }

      if (memberPassword && memberUsername) {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: {
            password: memberPassword, nome: memberNome, sobrenome: memberSobrenome,
            telefone: memberTelefone, faixa: memberFaixa, grau: memberGrau, sexo: memberSexo,
            ct_id: selectedCentro.id, role, username: normalizedMemberUsername, contact_email: memberEmail || null,
          },
        });
        if (error || data?.error) {
          toast.error(data?.error || await getFunctionsErrorMessage(error, "Erro ao cadastrar"));
          setMemberSaving(false);
          return;
        }
        toast.success(`${memberDialogType === "mestre" ? "Mestre" : "Aluno"} cadastrado com acesso!`);
      } else {
        const newUserId = crypto.randomUUID();
        const { error: profileError } = await supabase.from("profiles").insert({
          nome: memberNome, sobrenome: memberSobrenome, telefone: memberTelefone || null,
          email: memberEmail || null, faixa: memberFaixa as any, grau: memberGrau, ct_id: selectedCentro.id, user_id: newUserId, sexo: memberSexo || null,
          username: normalizedMemberUsername || `user_${newUserId.substring(0, 8)}`,
        } as any);
        if (profileError) {
          toast.error("Erro: " + profileError.message);
          setMemberSaving(false);
          return;
        }
        const { error: roleError } = await supabase.from("user_roles").insert({ user_id: newUserId, role: role as any });
        if (roleError) {
          toast.error("Erro role: " + roleError.message);
          setMemberSaving(false);
          return;
        }
        toast.success(`${memberDialogType === "mestre" ? "Mestre" : "Aluno"} cadastrado!`);
      }
    }

    setMemberSaving(false);
    setMemberDialogOpen(false);
    resetMemberForm();
    fetchCentroDetails(selectedCentro);
  };

  const openDeleteConfirm = (member: ProfileWithRole) => {
    setMemberToDelete(member);
    setDeleteConfirmOpen(true);
  };

  const openMembersPage = (view: "mestres" | "alunos") => {
    setActiveMemberView(view);
    setActiveDetailView("members");
  };

  const renderMembersContent = (mestres: ProfileWithRole[], alunos: ProfileWithRole[]) => {
    const isViewingMestres = activeMemberView === "mestres";
    const activeMembers = isViewingMestres ? mestres : alunos;
    const activeRoleLabel = isViewingMestres ? "Mestres" : "Alunos";
    const activeRoleSingular = isViewingMestres ? "mestre" : "aluno";
    const activeFaixaFilter = isViewingMestres ? mestreFaixaFilter : alunoFaixaFilter;
    const activeSexoFilter = isViewingMestres ? mestreSexoFilter : alunoSexoFilter;
    const setActiveFaixaFilter = isViewingMestres ? setMestreFaixaFilter : setAlunoFaixaFilter;
    const setActiveSexoFilter = isViewingMestres ? setMestreSexoFilter : setAlunoSexoFilter;
    const filteredMembers = filterAndSort(activeMembers, activeFaixaFilter, activeSexoFilter);

    return (
      <section className="glass-card mx-auto w-full max-w-2xl rounded-[24px] p-5 sm:max-w-none sm:p-6">
        <div className="mb-4 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg uppercase text-foreground">
                Membros - {activeRoleLabel} ({activeMembers.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Visualize, filtre e gerencie os {activeRoleSingular}s deste CT.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => openAddMember(activeRoleSingular)}>
            <Plus className="mr-2 h-4 w-4" /> Novo {isViewingMestres ? "Mestre" : "Aluno"}
          </Button>
        </div>

        <div className="mx-auto mb-5 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
          <Filter className="hidden h-4 w-4 text-muted-foreground sm:block" />
          <Select value={activeFaixaFilter} onValueChange={setActiveFaixaFilter}>
            <SelectTrigger className="h-10 w-full rounded-xl bg-secondary border-border text-foreground text-xs sm:h-8 sm:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="todas">Todas as faixas</SelectItem>
              {faixas.map(f => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={activeSexoFilter} onValueChange={setActiveSexoFilter}>
            <SelectTrigger className="h-10 w-full rounded-xl bg-secondary border-border text-foreground text-xs sm:h-8 sm:w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="todos">Todos os sexos</SelectItem>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {activeMembers.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum {activeRoleSingular} neste CT.</p>
        ) : filteredMembers.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum {activeRoleSingular} encontrado com os filtros selecionados.</p>
        ) : (
          <div className="mx-auto grid w-full max-w-sm gap-3 sm:max-w-none">
            {filteredMembers.map((member) => (
              <div key={member.id} className="glass-card mx-auto w-full rounded-[22px] p-4 shadow-sm flex items-start gap-3 sm:items-center sm:rounded-lg sm:p-3">
                <FaixaBadge faixa={member.faixa || (isViewingMestres ? "preta" : "branca")} grau={member.grau} />
                <div className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-foreground cursor-pointer hover:text-primary transition-colors sm:text-base" onClick={() => openProfileDialog(member)}>{member.nome} {member.sobrenome || ""}</span>
                  <span className="mt-1 block text-xs capitalize text-muted-foreground">{member.sexo || ""}</span>
                  <div className="mt-3 flex justify-center gap-2 sm:hidden">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => openProfileDialog(member)}><Eye className="h-3.5 w-3.5" /></Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Visualizar perfil completo</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => openEditMember(member)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Editar informações do {activeRoleSingular}</p>
                      </TooltipContent>
                    </Tooltip>
                    {(isViewingMestres ? isCallerAdmin : true) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive hover:text-destructive" onClick={() => openDeleteConfirm(member)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Excluir {activeRoleSingular} do centro</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <div className="hidden gap-1 ml-auto sm:flex">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openProfileDialog(member)}><Eye className="h-3.5 w-3.5" /></Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Visualizar perfil completo</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMember(member)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Editar informações do {activeRoleSingular}</p>
                    </TooltipContent>
                  </Tooltip>
                  {(isViewingMestres ? isCallerAdmin : true) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteConfirm(member)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Excluir {activeRoleSingular} do centro</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const handleDeleteMember = async () => {
    if (!selectedCentro || !memberToDelete) return;
    const { error } = await supabase.from("profiles").delete().eq("id", memberToDelete.id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else { toast.success("Membro excluído!"); fetchCentroDetails(selectedCentro); }
    setDeleteConfirmOpen(false);
    setMemberToDelete(null);
  };

  const renderDeleteConfirmDialog = () => (
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Tem certeza que deseja excluir <span className="font-semibold text-foreground">{memberToDelete?.nome} {memberToDelete?.sobrenome || ""}</span>? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-secondary border-border text-foreground hover:bg-secondary/80">Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const getFaixaColor = (faixa: string | null) => {
    const colors: Record<string, string> = {
      branca: "bg-white text-black", cinza: "bg-gray-400 text-black", amarela: "bg-yellow-400 text-black",
      laranja: "bg-orange-500 text-white", verde: "bg-green-600 text-white", azul: "bg-blue-600 text-white",
      roxa: "bg-purple-600 text-white", marrom: "bg-amber-800 text-white", preta: "bg-black text-white border border-white/20",
    };
    return colors[faixa || "branca"] || "bg-secondary text-foreground";
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = { admin: "Admin", mestre: "Mestre", aluno: "Aluno" };
    return labels[role] || role;
  };

  // Member form dialog
  const renderMemberDialog = () => (
    <Dialog open={memberDialogOpen} onOpenChange={(open) => { setMemberDialogOpen(open); if (!open) resetMemberForm(); }}>
      <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">
            {editingMemberId ? `Editar ${memberDialogType === "mestre" ? "Mestre" : "Aluno"}` : `Novo ${memberDialogType === "mestre" ? "Mestre" : "Aluno"}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Nome</Label>
              <Input value={memberNome} onChange={(e) => setMemberNome(e.target.value)} placeholder="Nome" className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Sobrenome</Label>
              <Input value={memberSobrenome} onChange={(e) => setMemberSobrenome(e.target.value)} placeholder="Sobrenome" className="bg-secondary border-border text-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Telefone</Label>
              <Input value={memberTelefone} onChange={(e) => setMemberTelefone(e.target.value)} placeholder="(00) 00000-0000" className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">E-mail</Label>
              <Input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="bg-secondary border-border text-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Faixa</Label>
              <Select value={memberFaixa} onValueChange={setMemberFaixa}>
                <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {faixas.map((f) => (<SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Grau</Label>
              <Select value={String(memberGrau)} onValueChange={(v) => setMemberGrau(Number(v))}>
                <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {[0,1,2,3,4,5,6,7,8,9,10].map((g) => (
                    <SelectItem key={g} value={String(g)}>{g}º Grau</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Sexo</Label>
              <Select value={memberSexo} onValueChange={setMemberSexo}>
                <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-muted-foreground text-sm">
              {editingMemberId ? "Alterar credenciais (deixe em branco para manter)" : "Credenciais de acesso (opcional)"}
            </p>
            <div className="space-y-2">
              <Label className="text-foreground">Nome de Usuário</Label>
              <Input
                value={memberUsername}
                onChange={(e) => setMemberUsername(e.target.value)}
                onBlur={(e) => setMemberUsername(normalizeUsername(e.target.value))}
                placeholder="usuario"
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{editingMemberId ? "Nova Senha" : "Senha"}</Label>
              <Input value={memberPassword} onChange={(e) => setMemberPassword(e.target.value)} placeholder="Mínimo 8 caracteres" type="password" className="bg-secondary border-border text-foreground" />
            </div>
          </div>
          <Button onClick={handleSaveMember} disabled={memberSaving} className="w-full">{memberSaving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Helper to open profile dialog
  const openProfileDialog = (member: ProfileWithRole) => {
    setSelectedMember(member);
    setProfileDialogOpen(true);
  };

  // Render profile dialog for selected member
  const renderProfileDialog = () => {
    if (!selectedMember) return null;
    
    const alunoForDialog = {
      id: selectedMember.id,
      nome: selectedMember.nome,
      sobrenome: selectedMember.sobrenome,
      telefone: selectedMember.telefone,
      faixa: selectedMember.faixa,
      grau: selectedMember.grau,
      sexo: selectedMember.sexo,
      email: selectedMember.email,
      ct_id: selectedCentro?.id || null,
      user_id: selectedMember.user_id,
      username: selectedMember.username || "",
    };

    return (
      <AlunoProfileDialog
        aluno={alunoForDialog}
        open={profileDialogOpen}
        onOpenChange={(open) => {
          setProfileDialogOpen(open);
          if (!open) setSelectedMember(null);
        }}
        canEdit={true}
        onAlunoUpdated={(alunoUserId, novaFaixa, novoGrau) => {
          setCentroProfiles(prev =>
            prev.map(member =>
              member.user_id === alunoUserId ? { ...member, faixa: novaFaixa, grau: novoGrau } : member
            )
          );
          setSelectedMember(prev =>
            prev && prev.user_id === alunoUserId ? { ...prev, faixa: novaFaixa, grau: novoGrau } : prev
          );
        }}
      />
    );
  };

  // CT Config view
  if (selectedCentro && activeDetailView === "config") {
    return (
      <CTConfigSection
        centroId={selectedCentro.id}
        centroNome={selectedCentro.nome}
        onBack={() => setActiveDetailView("overview")}
        canManageCt={isCallerAdmin}
        onEditCt={() => openEditCentro(selectedCentro)}
        onDeleteCt={() => openDeleteCentro(selectedCentro.id)}
        onSaved={() => {
          // Refresh centro data
          const refetch = async () => {
            const { data } = await supabase.from("centros_treinamento").select("*").eq("id", selectedCentro.id).single();
            if (data) setSelectedCentro(data);
          };
          refetch();
        }}
      />
    );
  }

  // CT Horarios view
  if (selectedCentro && activeDetailView === "horarios") {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground" onClick={() => setActiveDetailView("overview")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <HorariosSection role="admin" userId={currentUserId} ctId={selectedCentro.id} />
      </div>
    );
  }

  // CT Relatorios view
  if (selectedCentro && activeDetailView === "relatorios") {
    return (
      <RelatoriosSection
        ctId={selectedCentro.id}
        ctNome={selectedCentro.nome}
        onBack={() => setActiveDetailView("overview")}
      />
    );
  }

  // CT Chamada view
  if (selectedCentro && activeDetailView === "chamada") {
    return (
      <ChamadaSection
        ctId={selectedCentro.id}
        ctNome={selectedCentro.nome}
        onBack={() => setActiveDetailView("overview")}
      />
    );
  }

  // CT Mensagens view
  if (selectedCentro && activeDetailView === "mensagens") {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground" onClick={() => setActiveDetailView("overview")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <MensagensSection role={(callerRole as "admin" | "mestre" | "aluno") || "admin"} userId={currentUserId} ctId={selectedCentro.id} />
      </div>
    );
  }

  // CT Metricas de Graduacao view
  if (selectedCentro && activeDetailView === "metricas") {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground" onClick={() => setActiveDetailView("overview")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <MetricasGraduacaoSection
          ctId={selectedCentro.id}
          role={(callerRole as "admin" | "mestre" | "aluno") || "admin"}
          userId={currentUserId}
        />
      </div>
    );
  }

  // CT Financeiro view
  if (selectedCentro && activeDetailView === "financeiro") {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground" onClick={() => setActiveDetailView("overview")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <FinanceiroSection ctId={selectedCentro.id} role={(callerRole as "admin" | "mestre") || "admin"} userId={currentUserId} />
      </div>
    );
  }

  if (selectedCentro && activeDetailView === "members") {
    const mestres = centroProfiles.filter(p => p.role === "mestre");
    const alunos = centroProfiles.filter(p => p.role === "aluno");

    return (
      <>
        <div className="mx-auto w-full max-w-6xl">
          <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground" onClick={() => setActiveDetailView("overview")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para visão geral
          </Button>
          <HeroPanel
            className="mb-6"
            kicker="Painel do CT"
            title={`Membros de ${selectedCentro.nome}`}
            subtitle="Gestão dedicada de mestres e alunos"
            description="Visualize, filtre e administre membros em uma página própria, mantendo perfil, faixa, presença e ações principais acessíveis."
            stats={[
              { label: "Mestres", value: mestres.length },
              { label: "Alunos", value: alunos.length },
              { label: "Total", value: mestres.length + alunos.length },
            ]}
          />
          {renderMembersContent(mestres, alunos)}
        </div>
        {renderMemberDialog()}
        {renderProfileDialog()}
        {renderDeleteConfirmDialog()}
      </>
    );
  }

  if (selectedCentro) {
    const mestres = centroProfiles.filter(p => p.role === "mestre");
    const alunos = centroProfiles.filter(p => p.role === "aluno");

    const faixaCountAll: Record<string, number> = {};
    centroProfiles.forEach(p => {
      const f = p.faixa || "branca";
      faixaCountAll[f] = (faixaCountAll[f] || 0) + 1;
    });

    const sexoCount: Record<string, number> = { masculino: 0, feminino: 0, outro: 0 };
    centroProfiles.forEach(p => {
      const s = p.sexo || "não informado";
      if (s === "masculino") sexoCount.masculino++;
      else if (s === "feminino") sexoCount.feminino++;
      else sexoCount.outro++;
    });

    const d = selectedCentro as any;
    const ctStyle = {
      primary: d.cor_primaria || "#dc2626",
      banner: d.banner_url ? selectedCentroAssetUrls[d.banner_url] || null : null,
      logo: d.logo_url ? selectedCentroAssetUrls[d.logo_url] || null : null,
      logoSize: d.logo_size || "64",
      bannerPosition: d.banner_position || "50",
      logoBgColor: d.logo_bg_color || "#171717",
      logoBgEnabled: d.logo_bg_enabled !== false,
      subtitulo: d.subtitulo || "Centro de Treinamento de Jiu-Jitsu",
      endereco: d.endereco || "",
      nomeFontSize: d.nome_font_size || "28",
      enderecoFontSize: d.endereco_font_size || "14",
      subtituloFontSize: d.subtitulo_font_size || "14",
      nomeFontFamily: d.nome_font_family || "heading",
      enderecoFontFamily: d.endereco_font_family || "sans",
      subtituloFontFamily: d.subtitulo_font_family || "sans",
      nomeColor: d.nome_color || "#ffffff",
      enderecoColor: d.endereco_color || "#a1a1aa",
      subtituloColor: d.subtitulo_color || "#a1a1aa",
    };

    const getFontFamily = (family: string) => {
      if (family === "heading") return undefined;
      if (family === "sans") return "'Inter', sans-serif";
      return family;
    };


    return (
      <div>
        {!selectedCentroId && (
          <Button variant="ghost" size="sm" className="mb-4 mt-4 text-muted-foreground" onClick={() => setSelectedCentro(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        )}
        <div className="mb-6 mt-4">
          <HeroPanel
            kicker="Painel do CT"
            title={selectedCentro.nome}
            subtitle={ctStyle.subtitulo}
            description={ctStyle.endereco || "Centro de treinamento com visão consolidada de membros, aulas, presença e operação."}
            logoUrl={ctStyle.logo}
            bannerUrl={ctStyle.banner}
            bannerPosition={ctStyle.bannerPosition}
            logoSize={Math.min(Number(ctStyle.logoSize) || 64, 96)}
            titleStyle={{
              fontSize: `${ctStyle.nomeFontSize}px`,
              color: ctStyle.nomeColor,
              fontFamily: getFontFamily(ctStyle.nomeFontFamily),
            }}
            subtitleStyle={{
              fontSize: `${ctStyle.subtituloFontSize}px`,
              color: ctStyle.subtituloColor,
              fontFamily: getFontFamily(ctStyle.subtituloFontFamily),
            }}
            stats={[
              { label: "Mestres", value: mestres.length },
              { label: "Alunos", value: alunos.length },
              { label: "Total de membros", value: mestres.length + alunos.length },
              { label: "Faixas ativas", value: Object.keys(faixaCountAll).length },
            ]}
            actions={
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <ActionButton emphasis="primary" className="gap-2 px-5">
                      <Users className="h-4 w-4" />
                      Membros
                      <ChevronDown className="h-3.5 w-3.5" />
                    </ActionButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Membros do CT</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openMembersPage("mestres")} className="flex justify-between">
                      <span>Mestres</span>
                      <span className="text-xs text-muted-foreground">{mestres.length}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openMembersPage("alunos")} className="flex justify-between">
                      <span>Alunos</span>
                      <span className="text-xs text-muted-foreground">{alunos.length}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ActionButton emphasis="secondary" size="icon" onClick={() => setActiveDetailView("chamada")} title="Chamada">
                  <UserCheck className="h-4 w-4" />
                </ActionButton>
                <ActionButton emphasis="secondary" size="icon" onClick={() => setActiveDetailView("horarios")} title="Horários de Aulas">
                  <Clock className="h-4 w-4" />
                </ActionButton>
                <ActionButton emphasis="secondary" size="icon" onClick={() => setActiveDetailView("mensagens")} title="Mensagens">
                  <MessageSquare className="h-4 w-4" />
                </ActionButton>
                <ActionButton emphasis="secondary" size="icon" onClick={() => setActiveDetailView("metricas")} title="Métricas de Graduação">
                  <BarChart3 className="h-4 w-4" />
                </ActionButton>
                <ActionButton emphasis="secondary" size="icon" onClick={() => setActiveDetailView("financeiro")} title="Financeiro">
                  <DollarSign className="h-4 w-4" />
                </ActionButton>
                <ActionButton emphasis="secondary" size="icon" onClick={() => setActiveDetailView("relatorios")} title="Relatórios & Analytics">
                  <FileText className="h-4 w-4" />
                </ActionButton>
                <ActionButton emphasis="ghost" size="icon" onClick={() => setActiveDetailView("config")} title="Configurações do CT">
                  <Settings className="h-4 w-4" />
                </ActionButton>
                {isCallerAdmin && (
                  <ActionButton emphasis="ghost" size="icon" onClick={(e) => handleEdit(e as any, selectedCentro)} title="Editar CT">
                    <Edit2 className="h-4 w-4" />
                  </ActionButton>
                )}
                {isCallerAdmin && (
                  <ActionButton emphasis="danger" size="icon" onClick={(e) => handleDelete(e as any, selectedCentro.id)} title="Excluir CT">
                    <Trash2 className="h-4 w-4" />
                  </ActionButton>
                )}
              </>
            }
          />
        </div>

        {/* CT Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setNome(""); setEndereco(""); setEditingId(null); } }}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground">{editingId ? "Editar Centro" : "Novo Centro"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do centro" className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Endereço</Label>
                <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço" className="bg-secondary border-border text-foreground" />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Member CRUD dialog */}
        {renderMemberDialog()}

        {loadingDetail ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard icon={Award} label="Mestres" value={mestres.length} description="Instrutores e líderes cadastrados neste CT." />
              <DashboardCard icon={Users} label="Alunos" value={alunos.length} description="Base ativa de praticantes vinculados." />
              <DashboardCard icon={Phone} label="Total de membros" value={mestres.length + alunos.length} description="Leitura consolidada de pessoas no CT." />
              <DashboardCard icon={Mail} label="Faixas ativas" value={Object.keys(faixaCountAll).length} description="Quantidade de faixas com membros distribuídos." />
            </div>

            <ChartCard title="Distribuição por sexo" icon={User}>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="text-center">
                  <p className="font-heading text-2xl text-foreground">{sexoCount.masculino}</p>
                  <p className="text-muted-foreground text-sm">Masculino</p>
                </div>
                <div className="text-center">
                  <p className="font-heading text-2xl text-foreground">{sexoCount.feminino}</p>
                  <p className="text-muted-foreground text-sm">Feminino</p>
                </div>
                <div className="text-center">
                  <p className="font-heading text-2xl text-foreground">{sexoCount.outro}</p>
                  <p className="text-muted-foreground text-sm">Não informado</p>
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Membros por faixa" icon={Award} className="mt-8">
              {(() => {
                const chartData = FAIXA_ORDER
                  .filter(f => faixaCountAll[f])
                  .map(f => ({ faixa: f, count: faixaCountAll[f] }));
                if (chartData.length === 0) return <p className="text-muted-foreground text-sm">Nenhum membro cadastrado.</p>;
                return (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="faixa" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 16, color: "hsl(var(--foreground))", boxShadow: "0 24px 50px -32px hsl(var(--shadow-color) / 0.6)" }}
                        formatter={(value: number) => [value, "Membros"]}
                        labelFormatter={(label: string) => label.charAt(0).toUpperCase() + label.slice(1)}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell key={entry.faixa} fill={FAIXA_COLORS_HEX[entry.faixa] || "#888"} stroke="hsl(var(--border))" strokeWidth={1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </ChartCard>

            <div className="mx-auto mt-8 w-full max-w-sm sm:max-w-none">
              <AttendanceChart ctId={selectedCentro.id} />
            </div>

            <div className="mx-auto mt-8 w-full max-w-sm sm:max-w-none">
              <AttendanceRanking ctId={selectedCentro.id} role="admin" />
            </div>

            <div className="mx-auto mt-8 w-full max-w-sm sm:max-w-none">
              <ScheduleWidget ctId={selectedCentro.id} showAttendance={true} />
            </div>
          </>
        )}
        {renderMemberDialog()}
        {renderProfileDialog()}
        {renderDeleteConfirmDialog()}
        <AlertDialog open={ctDeleteConfirmOpen} onOpenChange={setCtDeleteConfirmOpen}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Confirmar exclusão do Centro</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Tem certeza que deseja excluir este centro? Todos os dados relacionados (presenças, avaliações, horários, mensagens) serão removidos. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-secondary border-border text-foreground hover:bg-secondary/80">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteCentro} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir Centro
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Fallback: list view (for non-admin usage)
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl uppercase text-foreground">Centros de Treinamento</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setNome(""); setEndereco(""); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm"><Plus className="mr-2 h-4 w-4" /> Novo Centro</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground">{editingId ? "Editar Centro" : "Novo Centro"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do centro" className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Endereço</Label>
                <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço" className="bg-secondary border-border text-foreground" />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : centros.length === 0 ? (
        <div className="glass-card rounded-lg p-8 text-center">
          <p className="text-muted-foreground">Nenhum centro cadastrado.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {centros.map((ct) => (
            <div key={ct.id} className="glass-card rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fetchCentroDetails(ct, { resetDetailView: true })}>
              <div>
                <p className="text-foreground font-medium">{ct.nome}</p>
                <p className="text-muted-foreground text-sm">{ct.endereco || "Sem endereço"}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={(e) => handleEdit(e, ct)}><Edit2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, ct.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={ctDeleteConfirmOpen} onOpenChange={setCtDeleteConfirmOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar exclusão do Centro</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir este centro? Todos os dados relacionados (presenças, avaliações, horários, mensagens) serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border text-foreground hover:bg-secondary/80">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCentro} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir Centro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CentrosSection;


