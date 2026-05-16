import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Check, CreditCard, Loader2, Plus, RefreshCw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { testAsaasConnection, type AsaasEnvironment } from "@/services/asaas";
import { getSecureConfig, saveSecureConfig, type SecureConfigSecrets } from "@/services/secureConfig";
import PlansPageConfigSection from "@/components/dashboard/PlansPageConfigSection";
import CheckoutPageConfigSection from "@/components/dashboard/CheckoutPageConfigSection";

type BillingPlan = {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  user_limit: number;
  launch_limit: number;
  features: string[];
  highlight_label: string | null;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
};

type BillingSubscriptionAdmin = {
  id: string;
  status: string;
  billing_cycle: string;
  payment_method: string | null;
  amount: number | null;
  customer_email: string | null;
  master_name: string | null;
  ct_name: string | null;
  asaas_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
  metadata: Record<string, any> | null;
};

const emptyPlanForm = {
  id: "",
  name: "",
  description: "",
  priceMonthly: "",
  priceYearly: "",
  userLimit: "1",
  launchLimit: "0",
  featuresText: "",
  highlightLabel: "",
  isActive: true,
  isPopular: false,
  sortOrder: "0",
};

const parseCurrencyInput = (value: string) => {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrencyInput = (value: number) => value.toFixed(2).replace(".", ",");
const getYearlyTotal = (yearlyMonthlyPrice: number) => yearlyMonthlyPrice * 12;
const formatDateTime = (value: string | null) => {
  if (!value) return "Nao informado";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const getSubscriptionStatusLabel = (status: string) => {
  switch (status) {
    case "active":
      return "Ativa";
    case "pending":
      return "Pendente";
    case "past_due":
      return "Atrasada";
    case "canceled":
      return "Cancelada";
    default:
      return status;
  }
};

const getSubscriptionStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "active":
      return "default";
    case "pending":
    case "past_due":
      return "secondary";
    case "canceled":
      return "destructive";
    default:
      return "outline";
  }
};

interface AdminFinanceiroProps {
  embedded?: boolean;
}

