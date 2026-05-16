import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, MapPin, Award, LogOut, MessageSquare, BarChart3, UserPlus, Building2, Plus, GraduationCap, Settings, Clock, UserCheck, ChevronDown, ArrowLeft, Pencil, TrendingUp, Menu, DollarSign, Search, Bell, CircleHelp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import CentrosSection from "@/components/dashboard/CentrosSection";
import MestresSection from "@/components/dashboard/MestresSection";
import AlunosSection from "@/components/dashboard/AlunosSection";
import DashboardHome from "@/components/dashboard/DashboardHome";
import ConfiguracoesSection from "@/components/dashboard/ConfiguracoesSection";
import HorariosSection from "@/components/dashboard/HorariosSection";
import ChamadaSection from "@/components/dashboard/ChamadaSection";
import MensagensSection from "@/components/dashboard/MensagensSection";
import AlunoPagamentosSection from "@/components/dashboard/AlunoPagamentosSection";
import Snowflakes from "@/components/Snowflakes";
import MetricasGraduacaoSection from "@/components/dashboard/metricas/MetricasGraduacaoSection";
import logo from "@/assets/logo.png";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { useResolvedCtAssetUrls } from "@/hooks/useResolvedCtAssetUrls";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { paletteOptions, useThemeSettings } from "@/components/theme/ThemeProvider";
import UserAvatar from "@/components/dashboard/UserAvatar";

type UserRole = "admin" | "mestre" | "aluno";
type ActiveSection = "dashboard" | "centros" | "mestres" | "alunos" | "mensagens" | "faixa" | "centro_detail" | "configuracoes" | "horarios" | "chamada" | "metricas" | "pagamentos";
type CtDetailView = "overview" | "config" | "horarios" | "relatorios" | "chamada" | "mensagens" | "metricas" | "financeiro" | "members";

interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  nome: string;
  sobrenome?: string;
  telefone?: string;
  username?: string;
}

interface Centro {
  id: string;
  nome: string;
  endereco: string | null;
}

interface CTMemberCount {
  id: string;
  nome: string;
  total: number;
}

