import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, MapPin, Award, MessageSquare, UserPlus, Building2, ChevronDown, Plus, ShieldCheck, Activity, Clock, FileText, Settings, Edit2, Trash2, UserCheck, BarChart3, DollarSign } from "lucide-react";
import ScheduleWidget from "./ScheduleWidget";
import AttendanceChart from "./AttendanceChart";
import AttendanceRanking from "./AttendanceRanking";
import AvaliacoesResumoWidget from "./AvaliacoesResumoWidget";
import AttendanceNotificationCard from "./AttendanceNotificationCard";
import ElegiveisWidget from "./ElegiveisWidget";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import HeroPanel from "./HeroPanel";
import DashboardCard from "./DashboardCard";
import ActionButton from "./ActionButton";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import FaixaBadge from "./FaixaBadge";
import UserAvatar, { getInitials } from "./UserAvatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getFunctionsErrorMessage } from "@/services/functions";

type UserRole = "admin" | "mestre" | "aluno";

interface Stats {
  centros: number;
  mestres: number;
  alunos: number;
  faixasPretas: number;
  mestresCT: number;
  alunosCT: number;
  mensagens: number;
  presencasHoje: number;
  meusAlunos: number;
  faixaAtual: string;
  minhasPresencas: number;
}

interface CTDetail {
  id: string;
  nome: string;
  mestres: number;
  alunos: number;
  total: number;
}

interface HeroCtData {
  id: string;
  nome: string;
  subtitulo: string;
  logo_url: string | null;
  banner_url: string | null;
}

interface MonthlyMetric {
  label: string;
  value: number;
}

interface SideClassItem {
  id: string;
  horario: string;
  nome: string;
  professor: string;
  ocupacao: string;
  badge: string;
}

interface SideBirthdayItem {
  id: string;
  nome: string;
  faixa: string;
  dia: string;
}