const AdminFinanceiro = ({ embedded = false }: AdminFinanceiroProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeTab = location.pathname.endsWith("/integracoes")
    ? "integracoes"
    : location.pathname.endsWith("/pagina")
      ? "pagina"
      : location.pathname.endsWith("/checkout")
        ? "checkout"
        : "planos";
  const [embeddedTab, setEmbeddedTab] = useState<"planos" | "integracoes" | "pagina" | "checkout">("planos");
  const currentTab = embedded ? embeddedTab : routeTab;

  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [settings, setSettings] = useState({
    asaasEnv: "sandbox" as AsaasEnvironment,
  });
  const [billingSecrets, setBillingSecrets] = useState<SecureConfigSecrets>({});
  const [asaasDraftApiKey, setAsaasDraftApiKey] = useState("");
  const [asaasDraftWebhookToken, setAsaasDraftWebhookToken] = useState("");
  const [subscriptions, setSubscriptions] = useState<BillingSubscriptionAdmin[]>([]);
  const hasAdminAsaasApiKey = Boolean(asaasDraftApiKey.trim() || billingSecrets["asaas_api_key"]?.configured);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [plansRes, secureConfig, subscriptionsRes] = await Promise.all([
        supabase.from("billing_plans" as any).select("*").order("sort_order", { ascending: true }),
        getSecureConfig("billing_admin"),
        supabase
          .from("billing_subscriptions" as any)
          .select("id, status, billing_cycle, payment_method, amount, customer_email, master_name, ct_name, asaas_payment_id, created_at, paid_at, metadata")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (plansRes.error) {
        throw new Error(plansRes.error.message || "Erro ao carregar planos do SaaS.");
      }

      if (subscriptionsRes.error) {
        throw new Error(subscriptionsRes.error.message || "Erro ao carregar assinaturas do SaaS.");
      }

      setPlans(((plansRes.data || []) as any[]).map((plan) => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : [],
      })));
      setSubscriptions(((subscriptionsRes.data || []) as any[]).map((subscription) => ({
        ...subscription,
        metadata: subscription.metadata && typeof subscription.metadata === "object" ? subscription.metadata : null,
      })) as BillingSubscriptionAdmin[]);

      setSettings({
        asaasEnv: secureConfig.values?.asaas_env === "production" ? "production" : "sandbox",
      });
      setBillingSecrets(secureConfig.secrets || {});
      setAsaasDraftApiKey("");
      setAsaasDraftWebhookToken("");
    } catch (error) {
      console.error("Erro ao carregar financeiro SaaS:", error);
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar o financeiro SaaS.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const openCreatePlan = () => {
    setPlanForm(emptyPlanForm);
    setDialogOpen(true);
  };

  const openEditPlan = (plan: BillingPlan) => {
    setPlanForm({
      id: plan.id,
      name: plan.name,
      description: plan.description || "",
      priceMonthly: formatCurrencyInput(Number(plan.price_monthly || 0)),
      priceYearly: plan.price_yearly ? formatCurrencyInput(Number(plan.price_yearly)) : "",
      userLimit: String(plan.user_limit),
      launchLimit: String(plan.launch_limit),
      featuresText: plan.features.join("\n"),
      highlightLabel: plan.highlight_label || "",
      isActive: plan.is_active,
      isPopular: plan.is_popular,
      sortOrder: String(plan.sort_order),
    });
    setDialogOpen(true);
  };

  const parsedFeatures = useMemo(
    () =>
      planForm.featuresText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    [planForm.featuresText],
  );

  const handleSavePlan = async () => {
    if (!planForm.name.trim() || !planForm.priceMonthly.trim()) {
      toast.error("Nome e preco mensal sao obrigatorios.");
      return;
    }

    setSavingPlan(true);
    const priceMonthly = parseCurrencyInput(planForm.priceMonthly);
    const priceYearly = parseCurrencyInput(planForm.priceYearly);

    if (priceMonthly <= 0) {
      toast.error("Informe um valor mensal valido.");
      setSavingPlan(false);
      return;
    }

    const payload = {
      name: planForm.name.trim(),
      description: planForm.description.trim() || null,
      price_monthly: priceMonthly,
      price_yearly: priceYearly > 0 ? priceYearly : null,
      user_limit: Number(planForm.userLimit || 0),
      launch_limit: Number(planForm.launchLimit || 0),
      features: parsedFeatures,
      highlight_label: planForm.highlightLabel.trim() || null,
      is_active: planForm.isActive,
      is_popular: planForm.isPopular,
      sort_order: Number(planForm.sortOrder || 0),
      updated_at: new Date().toISOString(),
    };

    const response = planForm.id
      ? await supabase.from("billing_plans" as any).update(payload).eq("id", planForm.id)
      : await supabase.from("billing_plans" as any).insert(payload);

    if (response.error) {
      toast.error("Erro ao salvar plano.");
    } else {
      toast.success(planForm.id ? "Plano atualizado." : "Plano criado.");
      setDialogOpen(false);
      await fetchAll();
    }

    setSavingPlan(false);
  };

  const handleSaveSettings = async () => {
    if (!asaasDraftApiKey.trim() && !billingSecrets["asaas_api_key"]?.configured) {
      toast.error("Informe e salve a API key do Asaas.");
      return;
    }

    setSavingSettings(true);
    try {
      const result = await saveSecureConfig("billing_admin", {
        asaas_api_key: asaasDraftApiKey || "",
        asaas_env: settings.asaasEnv,
        asaas_webhook_token: asaasDraftWebhookToken || "",
      });
      setSettings({
        asaasEnv: result.values.asaas_env === "production" ? "production" : "sandbox",
      });
      setBillingSecrets(result.secrets);
      setAsaasDraftApiKey("");
      setAsaasDraftWebhookToken("");
      toast.success("Configuracoes do Asaas salvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar configuracoes do Asaas.");
    }
    setSavingSettings(false);
  };

  const handleTest = async () => {
    if (!asaasDraftApiKey.trim() && !billingSecrets["asaas_api_key"]?.configured) {
      toast.error("Salve uma API key antes de testar.");
      return;
    }

    setTesting(true);
    try {
      const data = await testAsaasConnection({
        apiKey: asaasDraftApiKey.trim() || undefined,
        environment: settings.asaasEnv,
      });
      if (data.success) {
        const detectedEnv = data.environment === "production" ? "production" : "sandbox";
        setSettings((prev) => ({ ...prev, asaasEnv: detectedEnv }));
        toast.success(`Conexao validada em ${detectedEnv === "production" ? "producao" : "sandbox"}. Saldo encontrado: R$ ${Number(data.balance || 0).toFixed(2).replace(".", ",")}`);
      } else {
        toast.error(data.error || "Falha ao validar a integracao.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao testar a integracao.");
    } finally {
      setTesting(false);
    }
  };

  const handleReprocessSubscription = async (subscriptionId: string) => {
    setReprocessingId(subscriptionId);
    try {
      const { data, error } = await supabase.functions.invoke("reprocess-billing-subscription", {
        body: { subscription_id: subscriptionId },
      });

      if (error) {
        throw new Error(error.message || "Erro ao reprocessar a assinatura.");
      }

      if (data?.success) {
        toast.success(data.message || "Assinatura reprocessada com sucesso.");
      } else {
        toast.error(data?.message || "Pagamento ainda nao confirmado no Asaas.");
      }

      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao reprocessar a assinatura.");
    } finally {
      setReprocessingId(null);
    }
  };

  if (loading) {
    return <div className={`flex items-center justify-center text-muted-foreground ${embedded ? "min-h-[320px]" : "min-h-screen bg-background"}`}>Carregando...</div>;
  }

  return (
    <div className={embedded ? "" : "min-h-screen bg-background"}>
      <div className={`mx-auto max-w-6xl px-4 ${embedded ? "py-0 sm:px-0" : "py-10 sm:px-6"}`}>
        {!embedded && (
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Button variant="ghost" className="mb-3 px-0 text-muted-foreground" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao painel
              </Button>
              <h1 className="font-heading text-3xl uppercase text-foreground">Financeiro SaaS</h1>
              <p className="text-sm text-muted-foreground">Gerencie planos do produto, a integracao principal com o Asaas e a experiencia visual da assinatura.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to="/planos">
                <Button variant="outline">Ver pagina publica de planos</Button>
              </Link>
              <Link to="/login">
                <Button variant="outline">Ir para login</Button>
              </Link>
            </div>
          </div>
        )}

        <div className={`mb-8 flex flex-wrap gap-2 ${embedded ? "rounded-[24px] border border-border/70 bg-background/40 p-3 sm:rounded-2xl" : ""}`}>
          <Button
            variant={currentTab === "planos" ? "default" : "outline"}
            onClick={() => (embedded ? setEmbeddedTab("planos") : navigate("/admin/financeiro/planos"))}
          >
            Planos
          </Button>
          <Button
            variant={currentTab === "integracoes" ? "default" : "outline"}
            onClick={() => (embedded ? setEmbeddedTab("integracoes") : navigate("/admin/financeiro/integracoes"))}
          >
            Integracoes
          </Button>
          <Button
            variant={currentTab === "pagina" ? "default" : "outline"}
            onClick={() => (embedded ? setEmbeddedTab("pagina") : navigate("/admin/financeiro/pagina"))}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Pagina de planos
          </Button>
          <Button
            variant={currentTab === "checkout" ? "default" : "outline"}
            onClick={() => (embedded ? setEmbeddedTab("checkout") : navigate("/admin/financeiro/checkout"))}
          >
            <CreditCard className="mr-2 h-4 w-4" /> Checkout
          </Button>
        </div>

        {currentTab === "planos" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl uppercase text-foreground">Planos</h2>
                <p className="text-sm text-muted-foreground">Edite o catalogo do SaaS sem mexer em codigo.</p>
              </div>
              <Button onClick={openCreatePlan}>
                <Plus className="mr-2 h-4 w-4" /> Novo plano
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <Card key={plan.id} className={`border-border/80 bg-card/80 ${plan.is_popular ? "ring-1 ring-primary/40" : ""}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl text-foreground">{plan.name}</CardTitle>
                        <CardDescription>{plan.description || "Sem descricao."}</CardDescription>
                      </div>
                      <div className="flex flex-col gap-2">
                        {plan.is_popular && <Badge>{plan.highlight_label || "Destaque"}</Badge>}
                        <Badge variant={plan.is_active ? "default" : "secondary"}>{plan.is_active ? "Ativo" : "Inativo"}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-muted-foreground">Mensal</p>
                        <p className="font-semibold text-foreground">R$ {Number(plan.price_monthly).toFixed(2).replace(".", ",")}</p>
                      </div>
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-muted-foreground">Anual por mes</p>
                        <p className="font-semibold text-foreground">
                          {plan.price_yearly ? `R$ ${Number(plan.price_yearly).toFixed(2).replace(".", ",")}` : "Nao usado"}
                        </p>
                        {plan.price_yearly ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Total anual: R$ {getYearlyTotal(Number(plan.price_yearly)).toFixed(2).replace(".", ",")}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-muted-foreground">Limite de usuarios</p>
                        <p className="font-semibold text-foreground">{plan.user_limit}</p>
                      </div>
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-muted-foreground">Limite de lancamentos</p>
                        <p className="font-semibold text-foreground">{plan.launch_limit}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm text-foreground">
                          <Check className="h-4 w-4 text-primary" /> {feature}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border p-3">
                      <span className="text-sm text-foreground">Mais popular</span>
                      <Switch
                        checked={plan.is_popular}
                        onCheckedChange={async (checked) => {
                          await supabase.from("billing_plans" as any).update({ is_popular: checked, updated_at: new Date().toISOString() }).eq("id", plan.id);
                          await fetchAll();
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border p-3">
                      <span className="text-sm text-foreground">Plano ativo</span>
                      <Switch
                        checked={plan.is_active}
                        onCheckedChange={async (checked) => {
                          await supabase.from("billing_plans" as any).update({ is_active: checked, updated_at: new Date().toISOString() }).eq("id", plan.id);
                          await fetchAll();
                        }}
                      />
                    </div>

                    <Button variant="outline" className="w-full" onClick={() => openEditPlan(plan)}>
                      Editar plano
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : currentTab === "integracoes" ? (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/80 bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" /> Integracao Asaas
                </CardTitle>
                <CardDescription>Reutiliza a mesma base de integracao ja usada pelo modulo financeiro do produto.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                  Os segredos do Asaas SaaS agora ficam isolados no cofre seguro atendido pela edge function `secure-config`.
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={asaasDraftApiKey}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setAsaasDraftApiKey(nextValue);
                      if (nextValue.trim()) {
                        setSettings((prev) => ({
                          ...prev,
                          asaasEnv: nextValue.startsWith("$aact_prod_") ? "production" : "sandbox",
                        }));
                      }
                    }}
                    placeholder={billingSecrets["asaas_api_key"]?.configured ? "Já configurada. Preencha para substituir" : "$aact_..."}
                  />
                  {(asaasDraftApiKey || billingSecrets["asaas_api_key"]?.configured) && (
                    <p className="text-xs text-muted-foreground">
                      Ambiente atual: {settings.asaasEnv === "production" ? "Producao" : "Sandbox"}
                      {billingSecrets["asaas_api_key"]?.configured && !asaasDraftApiKey ? ` • ${billingSecrets["asaas_api_key"]?.maskedValue}` : ""}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={settings.asaasEnv === "sandbox" ? "default" : "outline"} onClick={() => setSettings((prev) => ({ ...prev, asaasEnv: "sandbox" }))}>
                      Sandbox
                    </Button>
                    <Button type="button" variant={settings.asaasEnv === "production" ? "default" : "outline"} onClick={() => setSettings((prev) => ({ ...prev, asaasEnv: "production" }))}>
                      Producao
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Token do webhook</Label>
                  <Input
                    type="password"
                    value={asaasDraftWebhookToken}
                    onChange={(event) => setAsaasDraftWebhookToken(event.target.value)}
                    placeholder={billingSecrets["asaas_webhook_token"]?.configured ? "Já configurado. Preencha para substituir" : "Mesmo token configurado no webhook do Asaas"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Este token precisa ser igual ao `authToken` configurado no webhook do Asaas para assinaturas SaaS.
                    {billingSecrets["asaas_webhook_token"]?.configured && !asaasDraftWebhookToken ? ` Atual: ${billingSecrets["asaas_webhook_token"]?.maskedValue}` : ""}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={handleSaveSettings} disabled={savingSettings}>
                    <Save className="mr-2 h-4 w-4" />
                    {savingSettings ? "Salvando..." : "Salvar configuracao"}
                  </Button>
                  <Button variant="outline" onClick={handleTest} disabled={testing || !hasAdminAsaasApiKey}>
                    {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    {testing ? "Testando..." : "Testar conexao"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/80">
              <CardHeader>
                <CardTitle>Observacoes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>As cobrancas SaaS usam o Asaas de forma centralizada, separado do financeiro interno de cada CT.</p>
                <p>PIX retorna QR Code e copia e cola. Cartao usa o link de fatura/checkout do Asaas para concluir o pagamento sem expor dados sensiveis no frontend.</p>
                <p>O webhook do Asaas continua sendo o caminho principal para ativar o plano automaticamente.</p>
                <p>Se houver atraso ou falha no webhook, o reprocessamento manual abaixo permite validar o pagamento no Asaas e concluir a liberacao do acesso sem mexer no banco manualmente.</p>
              </CardContent>
            </Card>
            </div>

            <Card className="border-border/80 bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" /> Assinaturas recentes
                </CardTitle>
                <CardDescription>
                  Use este painel para revisar compras recentes, limpar pendencias duplicadas automaticamente e reprocessar um pagamento confirmado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Reprocesse apenas quando o cliente informar que o pagamento ja foi confirmado no Asaas e o acesso ainda nao tiver sido liberado.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {subscriptions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                      Nenhuma assinatura recente encontrada.
                    </div>
                  ) : (
                    subscriptions.map((subscription) => {
                      const pendingUsername = String(subscription.metadata?.master_username || "").trim().toLowerCase();
                      const canReprocess = Boolean(subscription.asaas_payment_id) && (subscription.status === "pending" || subscription.status === "past_due");

                      return (
                        <div key={subscription.id} className="rounded-2xl border border-border/70 bg-background/30 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={getSubscriptionStatusVariant(subscription.status)}>
                                  {getSubscriptionStatusLabel(subscription.status)}
                                </Badge>
                                <Badge variant="outline">
                                  {subscription.billing_cycle === "yearly" ? "Anual" : "Mensal"}
                                </Badge>
                                {subscription.payment_method ? (
                                  <Badge variant="outline">
                                    {subscription.payment_method === "credit_card" ? "Cartao" : "PIX"}
                                  </Badge>
                                ) : null}
                              </div>

                              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                                <p>
                                  <span className="text-foreground">CT:</span> {subscription.ct_name || "Nao informado"}
                                </p>
                                <p>
                                  <span className="text-foreground">Mestre:</span> {subscription.master_name || "Nao informado"}
                                </p>
                                <p>
                                  <span className="text-foreground">Usuario:</span> {pendingUsername || "Nao informado"}
                                </p>
                                <p>
                                  <span className="text-foreground">E-mail:</span> {subscription.customer_email || "Nao informado"}
                                </p>
                                <p>
                                  <span className="text-foreground">Criada em:</span> {formatDateTime(subscription.created_at)}
                                </p>
                                <p>
                                  <span className="text-foreground">Pago em:</span> {formatDateTime(subscription.paid_at)}
                                </p>
                                <p>
                                  <span className="text-foreground">Valor:</span>{" "}
                                  {typeof subscription.amount === "number"
                                    ? `R$ ${Number(subscription.amount).toFixed(2).replace(".", ",")}`
                                    : "Nao informado"}
                                </p>
                                <p className="truncate">
                                  <span className="text-foreground">Asaas:</span> {subscription.asaas_payment_id || "Nao vinculado"}
                                </p>
                              </div>
                            </div>

                            <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[220px]">
                              <Button
                                variant={canReprocess ? "default" : "outline"}
                                disabled={!canReprocess || reprocessingId === subscription.id}
                                onClick={() => handleReprocessSubscription(subscription.id)}
                              >
                                {reprocessingId === subscription.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                )}
                                {reprocessingId === subscription.id ? "Reprocessando..." : "Reprocessar assinatura"}
                              </Button>
                              <p className="text-xs text-muted-foreground">
                                {canReprocess
                                  ? "Consulta o pagamento no Asaas e libera a conta se ele ja estiver confirmado."
                                  : "Reprocessamento disponivel apenas para assinaturas pendentes ou atrasadas com pagamento Asaas vinculado."}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : currentTab === "pagina" ? (
          <div className="space-y-6">
            {!embedded && (
              <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(220,38,38,0.12),rgba(15,23,42,0.45))] p-6 text-white shadow-[0_30px_80px_-60px_rgba(220,38,38,0.8)]">
                <p className="mb-2 text-xs uppercase tracking-[0.34em] text-primary/80">Conversao e percepcao</p>
                <h2 className="font-heading text-3xl uppercase">Estilize a vitrine do seu SaaS</h2>
                <p className="mt-3 max-w-3xl text-sm text-white/72">
                  Ajuste imagem de cabecalho, frases de impacto, itens de confianca, depoimentos e popup de compra recente sem abrir codigo.
                </p>
              </div>
            )}

            <PlansPageConfigSection />
          </div>
        ) : (
          <div className="space-y-6">
            {!embedded && (
              <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(220,38,38,0.12),rgba(15,23,42,0.45))] p-6 text-white shadow-[0_30px_80px_-60px_rgba(220,38,38,0.8)]">
                <p className="mb-2 text-xs uppercase tracking-[0.34em] text-primary/80">Checkout SaaS</p>
                <h2 className="font-heading text-3xl uppercase">Personalize a etapa final do pagamento</h2>
                <p className="mt-3 max-w-3xl text-sm text-white/72">
                  Ajuste a copy, os CTAs e o acabamento visual do modal final sem editar o codigo toda vez.
                </p>
              </div>
            )}

            <CheckoutPageConfigSection />
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-heading">{planForm.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome</Label>
              <Input value={planForm.name} onChange={(event) => setPlanForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Descricao</Label>
              <Textarea value={planForm.description} onChange={(event) => setPlanForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Preco mensal</Label>
              <Input
                value={planForm.priceMonthly}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, priceMonthly: event.target.value }))}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Preco anual por mes</Label>
              <Input
                value={planForm.priceYearly}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, priceYearly: event.target.value }))}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Total cobrado no anual: R$ {getYearlyTotal(parseCurrencyInput(planForm.priceYearly)).toFixed(2).replace(".", ",")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Limite de usuarios</Label>
              <Input value={planForm.userLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, userLimit: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Limite de lancamentos</Label>
              <Input value={planForm.launchLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, launchLimit: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Rotulo de destaque</Label>
              <Input value={planForm.highlightLabel} onChange={(event) => setPlanForm((prev) => ({ ...prev, highlightLabel: event.target.value }))} placeholder="Mais popular" />
            </div>

            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input value={planForm.sortOrder} onChange={(event) => setPlanForm((prev) => ({ ...prev, sortOrder: event.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Features</Label>
              <Textarea value={planForm.featuresText} onChange={(event) => setPlanForm((prev) => ({ ...prev, featuresText: event.target.value }))} rows={6} placeholder={"Uma feature por linha\nEx: Suporte prioritario"} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm text-foreground">Plano ativo</span>
              <Switch checked={planForm.isActive} onCheckedChange={(checked) => setPlanForm((prev) => ({ ...prev, isActive: checked }))} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm text-foreground">Plano popular</span>
              <Switch checked={planForm.isPopular} onCheckedChange={(checked) => setPlanForm((prev) => ({ ...prev, isPopular: checked }))} />
            </div>
          </div>

          <Button onClick={handleSavePlan} disabled={savingPlan}>
            {savingPlan ? "Salvando..." : planForm.id ? "Atualizar plano" : "Criar plano"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFinanceiro;
