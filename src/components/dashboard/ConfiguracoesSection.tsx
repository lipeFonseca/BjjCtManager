import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Lock, ArrowLeft, Layout, LogIn, Building2, PanelLeft, Webhook, CreditCard, MonitorCog, Palette } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LayoutConfigSection from "./LayoutConfigSection";
import LoginConfigSection from "./LoginConfigSection";
import MestreCTConfigSection from "./MestreCTConfigSection";
import WebhookConfigSection from "./WebhookConfigSection";
import FinanceiroSection from "./FinanceiroSection";
import AdminFinanceiro from "@/pages/AdminFinanceiro";
import type { CTConfig } from "./MestreCTConfigSection";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PaletteSelector } from "@/components/theme/PaletteSelector";

interface ConfiguracoesSectionProps {
  userId: string;
  nome: string;
  role: string;
  onBack: () => void;
  onCTConfigSaved?: (config: CTConfig) => void;
}

const ConfiguracoesSection = ({ userId, nome, role, onBack, onCTConfigSaved }: ConfiguracoesSectionProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [mestreCtId, setMestreCtId] = useState<string | null>(null);
  const [mestreIsCtOwner, setMestreIsCtOwner] = useState(false);
  const [loadingMestreCt, setLoadingMestreCt] = useState(false);
  const isAdmin = role === "admin";
  const isMestre = role === "mestre";

  useEffect(() => {
    if (!isMestre || !userId) return;

    let active = true;

    const fetchMestreCt = async () => {
      setLoadingMestreCt(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("ct_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        toast.error("Nao foi possivel carregar o CT do mestre.");
        setMestreCtId(null);
        setMestreIsCtOwner(false);
      } else {
        const ctId = data?.ct_id || null;
        setMestreCtId(ctId);

        if (ctId) {
          const { data: ctData, error: ctError } = await supabase
            .from("centros_treinamento")
            .select("mestre_lider_id")
            .eq("id", ctId)
            .maybeSingle();

          if (!active) return;

          if (ctError) {
            toast.error("Nao foi possivel validar o responsavel do CT.");
            setMestreIsCtOwner(false);
          } else {
            setMestreIsCtOwner(ctData?.mestre_lider_id === userId);
          }
        } else {
          setMestreIsCtOwner(false);
        }
      }

      setLoadingMestreCt(false);
    };

    void fetchMestreCt();

    return () => {
      active = false;
    };
  }, [isMestre, userId]);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter no mínimo 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.functions.invoke("update-user", {
      body: { self: true, password: newPassword },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro ao alterar senha");
    } else {
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  };

  const appearancePanel = (
    <div className="premium-card mb-6 p-5 sm:p-6">
      <div className="mb-6 flex items-center gap-3">
        <MonitorCog className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-heading text-lg uppercase tracking-[0.16em] text-foreground">Aparência do painel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha o tema e a paleta principal desta navegação. A preferência fica salva neste navegador.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-border/70 bg-background/55 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Tema de exibição</span>
          </div>
          <ThemeToggle />
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            O sistema carrega automaticamente o último tema selecionado ao abrir novamente o painel.
          </p>
        </div>

        <div className="rounded-[24px] border border-border/70 bg-background/55 p-4">
          <div className="mb-4">
            <span className="text-sm font-semibold text-foreground">Paleta principal</span>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              A paleta ativa afeta botões, destaques, ícones ativos, gráficos e elementos principais do dashboard.
            </p>
          </div>
          <PaletteSelector />
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Button variant="ghost" size="sm" className="mb-4 h-11 w-full justify-center rounded-xl text-muted-foreground sm:h-9 sm:w-auto sm:justify-start sm:rounded-md" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <div className="mb-8 flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-3xl uppercase text-foreground">Configurações</h1>
      </div>

      {appearancePanel}

      {isAdmin ? (
        <Tabs defaultValue="senha" className="w-full">
          <div className="glass-card mb-6 rounded-[24px] p-4 sm:rounded-lg sm:p-5">
            <TabsList className="mx-auto grid h-auto w-full max-w-5xl grid-cols-2 gap-2 bg-transparent p-0 lg:grid-cols-6">
            <TabsTrigger value="senha" className="w-full justify-center rounded-xl sm:rounded-md">
              <Lock className="h-4 w-4 mr-2" /> Senha
            </TabsTrigger>
            <TabsTrigger value="sidebar" className="w-full justify-center rounded-xl sm:rounded-md">
              <PanelLeft className="h-4 w-4 mr-2" /> Sidebar
            </TabsTrigger>
            <TabsTrigger value="layout" className="w-full justify-center rounded-xl sm:rounded-md">
              <Layout className="h-4 w-4 mr-2" /> Layout
            </TabsTrigger>
            <TabsTrigger value="login" className="w-full justify-center rounded-xl sm:rounded-md">
              <LogIn className="h-4 w-4 mr-2" /> Tela de Login
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="w-full justify-center rounded-xl sm:rounded-md">
              <Webhook className="h-4 w-4 mr-2" /> Webhooks
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="w-full justify-center rounded-xl sm:rounded-md">
              <CreditCard className="h-4 w-4 mr-2" /> Financeiro SaaS
            </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="senha">
            <PasswordForm
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              saving={saving}
              onNewPasswordChange={setNewPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onSubmit={handleChangePassword}
            />
          </TabsContent>

          <TabsContent value="sidebar">
            <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <PanelLeft className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-lg uppercase text-foreground">Estilização da Sidebar</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Personalize o nome, logotipo e aparência da barra de navegação. Estas configurações são visíveis para todos os usuários do sistema.
              </p>
              <LayoutConfigSection sidebarOnly />
            </div>
          </TabsContent>

          <TabsContent value="layout">
            <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <Layout className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-lg uppercase text-foreground">Definição de Layout</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Organize os menus e widgets do sistema. As alterações serão aplicadas globalmente para todos os usuários.
              </p>
              <LayoutConfigSection menuOnly />
            </div>
          </TabsContent>

          <TabsContent value="login">
            <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <LogIn className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-lg uppercase text-foreground">Estilização da Tela de Login</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Personalize o banner, logo e cores da tela de login. As alterações são aplicadas globalmente.
              </p>
              <LoginConfigSection />
            </div>
          </TabsContent>

          <TabsContent value="webhooks">
            <div className="p-0 sm:glass-card sm:rounded-lg sm:p-6">
              <WebhookConfigSection role={role as 'admin'} userId={userId} />
            </div>
          </TabsContent>

          <TabsContent value="financeiro">
            <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-lg uppercase text-foreground">Financeiro SaaS</h2>
              </div>
              <p className="mb-6 text-sm text-muted-foreground">
                Gerencie planos, integracao com Asaas e a aparencia da pagina publica de assinatura. Este acesso fica restrito ao admin.
              </p>
              <AdminFinanceiro embedded />
            </div>
          </TabsContent>
        </Tabs>
      ) : isMestre ? (
        <Tabs defaultValue="senha" className="w-full">
          <div className="glass-card mb-6 rounded-[24px] p-4 sm:rounded-lg sm:p-5">
            <TabsList className={`mx-auto grid h-auto w-full max-w-5xl grid-cols-2 gap-2 bg-transparent p-0 ${mestreIsCtOwner ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}>
            <TabsTrigger value="senha" className="w-full justify-center rounded-xl sm:rounded-md">
              <Lock className="h-4 w-4 mr-2" /> Senha
            </TabsTrigger>
            <TabsTrigger value="ct" className="w-full justify-center rounded-xl sm:rounded-md">
              <Building2 className="h-4 w-4 mr-2" /> Meu CT
            </TabsTrigger>
            <TabsTrigger value="layout" className="w-full justify-center rounded-xl sm:rounded-md">
              <Layout className="h-4 w-4 mr-2" /> Layout
            </TabsTrigger>
            {mestreIsCtOwner && (
              <TabsTrigger value="webhooks" className="w-full justify-center rounded-xl sm:rounded-md">
                <Webhook className="h-4 w-4 mr-2" /> Webhooks
              </TabsTrigger>
            )}
            {mestreIsCtOwner && (
              <TabsTrigger value="financeiro" className="w-full justify-center rounded-xl sm:rounded-md">
                <CreditCard className="h-4 w-4 mr-2" /> Financeiro do CT
              </TabsTrigger>
            )}
            </TabsList>
          </div>

          <TabsContent value="senha">
            <PasswordForm
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              saving={saving}
              onNewPasswordChange={setNewPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onSubmit={handleChangePassword}
            />
          </TabsContent>

          <TabsContent value="ct">
            <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-lg uppercase text-foreground">Estilização do Centro de Treinamento</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Personalize o nome, subtítulo, logo e banner do seu CT. As alterações serão visíveis para todos os membros.
              </p>
              <MestreCTConfigSection onSaved={onCTConfigSaved} />
            </div>
          </TabsContent>

          {mestreIsCtOwner && (
            <TabsContent value="webhooks">
              <div className="p-0 sm:glass-card sm:rounded-lg sm:p-6">
                <WebhookConfigSection role={role as 'mestre'} userId={userId} />
              </div>
            </TabsContent>
          )}

          <TabsContent value="layout">
            <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <Layout className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-lg uppercase text-foreground">Definição de Layout</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Organize os menus e widgets do sistema para os membros do seu CT.
              </p>
              <LayoutConfigSection menuOnly />
            </div>
          </TabsContent>

          {mestreIsCtOwner && (
            <TabsContent value="financeiro">
              <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
                <div className="mb-6 flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h2 className="font-heading text-lg uppercase text-foreground">Financeiro do CT</h2>
                </div>
                <p className="mb-6 text-sm text-muted-foreground">
                  Gerencie planos, cobrancas, PIX manual e recebimentos do seu CT. Integracoes externas como Asaas ficam fora do financeiro do mestre.
                </p>
                {loadingMestreCt ? (
                  <div className="rounded-2xl border border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                    Carregando o CT vinculado ao mestre...
                  </div>
                ) : mestreCtId ? (
                  <FinanceiroSection ctId={mestreCtId} role="mestre" userId={userId} />
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                    Nenhum CT foi vinculado a este mestre. Vincule o mestre a um CT para liberar o financeiro.
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {!mestreIsCtOwner && !loadingMestreCt && (
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
              O admin do sistema ainda nao definiu este mestre como responsavel pelo CT. Configuracoes restritas e financeiro do CT ficam liberados apenas para o mestre responsavel.
            </div>
          )}
        </Tabs>
      ) : (
        <PasswordForm
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          saving={saving}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={handleChangePassword}
        />
      )}
    </div>
  );
};

const PasswordForm = ({
  newPassword, confirmPassword, saving,
  onNewPasswordChange, onConfirmPasswordChange, onSubmit,
}: {
  newPassword: string; confirmPassword: string; saving: boolean;
  onNewPasswordChange: (v: string) => void; onConfirmPasswordChange: (v: string) => void;
  onSubmit: () => void;
}) => (
  <div className="glass-card mx-auto w-full max-w-sm rounded-[24px] p-5 sm:max-w-md sm:rounded-lg sm:p-6">
    <div className="flex items-center gap-3 mb-6">
      <Lock className="h-5 w-5 text-primary" />
      <h2 className="font-heading text-lg uppercase text-foreground">Alterar Senha</h2>
    </div>
    <p className="text-muted-foreground text-sm mb-6">
      Altere sua senha de acesso ao sistema. A nova senha deve ter no mínimo 8 caracteres.
    </p>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-foreground">Nova Senha</Label>
        <Input type="password" value={newPassword} onChange={(e) => onNewPasswordChange(e.target.value)} placeholder="Mínimo 8 caracteres" className="bg-secondary border-border text-foreground" />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Confirmar Nova Senha</Label>
        <Input type="password" value={confirmPassword} onChange={(e) => onConfirmPasswordChange(e.target.value)} placeholder="Repita a nova senha" className="bg-secondary border-border text-foreground" />
      </div>
      <Button onClick={onSubmit} disabled={saving} className="w-full">
        {saving ? "Salvando..." : "Alterar Senha"}
      </Button>
    </div>
  </div>
);

export default ConfiguracoesSection;