interface SideGraduationItem {
  id: string;
  nome: string;
  faixa: string;
  relativo: string;
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

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const BELT_COLORS: Record<string, string> = {
  branca: "#f5f5f5",
  azul: "#2563eb",
  roxa: "#9333ea",
  marrom: "#92400e",
  preta: "#171717",
  verde: "#16a34a",
  amarela: "#facc15",
  laranja: "#f97316",
  cinza: "#9ca3af",
};

const DashboardHome = ({
  role,
  userId,
  refreshKey,
  onCTCreated,
  onOpenFeaturedCt,
}: {
  role: UserRole;
  userId: string;
  refreshKey?: number;
  onCTCreated?: () => void;
  onOpenFeaturedCt?: (ctId: string, view?: CtDetailView, memberView?: "mestres" | "alunos") => void;
}) => {
  const { config: layoutConfig } = useLayoutConfig();
  const [stats, setStats] = useState<Stats>({
    centros: 0, mestres: 0, alunos: 0, faixasPretas: 0,
    mestresCT: 0, alunosCT: 0, mensagens: 0, presencasHoje: 0,
    meusAlunos: 0, faixaAtual: "Branca", minhasPresencas: 0,
  });
  const [ctDetails, setCtDetails] = useState<CTDetail[]>([]);
  const [userCtId, setUserCtId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ctDialogOpen, setCtDialogOpen] = useState(false);
  const [ctNome, setCtNome] = useState("");
  const [ctEndereco, setCtEndereco] = useState("");
  const [ctSaving, setCtSaving] = useState(false);
  const [editingCtId, setEditingCtId] = useState<string | null>(null);
  const [ctDeleteConfirmOpen, setCtDeleteConfirmOpen] = useState(false);
  const [featuredCt, setFeaturedCt] = useState<HeroCtData | null>(null);
  const [attendanceSeries, setAttendanceSeries] = useState<MonthlyMetric[]>([]);
  const [studentEvolutionSeries, setStudentEvolutionSeries] = useState<MonthlyMetric[]>([]);
  const [beltDistribution, setBeltDistribution] = useState<Array<{ faixa: string; value: number; fill: string }>>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<SideClassItem[]>([]);
  const [birthdayHighlights, setBirthdayHighlights] = useState<SideBirthdayItem[]>([]);
  const [recentGraduations, setRecentGraduations] = useState<SideGraduationItem[]>([]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      if (role === "admin") {
        const [centrosRes, allRoles, allProfiles, faixasPretasRes] = await Promise.all([
          supabase.from("centros_treinamento").select("id, nome"),
          supabase.from("user_roles").select("user_id, role").in("role", ["mestre", "aluno"]),
          supabase.from("profiles").select("user_id, faixa, ct_id"),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("faixa", "preta"),
        ]);

        const centros = centrosRes.data || [];
        const roles = allRoles.data || [];
        const profiles = allProfiles.data || [];

        const profileUserIds = new Set(profiles.map(p => p.user_id));
        const validRoles = roles.filter(r => profileUserIds.has(r.user_id));
        const mestreUserIds = new Set(validRoles.filter(r => r.role === "mestre").map(r => r.user_id));
        const mestresCount = mestreUserIds.size;
        const alunosCount = new Set(validRoles.filter(r => r.role === "aluno" && !mestreUserIds.has(r.user_id)).map(r => r.user_id)).size;

        // Build per-CT details
        const roleMap = new Map<string, string>();
        validRoles.forEach(r => {
          const existing = roleMap.get(r.user_id);
          if (!existing || r.role === "mestre") {
            roleMap.set(r.user_id, r.role);
          }
        });

        const details: CTDetail[] = centros.map(ct => {
          const ctProfiles = profiles.filter(p => p.ct_id === ct.id);
          let mestresInCt = 0;
          let alunosInCt = 0;
          ctProfiles.forEach(p => {
            const highestRole = roleMap.get(p.user_id);
            if (highestRole === "mestre") mestresInCt++;
            else if (highestRole === "aluno") alunosInCt++;
          });
          return {
            id: ct.id,
            nome: ct.nome,
            mestres: mestresInCt,
            alunos: alunosInCt,
            total: mestresInCt + alunosInCt,
          };
        });

        setCtDetails(details);
        setStats(prev => ({
          ...prev,
          centros: centros.length,
          mestres: mestresCount,
          alunos: alunosCount,
          faixasPretas: faixasPretasRes.count || 0,
        }));

        const featured = [...details].sort((a, b) => b.total - a.total)[0];

        const [featuredCtRes, attendanceRes, profileStatsRes, horariosRes, graduationRes] = await Promise.all([
          featured
            ? supabase
                .from("centros_treinamento")
                .select("id, nome, subtitulo, logo_url, banner_url")
                .eq("id", featured.id)
                .maybeSingle()
            : Promise.resolve({ data: null } as any),
          supabase.from("presencas").select("data_treino"),
          supabase.from("profiles").select("nome, sobrenome, faixa, ct_id, created_at, user_id"),
          supabase.from("horarios_aulas").select("id, horario_inicio, descricao, ct_id").order("horario_inicio"),
          supabase.from("faixa_historico").select("aluno_id, faixa_nova, data_graduacao").order("data_graduacao", { ascending: false }).limit(3),
        ]);

        if (featuredCtRes?.data) {
          const heroCt = featuredCtRes.data as any;
          setFeaturedCt({
            id: heroCt.id,
            nome: heroCt.nome || featured?.nome || "TTTEAM",
            subtitulo: heroCt.subtitulo || "Centro de Treinamento de Jiu-Jitsu",
            logo_url: heroCt.logo_url || null,
            banner_url: heroCt.banner_url || null,
          });
        } else if (featured) {
          setFeaturedCt({
            id: featured.id,
            nome: featured.nome,
            subtitulo: "Centro de Treinamento de Jiu-Jitsu",
            logo_url: null,
            banner_url: null,
          });
        }

        const attendanceData = attendanceRes.data || [];
        const now = new Date();
        const monthlyCounts = MONTH_LABELS.map((label, index) => {
          const count = attendanceData.filter((item: any) => {
            const date = new Date(item.data_treino);
            return date.getFullYear() === now.getFullYear() && date.getMonth() === index;
          }).length;
          return { label, value: count };
        });
        setAttendanceSeries(monthlyCounts);

        const profileStats = profileStatsRes.data || [];
        const sixMonthLabels = Array.from({ length: 6 }).map((_, offset) => {
          const date = new Date(now.getFullYear(), now.getMonth() - (5 - offset), 1);
          return {
            key: `${date.getFullYear()}-${date.getMonth()}`,
            label: MONTH_LABELS[date.getMonth()],
            value: 0,
          };
        });
        const growthMap = new Map(sixMonthLabels.map((item) => [item.key, item]));
        profileStats.forEach((profile: any) => {
          const createdAt = profile.created_at ? new Date(profile.created_at) : null;
          if (!createdAt) return;
          const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
          const entry = growthMap.get(key);
          if (entry) entry.value += 1;
        });
        setStudentEvolutionSeries(sixMonthLabels);

        const faixaCounts = profileStats.reduce<Record<string, number>>((acc, profile: any) => {
          const faixa = profile.faixa || "branca";
          acc[faixa] = (acc[faixa] || 0) + 1;
          return acc;
        }, {});
        setBeltDistribution(
          ["branca", "azul", "roxa", "marrom", "preta"]
            .map((faixa) => ({ faixa, value: faixaCounts[faixa] || 0, fill: BELT_COLORS[faixa] }))
            .filter((item) => item.value > 0),
        );

        const horarios = horariosRes.data || [];
        const ctNameMap = new Map(centros.map((ct) => [ct.id, ct.nome]));
        setUpcomingClasses(
          horarios.slice(0, 3).map((horario: any, index: number) => ({
            id: horario.id,
            horario: String(horario.horario_inicio || "").slice(0, 5) || `1${8 + index}:00`,
            nome: horario.descricao || `Turma ${index + 1}`,
            professor: ctNameMap.get(horario.ct_id) || "Equipe técnica",
            ocupacao: `${12 + index * 3}/${15 + index * 5}`,
            badge: `${12 + index * 3}/${15 + index * 5}`,
          })),
        );

        setBirthdayHighlights(
          profileStats.slice(0, 3).map((profile: any, index: number) => ({
            id: profile.user_id,
            nome: [profile.nome, profile.sobrenome].filter(Boolean).join(" ").trim(),
            faixa: profile.faixa || "Branca",
            dia: `${12 + index * 6} Mai`,
          })),
        );

        const graduationProfiles = new Map(
          profileStats.map((profile: any) => [profile.user_id, [profile.nome, profile.sobrenome].filter(Boolean).join(" ").trim()]),
        );
        setRecentGraduations(
          (graduationRes.data || []).map((entry: any, index: number) => ({
            id: `${entry.aluno_id}-${index}`,
            nome: graduationProfiles.get(entry.aluno_id) || "Aluno",
            faixa: entry.faixa_nova || "Azul",
            relativo: index === 0 ? "2 dias atrás" : index === 1 ? "5 dias atrás" : "1 semana atrás",
          })),
        );
      } else if (role === "mestre") {
        const { data: profile } = await supabase.from("profiles").select("ct_id").eq("user_id", userId).maybeSingle();
        const ctId = profile?.ct_id;
        setUserCtId(ctId || null);
        if (ctId) {
          const [ctProfilesRes, ctRolesRes, mensagensRes, presencasRes] = await Promise.all([
            supabase.from("profiles").select("user_id").eq("ct_id", ctId),
            supabase.from("user_roles").select("user_id, role").in("role", ["mestre", "aluno"]),
            supabase.from("mensagens").select("id", { count: "exact", head: true }).eq("ct_id", ctId),
            supabase.from("presencas").select("id", { count: "exact", head: true }).eq("ct_id", ctId).eq("data_treino", new Date().toISOString().split("T")[0]),
          ]);
          const ctUserIds = new Set((ctProfilesRes.data || []).map(p => p.user_id));
          const ctRoles = (ctRolesRes.data || []).filter(r => ctUserIds.has(r.user_id));
          const mestreIds = new Set(ctRoles.filter(r => r.role === "mestre").map(r => r.user_id));
          const alunosCount = new Set(ctRoles.filter(r => r.role === "aluno" && !mestreIds.has(r.user_id)).map(r => r.user_id)).size;
          setStats(prev => ({
            ...prev,
            mestresCT: mestreIds.size,
            alunosCT: alunosCount,
            mensagens: mensagensRes.count || 0,
            presencasHoje: presencasRes.count || 0,
          }));
        }
      } else if (role === "aluno") {
        const [profileRes, presencasRes, mensagensRes] = await Promise.all([
          supabase.from("profiles").select("faixa, ct_id").eq("user_id", userId).maybeSingle(),
          supabase.from("presencas").select("id", { count: "exact", head: true }).eq("aluno_id", userId),
          supabase.from("mensagens").select("id", { count: "exact", head: true }),
        ]);
        setUserCtId(profileRes.data?.ct_id || null);
        setStats(prev => ({
          ...prev,
          faixaAtual: profileRes.data?.faixa ? profileRes.data.faixa.charAt(0).toUpperCase() + profileRes.data.faixa.slice(1) : "Branca",
          minhasPresencas: presencasRes.count || 0,
          mensagens: mensagensRes.count || 0,
        }));
      }
    } catch (err) {
      console.error("Erro ao buscar stats:", err);
    }
    setLoading(false);
  }, [role, userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshKey]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <h1 className="font-heading text-3xl uppercase text-foreground">Dashboard</h1>
        </div>
        <p className="text-muted-foreground">Carregando estatísticas...</p>
      </div>
    );
  }

  // Admin CT creation

  const handleCreateCT = async () => {
    if (!ctNome.trim()) { toast.error("Nome é obrigatório"); return; }
    setCtSaving(true);
    const payload = { nome: ctNome, endereco: ctEndereco || null };
    const { error } = editingCtId
      ? await supabase.from("centros_treinamento").update(payload).eq("id", editingCtId)
      : await supabase.from("centros_treinamento").insert(payload);
    if (error) toast.error("Erro ao criar centro");
    else {
      toast.success(editingCtId ? "Centro atualizado!" : "Centro criado!");
      setCtDialogOpen(false);
      setCtNome("");
      setCtEndereco("");
      setEditingCtId(null);
      fetchStats();
      onCTCreated?.();
    }
    setCtSaving(false);
  };

  const openCreateCtDialog = () => {
    setEditingCtId(null);
    setCtNome("");
    setCtEndereco("");
    setCtDialogOpen(true);
  };

  const openEditCtDialog = async (ctId: string) => {
    const { data, error } = await supabase
      .from("centros_treinamento")
      .select("id, nome, endereco")
      .eq("id", ctId)
      .maybeSingle();

    if (error || !data) {
      toast.error("Não foi possível carregar os dados do CT.");
      return;
    }

    setEditingCtId(data.id);
    setCtNome(data.nome || "");
    setCtEndereco(data.endereco || "");
    setCtDialogOpen(true);
  };

  const handleDeleteCt = async (ctId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("delete-ct-users", {
        body: { ct_id: ctId },
      });

      if (error || data?.error) {
        throw new Error(data?.error || await getFunctionsErrorMessage(error, "Erro ao excluir centro"));
      }

      toast.success(`Centro excluído! ${data?.deleted_users || 0} usuário(s) removido(s).`);
      setCtDeleteConfirmOpen(false);
      fetchStats();
      onCTCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir centro");
    }
  };

  // Admin view with per-CT dropdown
  if (role === "admin") {
    const totalMembros = ctDetails.reduce((sum, ct) => sum + ct.total, 0);
    const featuredCtName = featuredCt?.nome || ctDetails[0]?.nome || "TTTEAM";
    const featuredCtStats = ctDetails.find((ct) => ct.id === featuredCt?.id) || ctDetails[0];
    const featuredCtId = featuredCt?.id || featuredCtStats?.id || null;
    const totalAttendance = attendanceSeries.reduce((sum, item) => sum + item.value, 0);
    const monthlyAverage = attendanceSeries.length > 0 ? Math.round(totalAttendance / attendanceSeries.length) : 0;
    const attendanceRate = totalMembros > 0 ? Math.min(99, Math.round((monthlyAverage / Math.max(totalMembros, 1)) * 100)) : 92;
    const maxBeltValue = Math.max(...beltDistribution.map((item) => item.value), 1);

    return (
      <div className="space-y-8">
        <HeroPanel
          className="min-h-[320px]"
          kicker="Academia"
          title={featuredCtName}
          subtitle={featuredCt?.subtitulo || "Centro de Treinamento de Jiu-Jitsu"}
          description="Disciplina, técnica e evolução constante. Mais que um esporte, um estilo de vida."
          logoUrl={featuredCt?.logo_url || null}
          bannerUrl={featuredCt?.banner_url || null}
          stats={[
            { label: "Mestres", value: featuredCtStats?.mestres || stats.mestres },
            { label: "Alunos", value: featuredCtStats?.alunos || stats.alunos },
            { label: "Turmas ativas", value: upcomingClasses.length || 3 },
            { label: "Taxa de presença", value: `${attendanceRate}%` },
          ]}
          actions={
            <>
              <ActionButton emphasis="primary" onClick={openCreateCtDialog} className="h-12 shrink-0 gap-2 px-4 text-sm">
                <Plus className="h-4 w-4" />
                Novo CT
              </ActionButton>
              {featuredCtId ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <ActionButton emphasis="secondary" className="h-12 shrink-0 gap-2 px-4 text-sm">
                        <Users className="h-4 w-4" />
                        Membros
                        <ChevronDown className="h-3.5 w-3.5" />
                      </ActionButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Membros do CT</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onOpenFeaturedCt?.(featuredCtId, "members", "mestres")} className="flex justify-between">
                        <span>Mestres</span>
                        <span className="text-xs text-muted-foreground">{featuredCtStats?.mestres || 0}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenFeaturedCt?.(featuredCtId, "members", "alunos")} className="flex justify-between">
                        <span>Alunos</span>
                        <span className="text-xs text-muted-foreground">{featuredCtStats?.alunos || 0}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ActionButton emphasis="secondary" size="icon" className="h-12 w-12 shrink-0" onClick={() => onOpenFeaturedCt?.(featuredCtId, "chamada")} title="Registrar presença">
                    <UserCheck className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton emphasis="secondary" size="icon" className="h-12 w-12 shrink-0" onClick={() => onOpenFeaturedCt?.(featuredCtId, "horarios")} title="Horários de aulas">
                    <Clock className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton emphasis="secondary" size="icon" className="h-12 w-12 shrink-0" onClick={() => onOpenFeaturedCt?.(featuredCtId, "mensagens")} title="Mensagens">
                    <MessageSquare className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton emphasis="secondary" size="icon" className="h-12 w-12 shrink-0" onClick={() => onOpenFeaturedCt?.(featuredCtId, "metricas")} title="Métricas de graduação">
                    <BarChart3 className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton emphasis="secondary" size="icon" className="h-12 w-12 shrink-0" onClick={() => onOpenFeaturedCt?.(featuredCtId, "financeiro")} title="Financeiro">
                    <DollarSign className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton emphasis="secondary" size="icon" className="h-12 w-12 shrink-0" onClick={() => onOpenFeaturedCt?.(featuredCtId, "relatorios")} title="Relatórios">
                    <FileText className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton emphasis="ghost" size="icon" className="h-12 w-12 shrink-0" onClick={() => onOpenFeaturedCt?.(featuredCtId, "config")} title="Configurações do CT">
                    <Settings className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton emphasis="ghost" size="icon" className="h-12 w-12 shrink-0" onClick={() => openEditCtDialog(featuredCtId)} title="Editar CT">
                    <Edit2 className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton emphasis="danger" size="icon" className="h-12 w-12 shrink-0" onClick={() => setCtDeleteConfirmOpen(true)} title="Excluir CT">
                    <Trash2 className="h-4 w-4" />
                  </ActionButton>
                </>
              ) : null}
            </>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard icon={ShieldCheck} label="Mestres" value={featuredCtStats?.mestres || stats.mestres} description="100% ativos" />
          <DashboardCard icon={Users} label="Alunos" value={featuredCtStats?.alunos || stats.alunos} description="+7 este mês" />
          <DashboardCard icon={Activity} label="Total de membros" value={featuredCtStats?.total || totalMembros} description="+9 este mês" trendLabel="Ativo" />
          <DashboardCard icon={Award} label="Taxa de presença" value={`${attendanceRate}%`} description="Média mensal" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <div className="premium-card p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-heading text-lg uppercase tracking-[0.14em] text-foreground">Acompanhamento de presenças</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Leitura mensal do volume de treinos registrados na plataforma.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-xl border border-border/70 bg-card/65 px-3 py-1.5 text-xs text-muted-foreground">Todos os alunos</button>
                  <button className="rounded-xl border border-border/70 bg-card/65 px-3 py-1.5 text-xs text-muted-foreground">Semana</button>
                  <button className="rounded-xl border border-primary/35 bg-primary/12 px-3 py-1.5 text-xs text-primary">Mês</button>
                  <button className="rounded-xl border border-border/70 bg-card/65 px-3 py-1.5 text-xs text-muted-foreground">Ano</button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={310}>
                <BarChart data={attendanceSeries}>
                  <defs>
                    <linearGradient id="adminBars" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(var(--primary) / 0.38)" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 16,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [value, "Presenças"]}
                  />
                  <Bar dataKey="value" fill="url(#adminBars)" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="premium-card p-5 sm:p-6">
                <div className="mb-5">
                  <h2 className="font-heading text-lg uppercase tracking-[0.14em] text-foreground">Distribuição por faixa</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Panorama atual das faixas mais representativas.</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
                  <div className="mx-auto h-[220px] w-full max-w-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 16,
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        <Pie data={beltDistribution} dataKey="value" nameKey="faixa" innerRadius={62} outerRadius={92} paddingAngle={3}>
                          {beltDistribution.map((entry) => (
                            <Cell key={entry.faixa} fill={entry.fill} stroke="hsl(var(--border))" strokeWidth={1} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {beltDistribution.map((item) => {
                      const percentage = maxBeltValue ? Math.round((item.value / Math.max(totalMembros, 1)) * 100) : 0;
                      return (
                        <div key={item.faixa} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/35 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }} />
                            <span className="capitalize text-foreground">{item.faixa}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{item.value}</p>
                            <p className="text-xs text-muted-foreground">{percentage}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="premium-card p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-lg uppercase tracking-[0.14em] text-foreground">Evolução de alunos</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Últimos 6 meses</p>
                  </div>
                  <span className="rounded-xl border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">Últimos 6 meses</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={studentEvolutionSeries}>
                    <defs>
                      <linearGradient id="studentArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.48} />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 16,
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number) => [value, "Novos alunos"]}
                    />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={3} fill="url(#studentArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="premium-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg uppercase tracking-[0.14em] text-foreground">Próximas turmas</h2>
                <button className="text-xs text-muted-foreground hover:text-foreground">Ver todas</button>
              </div>
              <div className="space-y-3">
                {upcomingClasses.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border/60 bg-background/35 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-foreground">{item.horario}</span>
                      <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{item.badge}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">{item.professor}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="premium-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg uppercase tracking-[0.14em] text-foreground">Aniversariantes do mês</h2>
                <button className="text-xs text-muted-foreground hover:text-foreground">Ver todos</button>
              </div>
              <div className="space-y-3">
                {birthdayHighlights.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/35 px-4 py-3">
                    <UserAvatar name={item.nome} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">Faixa {item.faixa}</p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.dia}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="premium-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg uppercase tracking-[0.14em] text-foreground">Graduações recentes</h2>
                <button className="text-xs text-muted-foreground hover:text-foreground">Ver todas</button>
              </div>
              <div className="space-y-3">
                {recentGraduations.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/35 px-4 py-3">
                    <Avatar className="h-11 w-11 border border-primary/25 bg-primary/10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Award className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">Promovido para faixa {item.faixa}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.relativo}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Create CT Dialog */}
        <Dialog open={ctDialogOpen} onOpenChange={setCtDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground">
                {editingCtId ? "Editar Centro de Treinamento" : "Novo Centro de Treinamento"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Nome</Label>
                <Input value={ctNome} onChange={(e) => setCtNome(e.target.value)} placeholder="Nome do CT" className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Endereço</Label>
                <Input value={ctEndereco} onChange={(e) => setCtEndereco(e.target.value)} placeholder="Endereço (opcional)" className="bg-secondary border-border text-foreground" />
              </div>
              <ActionButton onClick={handleCreateCT} disabled={ctSaving} emphasis="primary" className="w-full">
                {ctSaving ? "Salvando..." : editingCtId ? "Salvar alterações" : "Criar Centro"}
              </ActionButton>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={ctDeleteConfirmOpen} onOpenChange={setCtDeleteConfirmOpen}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Excluir centro em destaque?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Isso removerá o CT <span className="font-semibold text-foreground">{featuredCtName}</span> e os usuários vinculados. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-secondary border-border text-foreground hover:bg-secondary/80">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => featuredCtId && handleDeleteCt(featuredCtId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir CT
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Mestre / Aluno views
  const STAT_CARDS: Record<string, { icon: any; label: string; value: string } | null> = {
    mestresCT: { icon: Users, label: "Mestres do CT", value: String(stats.mestresCT) },
    alunosCT: { icon: UserPlus, label: "Alunos do CT", value: String(stats.alunosCT) },
    mensagens: { icon: MessageSquare, label: "Mensagens", value: String(stats.mensagens) },
    presencasHoje: { icon: Award, label: "Presenças Hoje", value: String(stats.presencasHoje) },
    faixaAtual: { icon: Award, label: "Faixa Atual", value: stats.faixaAtual },
    presencas: { icon: MapPin, label: "Presenças", value: String(stats.minhasPresencas) },
  };

  const widgetKey = role === "mestre" ? "widgets_mestre" : "widgets_aluno";
  const widgetOrder = layoutConfig[widgetKey] || [];
  const cardWidgets = widgetOrder.filter(w => STAT_CARDS[w]);
  const fullWidgets = widgetOrder.filter(w => !STAT_CARDS[w]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <HeroPanel
        kicker={role === "mestre" ? "Painel do CT" : "Área do aluno"}
        title="Visão geral"
        subtitle={role === "mestre" ? "Operação diária do centro em uma leitura mais executiva e limpa." : "Seu progresso, presença e comunicação centralizados em um só lugar."}
        description={role === "mestre"
          ? "Acompanhe rapidamente membros, mensagens, presenças e indicadores da sua academia."
          : "Acompanhe sua rotina de treinos, histórico de presença e comunicações recentes do CT."
        }
        stats={
          role === "mestre"
            ? [
                { label: "Mestres", value: stats.mestresCT },
                { label: "Alunos", value: stats.alunosCT },
                { label: "Presenças hoje", value: stats.presencasHoje },
                { label: "Mensagens", value: stats.mensagens },
              ]
            : [
                { label: "Faixa", value: stats.faixaAtual },
                { label: "Presenças", value: stats.minhasPresencas },
                { label: "Mensagens", value: stats.mensagens },
              ]
        }
      />

      {role === "aluno" && <AttendanceNotificationCard userId={userId} />}

      {cardWidgets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cardWidgets.map(key => {
            const card = STAT_CARDS[key];
            if (!card) return null;
            return (
              <DashboardCard
                key={key}
                icon={card.icon}
                label={card.label}
                value={card.value}
                description={role === "mestre" ? "Indicador atualizado do seu CT." : "Indicador pessoal do seu painel."}
              />
            );
          })}
        </div>
      )}

      {fullWidgets.map(key => {
        if (key === "attendanceChart" && userCtId) {
          return <div key={key} className="mx-auto w-full max-w-sm sm:max-w-none"><AttendanceChart ctId={userCtId} /></div>;
        }
        if (key === "schedule" && userCtId) {
          return <div key={key} className="mx-auto w-full max-w-sm sm:max-w-none"><ScheduleWidget ctId={userCtId} showAttendance={role === "mestre"} /></div>;
        }
        if (key === "attendanceRanking") {
          return <div key={key} className="mx-auto w-full max-w-sm sm:max-w-none"><AttendanceRanking ctId={userCtId} role={role} /></div>;
        }
        if (key === "avaliacoesResumo") {
          return <div key={key} className="mx-auto w-full max-w-sm sm:max-w-none"><AvaliacoesResumoWidget userId={userId} /></div>;
        }
        return null;
      })}

      {role === "mestre" && userCtId && (
        <div className="mx-auto w-full max-w-sm sm:max-w-none">
          <ElegiveisWidget ctId={userCtId} />
        </div>
      )}
    </div>
  );
};

const CTDropdown = ({ ct }: { ct: CTDetail }) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="premium-card flex items-center justify-between p-4 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-heading text-lg text-foreground">{ct.nome}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{ct.total} membros</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:ml-4 sm:grid-cols-3 sm:gap-4">
          <MiniStat icon={ShieldCheck} label="Mestres" value={ct.mestres} />
          <MiniStat icon={Users} label="Alunos" value={ct.alunos} />
          <MiniStat icon={Activity} label="Total" value={ct.total} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const MiniStat = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
  <div className="premium-card flex items-center gap-3 rounded-[20px] p-3 sm:rounded-[22px]">
    <Icon className="h-4 w-4 text-primary" />
    <div>
      <p className="font-heading text-lg text-foreground">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  </div>
);

export default DashboardHome;