const Dashboard = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [centros, setCentros] = useState<Centro[]>([]);
  const [selectedCentroId, setSelectedCentroId] = useState<string | null>(null);
  const [neveAtiva, setNeveAtiva] = useState(false);
  const [mestreCtId, setMestreCtId] = useState<string | null>(null);
  const [mestreCtNome, setMestreCtNome] = useState<string>("");
  const [mestreCtConfig, setMestreCtConfig] = useState<{
    nome: string; subtitulo: string; endereco: string; logo_url: string; logo_size: string;
    banner_url: string; banner_position: string; nome_font_size: string;
    endereco_font_size: string; subtitulo_font_size: string;
    nome_font_family: string; endereco_font_family: string; subtitulo_font_family: string;
    nome_color: string; endereco_color: string; subtitulo_color: string;
  } | null>(null);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [ctMemberCounts, setCtMemberCounts] = useState<CTMemberCount[]>([]);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [adminInitialCtView, setAdminInitialCtView] = useState<CtDetailView>("overview");
  const [adminInitialMemberView, setAdminInitialMemberView] = useState<"mestres" | "alunos">("alunos");
  const [adminSelectedCtConfig, setAdminSelectedCtConfig] = useState<{
    nome: string; subtitulo: string; endereco: string; logo_url: string; logo_size: string;
    banner_url: string; banner_position: string; nome_font_size: string;
    endereco_font_size: string; subtitulo_font_size: string;
    nome_font_family: string; endereco_font_family: string; subtitulo_font_family: string;
    nome_color: string; endereco_color: string; subtitulo_color: string;
  } | null>(null);
  const [openCtConfig, setOpenCtConfig] = useState(false);
  const navigate = useNavigate();
  const { config: layoutConfig } = useLayoutConfig();
  const { palette, setPalette } = useThemeSettings();

  // Sidebar config from layout
  const sidebarPosition = layoutConfig.sidebar_position || "left";
  const sidebarSize = layoutConfig.sidebar_size || "normal";
  const iconOnly = layoutConfig.sidebar_icon_only || false;

  const sidebarWidth = iconOnly ? 64 : sidebarSize === "normal" ? 256 : sidebarSize === "compact" ? 200 : 180;
  const topBarHeight = 56;

  const fetchCtMemberCounts = async () => {
    const [centrosRes, profilesRes] = await Promise.all([
      supabase.from("centros_treinamento").select("id, nome").order("nome"),
      supabase.from("profiles").select("ct_id"),
    ]);
    const cts = centrosRes.data || [];
    const profiles = profilesRes.data || [];
    const counts: CTMemberCount[] = cts.map(ct => ({
      id: ct.id,
      nome: ct.nome,
      total: profiles.filter(p => p.ct_id === ct.id).length,
    }));
    setCtMemberCounts(counts);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateIsMobile = (event?: MediaQueryListEvent) => {
      setIsMobile(event ? event.matches : mediaQuery.matches);
    };

    updateIsMobile();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateIsMobile);
      return () => mediaQuery.removeEventListener("change", updateIsMobile);
    }

    mediaQuery.addListener(updateIsMobile);
    return () => mediaQuery.removeListener(updateIsMobile);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/login");
    });

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roles = (roleRows || []) as Array<{ role: UserRole }>;
      const role = roles.find((row) => row.role === "admin")
        ? "admin"
        : roles.find((row) => row.role === "mestre")
        ? "mestre"
        : "aluno";

      const { data: profileData } = await supabase
        .from("profiles")
        .select("nome, sobrenome, telefone, username, email")
        .eq("user_id", session.user.id)
        .single();

      setUser({
        id: session.user.id,
        email: profileData?.email || session.user.email || "",
        role,
        nome: profileData?.nome || session.user.email?.split("@")[0] || "Usuário",
        sobrenome: profileData?.sobrenome || "",
        telefone: profileData?.telefone || "",
        username: profileData?.username || "",
      });

      if (role === "admin") {
        const { data } = await supabase.from("centros_treinamento").select("id, nome, endereco").order("nome");
        setCentros(data || []);
        // Fetch member counts per CT
        await fetchCtMemberCounts();
      }

      if (role !== "admin") {
        const { data: profileCt } = await supabase
          .from("profiles")
          .select("ct_id")
          .eq("user_id", session.user.id)
          .single();

        if (profileCt?.ct_id) {
          setMestreCtId(profileCt.ct_id);
          const { data: ctData } = await supabase
            .from("centros_treinamento")
            .select("neve_ativa, nome, subtitulo, endereco, logo_url, logo_size, banner_url, banner_position, nome_font_size, endereco_font_size, subtitulo_font_size, nome_font_family, endereco_font_family, subtitulo_font_family, nome_color, endereco_color, subtitulo_color")
            .eq("id", profileCt.ct_id)
            .single();
          if (ctData) {
            const d = ctData as any;
            setMestreCtNome(d.nome || "");
            setMestreCtConfig({
              nome: d.nome || "", subtitulo: d.subtitulo || "", endereco: d.endereco || "",
              logo_url: d.logo_url || "", logo_size: d.logo_size || "64",
              banner_url: d.banner_url || "", banner_position: d.banner_position || "50",
              nome_font_size: d.nome_font_size || "28",
              endereco_font_size: d.endereco_font_size || "14", subtitulo_font_size: d.subtitulo_font_size || "14",
              nome_font_family: d.nome_font_family || "heading", endereco_font_family: d.endereco_font_family || "sans", subtitulo_font_family: d.subtitulo_font_family || "sans",
              nome_color: d.nome_color || "#ffffff", endereco_color: d.endereco_color || "#a1a1aa", subtitulo_color: d.subtitulo_color || "#a1a1aa",
            });
            if ((ctData as any).neve_ativa) {
              setNeveAtiva(true);
            }
          }
        }
      }

      setLoading(false);
    };

    checkAuth();
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch selected CT config for admin header branding
  const fetchAdminCtConfig = async (ctId: string) => {
    const { data } = await supabase
      .from("centros_treinamento")
      .select("neve_ativa, nome, subtitulo, endereco, logo_url, logo_size, banner_url, banner_position, nome_font_size, endereco_font_size, subtitulo_font_size, nome_font_family, endereco_font_family, subtitulo_font_family, nome_color, endereco_color, subtitulo_color")
      .eq("id", ctId)
      .single();
    if (data) {
      const d = data as any;
      setNeveAtiva(!!d.neve_ativa);
      setAdminSelectedCtConfig({
        nome: d.nome || "", subtitulo: d.subtitulo || "", endereco: d.endereco || "",
        logo_url: d.logo_url || "", logo_size: d.logo_size || "64",
        banner_url: d.banner_url || "", banner_position: d.banner_position || "50",
        nome_font_size: d.nome_font_size || "28",
        endereco_font_size: d.endereco_font_size || "14", subtitulo_font_size: d.subtitulo_font_size || "14",
        nome_font_family: d.nome_font_family || "heading", endereco_font_family: d.endereco_font_family || "sans", subtitulo_font_family: d.subtitulo_font_family || "sans",
        nome_color: d.nome_color || "#ffffff", endereco_color: d.endereco_color || "#a1a1aa", subtitulo_color: d.subtitulo_color || "#a1a1aa",
      });
    }
  };

  useEffect(() => {
    if (user?.role !== "admin") return;
    if (!selectedCentroId) {
      setNeveAtiva(false);
      setAdminSelectedCtConfig(null);
      return;
    }
    fetchAdminCtConfig(selectedCentroId);
  }, [selectedCentroId, user?.role]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/login");
  };

  const handleSelectCentro = (centroId: string) => {
    setAdminInitialCtView("overview");
    setAdminInitialMemberView("alunos");
    setSelectedCentroId(centroId);
    setActiveSection("centro_detail");
  };

  const openAdminCtView = (centroId: string, view: CtDetailView = "overview", memberView: "mestres" | "alunos" = "alunos") => {
    setAdminInitialCtView(view);
    setAdminInitialMemberView(memberView);
    setSelectedCentroId(centroId);
    setActiveSection("centro_detail");
  };

  const refreshCentros = async () => {
    const { data } = await supabase.from("centros_treinamento").select("id, nome, endereco").order("nome");
    setCentros(data || []);
    setDashboardRefreshKey(k => k + 1);
    await fetchCtMemberCounts();
  };

  const handleBackToOverview = () => {
    setAdminInitialCtView("overview");
    setAdminInitialMemberView("alunos");
    setSelectedCentroId(null);
    setActiveSection("dashboard");
    setDashboardRefreshKey(k => k + 1);
  };

  const handleGoToRoleHome = () => {
    if (isAdmin) {
      handleBackToOverview();
      return;
    }

    if (user?.role === "mestre") {
      setActiveSection("dashboard");
      setDashboardRefreshKey((k) => k + 1);
      return;
    }

    setActiveSection("dashboard");
  };

  const isAdmin = user?.role === "admin";
  const headerHeight = 104;
  const activeCtConfig = isAdmin ? adminSelectedCtConfig : mestreCtConfig;
  const resolvedCtAssets = useResolvedCtAssetUrls(
    [activeCtConfig?.banner_url, activeCtConfig?.logo_url],
    Boolean(activeCtConfig),
  );
  const bannerUrl = activeCtConfig?.banner_url ? resolvedCtAssets[activeCtConfig.banner_url] || "" : "";
  const bannerPosition = activeCtConfig?.banner_position || "50";
  const headerLogoUrl = activeCtConfig?.logo_url ? resolvedCtAssets[activeCtConfig.logo_url] || "" : "";
  const headerLogoSize = activeCtConfig?.logo_url ? (Number(activeCtConfig.logo_size) || 48) : 48;
  const headerName = activeCtConfig?.nome || "";
  const headerNameSize = activeCtConfig?.nome ? (Number(activeCtConfig.nome_font_size) || 20) : 20;
  const headerEndereco = activeCtConfig?.endereco || "";
  const headerSubtitle = activeCtConfig?.subtitulo || "";
  const showHeaderEditButton = isAdmin && selectedCentroId && activeCtConfig;

  const getFontFamily = (family?: string) => {
    if (!family || family === "heading") return undefined;
    if (family === "sans") return "'Inter', sans-serif";
    return family;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-heading text-xl">Carregando...</div>
      </div>
    );
  }

  const MENU_ITEM_MAP: Record<string, { icon: any; label: string; section: ActiveSection }> = {
    dashboard: { icon: BarChart3, label: "Dashboard", section: "dashboard" },
    mestres: { icon: Users, label: "Mestres do CT", section: "mestres" },
    alunos: { icon: UserPlus, label: "Alunos do CT", section: "alunos" },
    horarios: { icon: Clock, label: "Horários", section: "horarios" },
    mensagens: { icon: MessageSquare, label: "Mensagens", section: "mensagens" },
    pagamentos: { icon: DollarSign, label: "Pagamentos", section: "pagamentos" },
    // chat removed
    faixa: { icon: Award, label: "Minha Faixa", section: "faixa" },
    chamada: { icon: UserCheck, label: "Chamada", section: "chamada" },
    metricas: { icon: TrendingUp, label: "Métricas de Graduação", section: "metricas" },
  };

  const mestreMenuItems = (layoutConfig.sidebar_mestre || [])
    .map(key => MENU_ITEM_MAP[key])
    .filter(Boolean);

  const alunoMenuItems = (layoutConfig.sidebar_aluno || [])
    .map(key => MENU_ITEM_MAP[key])
    .filter(Boolean);


  const menuItems = (isAdmin || user?.role === "mestre") ? [] : alunoMenuItems;
  const mobileTitle = isAdmin
    ? selectedCentroId
      ? centros.find((ct) => ct.id === selectedCentroId)?.nome || "Centro"
      : "Centros"
    : activeSection === "configuracoes"
      ? "Configurações"
      : menuItems.find((item) => item.section === activeSection)?.label || "Dashboard";

  const sidebarPaletteSelector = (
    <div className="mt-3 flex items-center gap-2">
      {paletteOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setPalette(option.id)}
          aria-label={`Ativar paleta ${option.name}`}
          className={cn(
            "theme-swatch h-8 w-8 rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            palette === option.id ? "scale-110 border-primary/60" : "border-border/70 opacity-85 hover:scale-105 hover:opacity-100",
          )}
          style={{ background: `linear-gradient(135deg, ${option.colors[0]}, ${option.colors[1]})` }}
        />
      ))}
    </div>
  );

  const renderContent = () => {
    if (activeSection === "configuracoes") {
      return (
        <div className="space-y-6">
          <ConfiguracoesSection
            userId={user?.id || ""}
            nome={user?.nome || ""}
            role={user?.role || "aluno"}
            onBack={() => { setActiveSection("dashboard"); setDashboardRefreshKey(k => k + 1); }}
            onCTConfigSaved={(cfg) => {
              setMestreCtConfig(cfg);
              setMestreCtNome(cfg.nome);
              setDashboardRefreshKey(k => k + 1);
            }}
          />
        </div>
      );
    }

    if (isAdmin) {
      if (selectedCentroId) {
        return <CentrosSection selectedCentroId={selectedCentroId} onBack={handleBackToOverview} onRefresh={() => { refreshCentros(); if (selectedCentroId) fetchAdminCtConfig(selectedCentroId); }} callerRole="admin" initialShowConfig={openCtConfig} initialDetailView={adminInitialCtView} initialMemberView={adminInitialMemberView} onConfigOpened={() => setOpenCtConfig(false)} />;
      }
      return <DashboardHome role="admin" userId={user?.id || ""} refreshKey={dashboardRefreshKey} onCTCreated={refreshCentros} onOpenFeaturedCt={openAdminCtView} />;
    }

    // Mestre gets the same CT detail view as admin, scoped to their own CT
    if (user?.role === "mestre" && mestreCtId) {
      return <CentrosSection key={`mestre-ct-${dashboardRefreshKey}`} selectedCentroId={mestreCtId} callerRole="mestre" />;
    }

    switch (activeSection) {
      case "dashboard":
        return <DashboardHome role={user?.role || "aluno"} userId={user?.id || ""} />;
      case "centros":
        return <CentrosSection callerRole={user?.role} />;
      case "mestres":
        return <MestresSection callerRole={user?.role} />;
      case "alunos":
        return <AlunosSection role={user?.role || "aluno"} userId={user?.id || ""} />;
      case "horarios":
        return <HorariosSection role={user?.role || "aluno"} userId={user?.id || ""} />;
      case "chamada":
        return mestreCtId ? <ChamadaSection ctId={mestreCtId} ctNome={mestreCtNome} onBack={() => setActiveSection("dashboard")} /> : <SectionPlaceholder title="Chamada" />;
      case "mensagens":
        return <MensagensSection role={user?.role || "aluno"} userId={user?.id || ""} />;
      case "pagamentos":
        return <AlunoPagamentosSection userId={user?.id || ""} />;
      case "faixa":
        return <SectionPlaceholder title="Minha Faixa" />;
      case "metricas":
        return <MetricasGraduacaoSection ctId={mestreCtId || ""} role={user?.role || "aluno"} userId={user?.id || ""} />;
      default:
        return <DashboardHome role={user?.role || "aluno"} userId={user?.id || ""} />;
    }
  };

  // ============ TOP BAR LAYOUT ============
  if (sidebarPosition === "top") {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {neveAtiva && <Snowflakes />}
          {/* Top Navigation Bar */}
          <header className="fixed top-0 left-0 right-0 bg-card border-b border-border z-50 px-4">
            {/* Row 1: CT Logo + CT Name + User info + Logout/Settings */}
            <div className="flex items-center gap-3 h-12">
              <button
                onClick={handleGoToRoleHome}
                className="flex items-center gap-3 rounded-xl px-1 py-1 transition-opacity hover:opacity-85"
                aria-label="Voltar para a tela inicial"
              >
                {layoutConfig.sidebar_image_url ? (
                  <img
                    src={layoutConfig.sidebar_image_url}
                    alt="Logo Sistema"
                    className="flex-shrink-0"
                    style={{ height: `${Math.min(Number(layoutConfig.sidebar_image_size) || 32, 40)}px`, width: "auto", objectFit: "contain" }}
                  />
                ) : (
                  <img src={logo} alt="Logo" className="h-7 w-7 flex-shrink-0" />
                )}
                {!iconOnly && (
                  <span
                    className="font-heading uppercase tracking-wider text-foreground"
                    style={{ fontSize: `${Number(layoutConfig.sidebar_text_size) || 14}px` }}
                  >
                    {layoutConfig.sidebar_text || "BJJ Manager"}
                  </span>
                )}
              </button>
              <div className="ml-auto flex items-center gap-2">
                {!iconOnly && (
                  <button
                    onClick={() => setUserProfileOpen(true)}
                    className="text-right cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <p className="text-foreground text-xs font-medium leading-tight">{user?.nome}</p>
                    <p className="text-muted-foreground text-[10px] capitalize">{user?.role}</p>
                  </button>
                )}
                <TopBarItem icon={Settings} label="Configurações" iconOnly={true} active={activeSection === "configuracoes"} onClick={() => setActiveSection("configuracoes")} />
                <TopBarItem icon={LogOut} label="Sair" iconOnly={true} active={false} onClick={handleLogout} />
              </div>
            </div>
            {/* Row 2: Nav items */}
            <div className="flex items-center gap-1 pb-1 border-t border-border/50 pt-1 justify-end">
              {isAdmin ? (
                <>
                  {selectedCentroId ? (
                    <TopBarItem
                      icon={ArrowLeft}
                      label="Visão Geral"
                      iconOnly={iconOnly}
                      active={false}
                      onClick={handleBackToOverview}
                    />
                  ) : (
                    ctMemberCounts.map(ct => (
                      <TopBarItem
                        key={ct.id}
                        icon={Building2}
                        label={ct.nome}
                        iconOnly={iconOnly}
                        active={false}
                        onClick={() => handleSelectCentro(ct.id)}
                      />
                    ))
                  )}
                </>
              ) : (
                menuItems.map(item => (
                  <TopBarItem
                    key={item.section}
                    icon={item.icon}
                    label={item.label}
                    iconOnly={iconOnly}
                    active={activeSection === item.section}
                    onClick={() => setActiveSection(item.section)}
                  />
                ))
              )}
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-center p-2 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Centros de Treinamento</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ctMemberCounts.length === 0 ? (
                      <DropdownMenuItem disabled>Nenhum CT cadastrado</DropdownMenuItem>
                    ) : (
                      ctMemberCounts.map(ct => (
                        <DropdownMenuItem key={ct.id} onClick={() => handleSelectCentro(ct.id)} className="flex justify-between">
                          <span className="truncate">{ct.nome}</span>
                          <span className="text-muted-foreground text-xs ml-2">{ct.total} membros</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>

          {/* Main Content */}
          <main className="p-8" style={{ marginTop: 90 }}>
            {renderContent()}
          </main>

          {/* User Profile Dialog */}
          <Dialog open={userProfileOpen} onOpenChange={setUserProfileOpen}>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-heading text-foreground">Informações do Usuário</DialogTitle>
              </DialogHeader>
              <div className="mb-4 flex items-center gap-4">
                <UserAvatar name={user?.nome} className="h-16 w-16" fallbackClassName="text-sm" />
                <div>
                  <p className="text-base font-semibold text-foreground">{user?.nome} {user?.sobrenome}</p>
                  <p className="text-sm capitalize text-muted-foreground">{user?.role}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm w-24">Nome:</span>
                  <span className="text-foreground text-sm">{user?.nome} {user?.sobrenome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm w-24">Usuário:</span>
                  <span className="text-foreground text-sm">{user?.username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm w-24">Email:</span>
                  <span className="text-foreground text-sm">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm w-24">Telefone:</span>
                  <span className="text-foreground text-sm">{user?.telefone || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm w-24">Papel:</span>
                  <span className="text-foreground text-sm capitalize">{user?.role}</span>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    );
  }

  // ============ LEFT SIDEBAR LAYOUT (default) ============
  if (isMobile) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {neveAtiva && <Snowflakes />}

          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  {isAdmin ? "Painel Administrativo" : user?.role === "mestre" ? "Painel do CT" : "Área do Aluno"}
                </p>
                <h1 className="truncate font-heading text-lg uppercase tracking-[0.16em] text-foreground">
                  {mobileTitle}
                </h1>
              </div>

              <button
                onClick={() => setUserProfileOpen(true)}
                className="min-w-0 rounded-2xl border border-border bg-card px-3 py-2 text-right shadow-sm transition-colors hover:bg-accent"
              >
                <p className="max-w-[84px] truncate text-sm font-medium text-foreground">{user?.nome}</p>
                <p className="text-[11px] capitalize text-muted-foreground">{user?.role}</p>
              </button>
            </div>
          </header>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="w-[88vw] max-w-sm border-r border-border bg-card px-0">
              <SheetHeader className="border-b border-border px-5 pb-4">
                <SheetTitle className="font-heading uppercase tracking-[0.16em]">
                  Navegação
                </SheetTitle>
              </SheetHeader>

              <div className="flex h-full flex-col">
                <div className="space-y-6 overflow-y-auto px-4 py-5">
                  <div className="rounded-3xl border border-border bg-background/60 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                      {layoutConfig.sidebar_text || "BJJ Manager"}
                    </p>
                    <p className="mt-2 text-base font-medium text-foreground">
                      {user?.nome}
                    </p>
                    <p className="text-sm capitalize text-muted-foreground">{user?.role}</p>
                  </div>

                  <div className="space-y-2">
                    {isAdmin ? (
                      <>
                        {selectedCentroId && (
                          <MobileNavButton
                            icon={ArrowLeft}
                            label="Visão Geral"
                            onClick={() => {
                              handleBackToOverview();
                              setMobileMenuOpen(false);
                            }}
                          />
                        )}
                        {ctMemberCounts.map((ct) => (
                          <MobileNavButton
                            key={ct.id}
                            icon={Building2}
                            label={ct.nome}
                            description={`${ct.total} membros`}
                            active={selectedCentroId === ct.id}
                            onClick={() => {
                              handleSelectCentro(ct.id);
                              setMobileMenuOpen(false);
                            }}
                          />
                        ))}
                      </>
                    ) : (
                      menuItems.map((item) => (
                        <MobileNavButton
                          key={item.section}
                          icon={item.icon}
                          label={item.label}
                          active={activeSection === item.section}
                          onClick={() => {
                            setActiveSection(item.section);
                            setMobileMenuOpen(false);
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-border px-4 py-4">
                  <div className="space-y-2">
                    <MobileNavButton
                      icon={Settings}
                      label="Configurações"
                      active={activeSection === "configuracoes"}
                      onClick={() => {
                        setActiveSection("configuracoes");
                        setMobileMenuOpen(false);
                      }}
                    />
                    <MobileNavButton
                      icon={LogOut}
                      label="Sair"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                    />
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <main className="px-3 py-4 sm:px-4">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
              {(headerName || headerEndereco || headerSubtitle) && (
                <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
                  <div
                    className="relative min-h-[140px] px-5 py-6"
                    style={bannerUrl ? {
                      backgroundImage: `url(${bannerUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: `center ${bannerPosition}%`,
                    } : undefined}
                  >
                    {bannerUrl && <div className="absolute inset-0 bg-background/75" />}
                    <div className="relative z-10 flex flex-col items-center text-center">
                      {headerLogoUrl && (
                        <img
                          src={headerLogoUrl}
                          alt="Logo CT"
                          className="mb-4"
                          style={{ height: `${Math.min(headerLogoSize, 72)}px`, width: "auto", objectFit: "contain" }}
                        />
                      )}
                      {headerName && (
                        <span
                          className={`${activeCtConfig?.nome_font_family === "heading" || !activeCtConfig?.nome_font_family ? "font-heading" : ""} text-balance uppercase tracking-[0.18em]`}
                          style={{
                            fontSize: `${Math.min(headerNameSize, 24)}px`,
                            color: activeCtConfig?.nome_color || undefined,
                            fontFamily: getFontFamily(activeCtConfig?.nome_font_family),
                          }}
                        >
                          {headerName}
                        </span>
                      )}
                      {headerEndereco && (
                        <span
                          className="mt-2 text-sm text-muted-foreground"
                          style={{
                            color: activeCtConfig?.endereco_color || "#a1a1aa",
                            fontFamily: getFontFamily(activeCtConfig?.endereco_font_family),
                          }}
                        >
                          {headerEndereco}
                        </span>
                      )}
                      {headerSubtitle && (
                        <span
                          className="mt-1 text-sm text-muted-foreground"
                          style={{
                            color: activeCtConfig?.subtitulo_color || "#a1a1aa",
                            fontFamily: getFontFamily(activeCtConfig?.subtitulo_font_family),
                          }}
                        >
                          {headerSubtitle}
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <section className="mx-auto w-full max-w-5xl">
                {renderContent()}
              </section>
            </div>
          </main>

          <Dialog open={userProfileOpen} onOpenChange={setUserProfileOpen}>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-heading text-foreground">Informações do Usuário</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm w-24">Nome:</span>
                  <span className="text-foreground text-sm">{user?.nome} {user?.sobrenome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm w-24">Usuário:</span>
                  <span className="text-foreground text-sm">{user?.username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm w-24">Email:</span>
                  <span className="text-foreground text-sm">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm w-24">Telefone:</span>
                  <span className="text-foreground text-sm">{user?.telefone || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm w-24">Papel:</span>
                  <span className="text-foreground text-sm capitalize">{user?.role}</span>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    );
  }



  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {neveAtiva && <Snowflakes />}

        {/* Header with banner, logo, name */}
        <header
          className="fixed top-0 right-0 z-40 overflow-hidden border-b border-border/60 bg-card/85 px-6 backdrop-blur-xl"
          style={{
            left: sidebarWidth,
            height: headerHeight,
            ...(bannerUrl ? {
              backgroundImage: `url(${bannerUrl})`,
              backgroundSize: "cover",
              backgroundPosition: `center ${bannerPosition}%`,
            } : {}),
          }}
        >
          {bannerUrl && <div className="absolute inset-0 bg-background/72" />}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--panel-highlight)/0.12),transparent_30%),linear-gradient(120deg,hsl(var(--panel-highlight)/0.05),transparent_55%)]" />
          <div className="relative z-10 flex h-full items-center gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {headerLogoUrl && (
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/60 bg-card/60 shadow-[0_12px_30px_hsl(var(--shadow-color)/0.25)] backdrop-blur-sm">
                  <img
                    src={headerLogoUrl}
                    alt="Logo CT"
                    className="flex-shrink-0"
                    style={{ height: `${Math.min(headerLogoSize, 52)}px`, width: "auto", objectFit: "contain" }}
                  />
                </div>
              )}
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.36em] text-muted-foreground">
                  {isAdmin ? "Central de comando" : user?.role === "mestre" ? "Painel do centro" : "Area do aluno"}
                </p>
                {headerName ? (
                  <div className="flex min-w-0 flex-col gap-1">
                    <span
                      className={`${activeCtConfig?.nome_font_family === "heading" || !activeCtConfig?.nome_font_family ? "font-heading" : ""} truncate uppercase leading-tight tracking-[0.18em]`}
                      style={{
                        fontSize: `${headerNameSize}px`,
                        color: activeCtConfig?.nome_color || "hsl(var(--foreground))",
                        fontFamily: getFontFamily(activeCtConfig?.nome_font_family),
                      }}
                    >
                      {headerName}
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      {headerEndereco && (
                        <span
                          className="truncate text-muted-foreground"
                          style={{
                            fontSize: `${Number(activeCtConfig?.endereco_font_size) || 14}px`,
                            color: activeCtConfig?.endereco_color || "#a1a1aa",
                            fontFamily: getFontFamily(activeCtConfig?.endereco_font_family),
                          }}
                        >
                          {headerEndereco}
                        </span>
                      )}
                      {headerSubtitle && (
                        <span
                          className="truncate border-l border-border/60 pl-3 text-muted-foreground"
                          style={{
                            fontSize: `${Number(activeCtConfig?.subtitulo_font_size) || 14}px`,
                            color: activeCtConfig?.subtitulo_color || "#a1a1aa",
                            fontFamily: getFontFamily(activeCtConfig?.subtitulo_font_family),
                          }}
                        >
                          {headerSubtitle}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className="font-heading text-xl uppercase tracking-[0.18em] text-foreground">
                      {layoutConfig.sidebar_text || "BJJ Manager"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Navegacao principal do sistema
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden min-w-[280px] items-center gap-3 rounded-[22px] border border-border/70 bg-card/70 px-4 py-3 shadow-[0_12px_30px_hsl(var(--shadow-color)/0.18)] backdrop-blur-md xl:flex">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={dashboardSearch}
                  onChange={(event) => setDashboardSearch(event.target.value)}
                  placeholder="Buscar alunos, turmas..."
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <span className="rounded-md border border-border/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Ctrl + K
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-[24px] border border-border/70 bg-card/70 px-3 py-2 shadow-[0_12px_30px_hsl(var(--shadow-color)/0.28)] backdrop-blur-md">
                {[Bell, CircleHelp, Settings].map((Icon, index) => (
                  <button
                    key={`${Icon.displayName || "icon"}-${index}`}
                    onClick={() => {
                      if (Icon === Settings) setActiveSection("configuracoes");
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/45 text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/12 hover:text-primary"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-card/70 px-3 py-2 shadow-[0_12px_30px_hsl(var(--shadow-color)/0.28)] backdrop-blur-md">
              {showHeaderEditButton && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        setOpenCtConfig(true);
                        setActiveSection("centro_detail");
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/45 text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/12 hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Editar CT</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <button
                onClick={() => setUserProfileOpen(true)}
                className="flex min-w-[180px] items-center gap-3 rounded-[20px] border border-border/70 bg-background/45 px-3 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent"
              >
                <UserAvatar name={user?.nome} className="h-11 w-11" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{user?.nome}</p>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{user?.role}</p>
                </div>
              </button>
            </div>
            </div>
          </div>
        </header>

        {/* Sidebar with SYSTEM branding (admin-editable only) */}
        <aside
          className="fixed left-0 top-0 z-50 flex h-full flex-col border-r border-border/60 bg-sidebar shadow-[18px_0_60px_hsl(var(--shadow-color)/0.22)]"
          style={{ width: sidebarWidth }}
        >
          {/* System branding at the top of sidebar */}
          <div className="relative overflow-hidden border-b border-border/60 px-4" style={{ height: headerHeight }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--panel-highlight)/0.1),transparent_32%),linear-gradient(180deg,hsl(var(--panel-highlight)/0.04),transparent_75%)]" />
            <button
              onClick={handleGoToRoleHome}
              className="relative flex h-full w-full items-center gap-3 rounded-2xl px-1 text-left transition-opacity hover:opacity-90"
              aria-label="Voltar para a tela inicial"
            >
              {layoutConfig.sidebar_image_url ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-border/60 bg-card/60 backdrop-blur-sm">
                  <img
                    src={layoutConfig.sidebar_image_url}
                    alt="Logo Sistema"
                    className="flex-shrink-0"
                    style={{ height: `${Math.min(Number(layoutConfig.sidebar_image_size) || 40, headerHeight - 28)}px`, width: "auto", objectFit: "contain" }}
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-border/60 bg-card/60 backdrop-blur-sm">
                  <img src={logo} alt="Logo" className="h-9 w-9 flex-shrink-0" />
                </div>
              )}
              {!iconOnly && (
                <div className="flex min-w-0 flex-col">
                  <span className="mb-1 text-[10px] uppercase tracking-[0.32em] text-muted-foreground">BJJ command</span>
                  <span
                    className="truncate font-heading leading-tight text-sidebar-foreground"
                    style={{ fontSize: `${Number(layoutConfig.sidebar_text_size) || 14}px` }}
                  >
                    {layoutConfig.sidebar_text || "BJJ Manager"}
                  </span>
                  <span className="text-xs text-muted-foreground">Navegacao principal</span>
                </div>
              )}
            </button>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto pt-4" style={{ paddingLeft: iconOnly ? "0.5rem" : "1rem", paddingRight: iconOnly ? "0.5rem" : "1rem" }}>
            {isAdmin ? (
              <>
                {selectedCentroId ? (
                  <>
                    <SidebarItem
                      icon={ArrowLeft}
                      label="Visão Geral"
                      iconOnly={iconOnly}
                      active={false}
                      onClick={handleBackToOverview}
                    />
                    {!iconOnly && (
                      <p className="truncate px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        {centros.find(c => c.id === selectedCentroId)?.nome}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {ctMemberCounts.map(ct => (
                      <SidebarItem
                        key={ct.id}
                        icon={Building2}
                        label={ct.nome}
                        iconOnly={iconOnly}
                        active={false}
                        onClick={() => handleSelectCentro(ct.id)}
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              menuItems.map((item) => (
                <SidebarItem
                  key={item.section}
                  icon={item.icon}
                  label={item.label}
                  iconOnly={iconOnly}
                  active={activeSection === item.section}
                  onClick={() => setActiveSection(item.section)}
                />
              ))
            )}
          </nav>

          <div className="border-t border-border/60 pt-4" style={{ paddingLeft: iconOnly ? "0.5rem" : "1rem", paddingRight: iconOnly ? "0.5rem" : "1rem", paddingBottom: "1rem" }}>
            {!iconOnly && (
              <div className="mb-4 rounded-[24px] border border-border/60 bg-card/45 p-4">
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Tema</p>
                  <div className="mt-3">
                    <ThemeToggle />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Paleta de cores</p>
                  {sidebarPaletteSelector}
                </div>
              </div>
            )}

            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/55 px-3 py-3 text-sm text-muted-foreground transition-all duration-200 hover:border-primary/15 hover:bg-accent hover:text-foreground">
                    <Building2 className="h-4 w-4 flex-shrink-0" />
                    {!iconOnly && <span className="truncate">Centros</span>}
                    <ChevronDown className="h-3 w-3 ml-auto" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-56">
                  <DropdownMenuLabel>Centros de Treinamento</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ctMemberCounts.length === 0 ? (
                    <DropdownMenuItem disabled>Nenhum CT</DropdownMenuItem>
                  ) : (
                    ctMemberCounts.map(ct => (
                      <DropdownMenuItem key={ct.id} onClick={() => handleSelectCentro(ct.id)} className="flex justify-between">
                        <span className="truncate">{ct.nome}</span>
                        <span className="text-muted-foreground text-xs ml-2">{ct.total} membros</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <SidebarItem icon={Settings} label="Configurações" iconOnly={iconOnly} active={activeSection === "configuracoes"} onClick={() => setActiveSection("configuracoes")} />
            <SidebarItem icon={LogOut} label="Sair" iconOnly={iconOnly} onClick={handleLogout} />

            {!iconOnly && (
              <button
                onClick={() => setUserProfileOpen(true)}
                className="mt-4 flex w-full items-center gap-3 rounded-[24px] border border-border/60 bg-card/55 p-3 text-left transition-all duration-200 hover:border-primary/20 hover:bg-accent"
              >
                <UserAvatar name={user?.nome} className="h-12 w-12" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{user?.nome}</p>
                  <p className="text-xs capitalize text-muted-foreground">{user?.role}</p>
                </div>
                <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </aside>

        <main className="p-8" style={{ marginLeft: sidebarWidth, marginTop: headerHeight }}>
          {renderContent()}
        </main>

        {/* User Profile Dialog */}
        <Dialog open={userProfileOpen} onOpenChange={setUserProfileOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground">Informações do Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm w-24">Nome:</span>
                <span className="text-foreground text-sm">{user?.nome} {user?.sobrenome}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm w-24">Usuário:</span>
                <span className="text-foreground text-sm">{user?.username}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm w-24">Email:</span>
                <span className="text-foreground text-sm">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm w-24">Telefone:</span>
                <span className="text-foreground text-sm">{user?.telefone || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm w-24">Papel:</span>
                <span className="text-foreground text-sm capitalize">{user?.role}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

const SectionPlaceholder = ({ title }: { title: string }) => (
  <div>
    <div className="mb-8">
      <h1 className="font-heading text-3xl uppercase text-foreground">{title}</h1>
    </div>
    <div className="glass-card rounded-lg p-8 text-center">
      <p className="text-muted-foreground">Seção "{title}" em construção.</p>
    </div>
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick, iconOnly }: { icon: any; label: string; active?: boolean; onClick?: () => void; iconOnly?: boolean }) => {
  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "group relative flex w-full items-center justify-center overflow-hidden rounded-2xl border p-3 transition-all duration-200 ease-out",
              active
                ? "border-primary/35 bg-primary/14 text-primary shadow-[0_12px_30px_hsl(var(--shadow-color)/0.24)]"
                : "border-border/60 bg-card/25 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/15 hover:bg-accent hover:text-foreground",
            )}
          >
            <span className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--panel-highlight)/0.24)] to-transparent opacity-60" />
            <Icon className={cn("relative z-10 h-5 w-5 transition-transform duration-200", active ? "scale-110" : "group-hover:scale-105")} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-card border border-border">
          <p className="text-foreground">{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-sm transition-all duration-200 ease-out",
        active
          ? "border-primary/35 bg-primary/14 text-primary shadow-[0_12px_30px_hsl(var(--shadow-color)/0.24)]"
          : "border-border/60 bg-card/25 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/15 hover:bg-accent hover:text-foreground",
      )}
    >
      <span className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--panel-highlight)/0.2)] to-transparent opacity-60" />
      <span className={cn("relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border", active ? "border-primary/30 bg-primary/12" : "border-border/60 bg-background/45")}>
        <Icon className={cn("h-4 w-4 transition-transform duration-200", active ? "scale-110" : "group-hover:scale-105")} />
      </span>
      <span className="relative z-10 truncate font-medium">{label}</span>
    </button>
  );
};
const TopBarItem = ({ icon: Icon, label, active, onClick, iconOnly }: { icon: any; label: string; active?: boolean; onClick?: () => void; iconOnly?: boolean }) => {
  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "group relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border p-2.5 transition-all duration-200 ease-out",
              active
                ? "border-primary/35 bg-primary/14 text-primary shadow-[0_10px_24px_hsl(var(--shadow-color)/0.18)]"
                : "border-border/60 bg-card/40 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/15 hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className={cn("relative z-10 h-4 w-4 transition-transform duration-200", active ? "scale-110" : "group-hover:scale-105")} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-card border border-border">
          <p className="text-foreground text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-shrink-0 items-center gap-2 overflow-hidden rounded-2xl border px-3 py-2 text-xs whitespace-nowrap transition-all duration-200 ease-out",
        active
          ? "border-primary/35 bg-primary/14 text-primary shadow-[0_10px_24px_hsl(var(--shadow-color)/0.18)] font-medium"
          : "border-border/60 bg-card/40 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/15 hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className={cn("relative z-10 h-3.5 w-3.5 transition-transform duration-200", active ? "scale-110" : "group-hover:scale-105")} />
      <span className="relative z-10">{label}</span>
    </button>
  );
};
const MobileNavButton = ({
  icon: Icon,
  label,
  description,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  description?: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className={`
      w-full rounded-xl border px-4 py-3 text-left
      transition-all duration-200 ease-out relative overflow-hidden group
      ${
        active
          ? "border-primary/40 bg-gradient-to-r from-primary/20 via-primary/15 to-primary/10 text-primary shadow-sm shadow-primary/20"
          : "border-border/50 bg-background/60 text-foreground hover:bg-accent/50 hover:border-border"
      }
    `}
  >
    {/* Click feedback effect */}
    <span className="absolute inset-0 rounded-xl bg-primary/5 transform scale-0 group-active:scale-100 transition-transform duration-200 ease-out origin-center" />
    
    <div className="flex items-center gap-3 relative z-10">
      <div className={`
        flex h-10 w-10 items-center justify-center rounded-lg
        transition-all duration-200
        ${active 
          ? "bg-gradient-to-br from-primary/20 to-primary/10 text-primary border border-primary/30" 
          : "bg-card/50 text-muted-foreground border border-border/30 group-hover:border-border group-hover:text-foreground"
        }
      `}>
        <Icon className={`h-4 w-4 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-105"}`} />
      </div>
      <div className="min-w-0">
        <p className={`truncate text-sm font-medium transition-colors duration-200 ${active ? "text-primary" : "text-foreground"}`}>{label}</p>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  </button>
);

export default Dashboard;






