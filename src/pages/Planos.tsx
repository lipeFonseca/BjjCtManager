import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Loader2, QrCode, Quote, ShieldCheck, Sparkles, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { toast } from "sonner";
import { getPublicBillingPlans } from "@/services/billing";
import { createBillingCheckout } from "@/services/asaas";
import { supabase } from "@/integrations/supabase/client";
import { useCheckoutPageConfig } from "@/hooks/useCheckoutPageConfig";
import { getSafeComparisonColumns, getSafeFeatureCarouselItems, getSafeProblemColumns, getSafeReviewItems, getSafeTrustItems, parsePopupNames, usePlansPageConfig } from "@/hooks/usePlansPageConfig";

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
  is_popular: boolean;
};

type SocialProof = {
  name: string;
  planName: string;
};

const getDisplayedPrice = (plan: BillingPlan, billingCycle: "monthly" | "yearly") =>
  billingCycle === "yearly" ? Number(plan.price_yearly || 0) : Number(plan.price_monthly || 0);

const getYearlyTotal = (plan: BillingPlan) => Number(plan.price_yearly || 0) * 12;

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;
const onlyDigits = (value: string) => value.replace(/\D/g, "");
const formatPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

const formatCpfCnpj = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const Planos = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { config: pageConfig, loading: loadingConfig } = usePlansPageConfig();
  const { config: checkoutConfig } = useCheckoutPageConfig();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [socialProof, setSocialProof] = useState<SocialProof | null>(null);
  const [showSocialProof, setShowSocialProof] = useState(false);
  const [form, setForm] = useState({
    ctName: "",
    masterName: "",
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    cpfCnpj: "",
    phone: "",
    paymentMethod: "pix" as "pix" | "credit_card",
  });
  const [checkout, setCheckout] = useState<{
    invoiceUrl: string | null;
    pixCode: string | null;
    pixQrCode: string | null;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const loadedPlans = await getPublicBillingPlans();
        setPlans(
          loadedPlans.map((plan) => ({
            ...plan,
            features: Array.isArray(plan.features) ? plan.features : [],
          })),
        );

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome, sobrenome, email, ct_id, username")
            .eq("user_id", session.user.id)
            .maybeSingle();

          let ctName = "";
          if (profile?.ct_id) {
            const { data: ct } = await supabase.from("centros_treinamento").select("nome").eq("id", profile.ct_id).maybeSingle();
            ctName = ct?.nome || "";
          }

          setForm((prev) => ({
            ...prev,
            ctName,
            masterName: [profile?.nome, profile?.sobrenome].filter(Boolean).join(" ").trim(),
            username: (profile as { username?: string | null } | null)?.username || "",
            email: profile?.email || session.user.email || "",
          }));
        }
      } catch {
        toast.error("Nao foi possivel carregar os planos.");
      } finally {
        setLoadingPlans(false);
      }
    };

    void load();
  }, []);

  const requiredFromDashboard = useMemo(() => new URLSearchParams(location.search).get("required") === "1", [location.search]);
  const trustItems = useMemo(() => getSafeTrustItems(pageConfig.plans_page_trust_items).filter((item) => item.enabled), [pageConfig.plans_page_trust_items]);
  const featureCarouselItems = useMemo(() => getSafeFeatureCarouselItems(pageConfig.plans_page_feature_carousel_items).filter((item) => item.enabled), [pageConfig.plans_page_feature_carousel_items]);
  const comparisonColumns = useMemo(() => getSafeComparisonColumns(pageConfig.plans_page_comparison_columns).filter((item) => item.enabled), [pageConfig.plans_page_comparison_columns]);
  const problemColumns = useMemo(() => getSafeProblemColumns(pageConfig.plans_page_problems_columns).filter((item) => item.enabled), [pageConfig.plans_page_problems_columns]);
  const reviewItems = useMemo(() => getSafeReviewItems(pageConfig.plans_page_reviews).filter((item) => item.enabled), [pageConfig.plans_page_reviews]);
  const popupNames = useMemo(() => parsePopupNames(pageConfig.plans_page_popup_names), [pageConfig.plans_page_popup_names]);

  useEffect(() => {
    if (pageConfig.plans_page_show_popup !== "true" || popupNames.length === 0 || plans.length === 0) {
      setShowSocialProof(false);
      return;
    }

    const intervalMs = Math.max(5000, Number(pageConfig.plans_page_popup_interval_ms || 10000));

    const showRandomPurchase = () => {
      const person = popupNames[Math.floor(Math.random() * popupNames.length)];
      const plan = plans[Math.floor(Math.random() * plans.length)];
      setSocialProof({ name: person, planName: plan.name });
      setShowSocialProof(true);

      window.setTimeout(() => {
        setShowSocialProof(false);
      }, 4200);
    };

    showRandomPurchase();
    const intervalId = window.setInterval(showRandomPurchase, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [pageConfig.plans_page_popup_interval_ms, pageConfig.plans_page_show_popup, plans, popupNames]);

  const openCheckout = (plan: BillingPlan) => {
    setSelectedPlan(plan);
    setCheckout(null);
    setStep(1);
  };

  const validateSignupFields = () => {
    if (!form.ctName.trim() || !form.masterName.trim() || !form.email.trim()) {
      toast.error("Preencha os dados do CT e do responsavel.");
      return false;
    }

    const normalizedUsername = form.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername)) {
      toast.error("Escolha um nome de usuario com 3 a 30 caracteres usando letras, numeros, ponto, underline ou hifen.");
      return false;
    }

    if (form.password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return false;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("A confirmacao de senha nao confere.");
      return false;
    }

    const documentDigits = onlyDigits(form.cpfCnpj);
    if (documentDigits.length !== 11 && documentDigits.length !== 14) {
      toast.error("Informe um CPF ou CNPJ valido.");
      return false;
    }

    const phoneDigits = onlyDigits(form.phone);
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      toast.error("Informe um telefone valido com DDD.");
      return false;
    }

    return true;
  };

  const openInvoicePage = () => {
    if (!checkout?.invoiceUrl) {
      toast.error("Link de pagamento indisponivel.");
      return;
    }

    window.open(checkout.invoiceUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async () => {
    if (!selectedPlan) return;
    if (!validateSignupFields()) {
      return;
    }

    const documentDigits = onlyDigits(form.cpfCnpj);
    const phoneDigits = onlyDigits(form.phone);

    setSubmitting(true);
    try {
      const data = await createBillingCheckout({
        planId: selectedPlan.id,
        ctName: form.ctName,
        masterName: form.masterName,
        username: form.username.trim().toLowerCase(),
        password: form.password,
        email: form.email,
        cpfCnpj: documentDigits,
        phone: phoneDigits,
        billingCycle,
        paymentMethod: form.paymentMethod,
      });
      const invoiceUrl = data.invoice_url || null;
      const pixCode = data.pix_copia_cola || null;
      const pixQrCode = data.pix_qrcode || null;

      if (form.paymentMethod === "credit_card" && !invoiceUrl) {
        toast.error("O Asaas nao retornou um link de checkout para cartao. Revise a configuracao da conta.");
        return;
      }

      setCheckout({
        invoiceUrl,
        pixCode,
        pixQrCode,
      });
      setStep(3);
      toast.success(`Pagamento criado com sucesso em ${data.environment === "production" ? "producao" : "sandbox"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar checkout.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPlans || loadingConfig) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Carregando planos...</div>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07090d] text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.24),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_24%),linear-gradient(180deg,#09090b_0%,#111827_55%,#050816_100%)]" />
      <div
        className="absolute inset-x-0 top-0 h-[520px] opacity-30"
        style={{
          backgroundImage: pageConfig.plans_page_header_image_url ? `linear-gradient(180deg,rgba(3,7,18,0.18),rgba(3,7,18,0.85)), url(${pageConfig.plans_page_header_image_url})` : undefined,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />

      <div className="relative mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-12 overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-[0_40px_120px_-70px_rgba(0,0,0,1)] backdrop-blur-xl">
          <div className={`grid gap-0 ${pageConfig.plans_page_header_image_url ? "xl:grid-cols-[0.95fr_1.05fr]" : ""}`}>
            <div className="p-5 sm:p-8 lg:p-10 xl:p-12">
              <div className="mb-8">
                <div className="max-w-3xl">
                  <p className="mb-3 text-xs uppercase tracking-[0.38em] text-primary/80">Planos BJJ Manager</p>
                  <h1 className="font-heading text-4xl uppercase leading-[0.95] text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                    {pageConfig.plans_page_title}
                  </h1>
                  <p className="mt-5 max-w-2xl text-sm text-white/68 sm:text-base lg:text-lg">{pageConfig.plans_page_subtitle}</p>
                </div>

                {pageConfig.plans_page_header_image_url ? (
                  <div className="relative mt-7 min-h-[260px] overflow-hidden rounded-[28px] border border-white/10 xl:hidden">
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `linear-gradient(135deg,rgba(7,9,13,0.12),rgba(7,9,13,0.58)), url(${pageConfig.plans_page_header_image_url})`,
                      }}
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(220,38,38,0.22),transparent_32%),linear-gradient(180deg,rgba(7,9,13,0.04),rgba(7,9,13,0.28))]" />
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#090b11] via-[#090b11]/35 to-transparent" />
                  </div>
                ) : null}

                <div className="mt-7 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex max-w-2xl items-start gap-3 rounded-3xl border border-primary/20 bg-primary/10 px-5 py-4 text-sm text-primary/95">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{pageConfig.plans_page_motivational_text}</span>
                    </div>
                    {requiredFromDashboard ? (
                      <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/12 px-4 py-3 text-sm text-primary">
                        Sua conta precisa de uma assinatura ativa para liberar o acesso completo ao sistema.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                    <Link to="/login">
                      <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                        Ir para login
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {trustItems.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {trustItems.map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/78">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <p>{item.label}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {pageConfig.plans_page_header_image_url ? (
              <div className="relative hidden min-h-[420px] xl:block xl:min-h-full">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(135deg,rgba(7,9,13,0.2),rgba(7,9,13,0.72)), url(${pageConfig.plans_page_header_image_url})`,
                  }}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(220,38,38,0.24),transparent_30%),linear-gradient(90deg,rgba(7,9,13,0.05),rgba(7,9,13,0.35))]" />
                <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/12 to-transparent" />
              </div>
            ) : null}
          </div>
        </header>

        <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs uppercase tracking-[0.34em] text-primary/80">Escolha sua operacao</p>
            <h2 className="font-heading text-3xl uppercase text-white sm:text-4xl">Planos pensados para o ritmo do seu CT</h2>
            <p className="mt-3 text-sm text-white/60 sm:text-base">
              Alterne entre mensal e anual para comparar a estrutura ideal para o seu momento.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-1 rounded-[32px] border border-white/10 bg-white/[0.04] p-1.5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)]">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-[24px] px-6 py-3 text-sm font-semibold transition-all ${billingCycle === "monthly" ? "bg-white/[0.08] text-white" : "text-white/62 hover:text-white"}`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`rounded-[24px] px-6 py-3 text-sm font-semibold transition-all ${billingCycle === "yearly" ? "bg-primary text-white shadow-[0_12px_30px_-18px_rgba(220,38,38,0.95)]" : "text-white/62 hover:text-white"}`}
            >
              Anual
            </button>
          </div>
        </section>

        <section id="pricing-plans" className="grid gap-6 scroll-mt-24 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`group relative overflow-hidden rounded-[34px] border-white/10 bg-white/[0.04] text-white shadow-[0_35px_90px_-55px_rgba(0,0,0,0.95)] transition-transform duration-300 hover:-translate-y-1 ${plan.is_popular ? "ring-1 ring-primary/50" : ""}`}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-orange-400 to-amber-200 opacity-90" />
              {plan.is_popular ? (
                <div className="absolute right-5 top-5 rounded-full border border-primary/30 bg-primary/16 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  {plan.highlight_label || "Mais popular"}
                </div>
              ) : null}
              <CardHeader className="pb-5">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-primary">
                  <Star className="h-5 w-5" />
                </div>
                <CardTitle className="font-heading text-3xl uppercase text-white">{plan.name}</CardTitle>
                <CardDescription className="text-white/60">{plan.description || "Plano pronto para operar com estabilidade."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-[28px] border border-white/8 bg-black/20 p-5">
                  <div className="flex items-end gap-2">
                    <span className="font-heading text-5xl leading-none text-white">
                      R$ {getDisplayedPrice(plan, billingCycle).toFixed(0)}
                    </span>
                    <span className="pb-2 text-sm uppercase tracking-[0.2em] text-white/45">/mes</span>
                  </div>
                  {billingCycle === "yearly" && plan.price_yearly ? (
                    <p className="mt-3 text-sm text-emerald-300">
                      Total anual cobrado: {formatCurrency(getYearlyTotal(plan))}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-white/50">Cobranca recorrente mensal com ativacao simples.</p>
                  )}
                  <p className="mt-3 text-sm text-white/58">
                    Ate {plan.user_limit} usuarios e {plan.launch_limit} lancamentos inclusos.
                  </p>
                </div>

                <div className="space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-sm text-white/82">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/14">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button className="h-12 w-full rounded-2xl text-base" size="lg" onClick={() => openCheckout(plan)}>
                  Assinar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        {pageConfig.plans_page_feature_carousel_enabled === "true" && featureCarouselItems.length > 0 ? (
          <section className="mt-16 rounded-[36px] border border-white/10 bg-white/[0.03] px-5 py-8 backdrop-blur-xl sm:px-8 sm:py-10">
            <div className="mb-8 max-w-2xl">
              <p className="mb-3 text-xs uppercase tracking-[0.34em] text-primary/80">Operacao em foco</p>
              <h2 className="font-heading text-3xl uppercase text-white sm:text-4xl">O sistema em beneficios visuais</h2>
              <p className="mt-3 text-sm text-white/62">
                Um carrossel de imagens com mensagem curta e direta, no estilo das referencias, mas adaptado para a paleta atual.
              </p>
            </div>

            <div className="mx-auto max-w-5xl px-10">
              <Carousel opts={{ align: "center", loop: true }}>
                <CarouselContent>
                  {featureCarouselItems.map((item, index) => (
                    <CarouselItem key={`${item.title}-${index}`} className="md:basis-1/2 xl:basis-1/3">
                      <div
                        className="relative min-h-[340px] overflow-hidden rounded-[30px] border border-white/10 bg-black/40"
                        style={{
                          backgroundImage: item.image_url
                            ? `linear-gradient(180deg,rgba(3,7,18,0.22),rgba(3,7,18,0.78)), url(${item.image_url})`
                            : "linear-gradient(180deg,rgba(127,29,29,0.55),rgba(15,23,42,0.92))",
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }}
                      >
                        <div className="flex h-full flex-col justify-end p-6 text-center">
                          <h3 className="font-heading text-3xl uppercase text-white">{item.title}</h3>
                          <p className="mt-4 text-sm leading-7 text-white/82">{item.description}</p>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-0 border-white/15 bg-white/8 text-white hover:bg-white/15" />
                <CarouselNext className="right-0 border-white/15 bg-white/8 text-white hover:bg-white/15" />
              </Carousel>
            </div>
          </section>
        ) : null}

        {pageConfig.plans_page_comparison_enabled === "true" && comparisonColumns.length > 0 ? (
          <section className="mt-16 rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-5 py-10 backdrop-blur-xl sm:px-8 sm:py-12">
            <div className="mx-auto max-w-6xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/80">{pageConfig.plans_page_comparison_eyebrow}</p>
              <p className="mt-4 text-base text-white/70 sm:text-lg">{pageConfig.plans_page_comparison_intro}</p>
              <h2 className="mx-auto mt-6 max-w-5xl font-heading text-4xl uppercase text-white sm:text-5xl">
                {pageConfig.plans_page_comparison_title}
              </h2>
            </div>

            <div className={`mt-12 grid gap-6 ${comparisonColumns.length === 1 ? "lg:grid-cols-1" : comparisonColumns.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
              {comparisonColumns.map((column, index) => {
                const isCenter = index === 1 && comparisonColumns.length >= 3;
                return (
                  <div
                    key={`${column.title}-${index}`}
                    className={`rounded-[30px] border p-6 shadow-[0_30px_90px_-65px_rgba(0,0,0,0.95)] ${
                      isCenter
                        ? "border-primary/45 bg-white/[0.08]"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <h3 className={`font-heading text-3xl uppercase ${isCenter ? "text-white" : "text-white/72"}`}>{column.title}</h3>
                    <div className={`mt-5 h-px w-full ${isCenter ? "bg-primary/35" : "bg-white/10"}`} />
                    <div className="mt-6 space-y-4">
                      {column.items.map((item) => (
                        <div key={item} className="flex items-start gap-3 text-left">
                          <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isCenter ? "bg-primary/14 text-primary" : "bg-white/8 text-primary"}`}>
                            {isCenter ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          </div>
                          <p className={`${isCenter ? "text-white/88" : "text-white/68"} text-base leading-7`}>{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mx-auto mt-10 max-w-5xl text-center text-lg text-white/82 sm:text-xl">
              {pageConfig.plans_page_comparison_footer}
            </p>
          </section>
        ) : null}

        {pageConfig.plans_page_problems_enabled === "true" && problemColumns.length > 0 ? (
          <section className="relative mt-16 overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(10,13,18,0.98),rgba(25,32,44,0.92))] px-5 py-10 text-white shadow-[0_35px_90px_-60px_rgba(220,38,38,0.35)] sm:px-8 sm:py-12">
            <div className="relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(220,38,38,0.14),transparent_26%)]" />
              <div className="absolute -right-20 -top-24 h-40 w-40 rounded-full border-[28px] border-primary/85 opacity-90" />
              <div className="absolute -bottom-24 -left-24 h-40 w-40 rounded-full border-[28px] border-primary/15" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

              <div className="relative z-10">
                <h2 className="text-center font-heading text-4xl uppercase text-white sm:text-5xl">
                  {pageConfig.plans_page_problems_title}
                </h2>

                <div className={`mt-12 grid gap-8 ${problemColumns.length === 1 ? "lg:grid-cols-1" : problemColumns.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
                  {problemColumns.map((column, index) => (
                    <div key={`${column.title}-${index}`} className="relative">
                      <div className="mb-5 flex justify-center">
                        <div className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-5 py-2">
                          <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-white/84">
                            {index === 0 ? pageConfig.plans_page_problems_left_label : index === 1 ? pageConfig.plans_page_problems_right_label : column.title}
                          </p>
                        </div>
                      </div>

                      <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.06] backdrop-blur-sm shadow-[0_24px_60px_-45px_rgba(0,0,0,0.9)]">
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                        <div className="absolute inset-0 rounded-[30px] ring-1 ring-inset ring-white/6" />
                        {column.items.map((item, itemIndex) => (
                          <div
                            key={item}
                            className={`relative flex items-start gap-4 px-5 py-5 ${itemIndex % 2 === 0 ? "bg-white/[0.05]" : "bg-slate-950/10"}`}
                          >
                            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_6px_rgba(220,38,38,0.12)]" />
                            <p className="text-lg leading-8 text-white/88">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {(pageConfig.plans_page_problems_pre_cta_text.trim() || (pageConfig.plans_page_problems_cta_enabled === "true" && pageConfig.plans_page_problems_cta_text.trim())) ? (
                  <div className="mt-14 flex flex-col items-center justify-center gap-5">
                    {pageConfig.plans_page_problems_pre_cta_text.trim() ? (
                      <p className="max-w-3xl text-center text-lg font-medium leading-8 text-white/82 sm:text-xl">
                        {pageConfig.plans_page_problems_pre_cta_text}
                      </p>
                    ) : null}

                    {pageConfig.plans_page_problems_cta_enabled === "true" && pageConfig.plans_page_problems_cta_text.trim() ? (
                      <Button
                        size="lg"
                        className="group inline-flex min-h-0 max-w-2xl whitespace-normal rounded-[28px] border border-primary/35 bg-[linear-gradient(135deg,#dc2626_0%,#ef4444_55%,#dc2626_100%)] px-5 py-4 text-center text-[15px] font-semibold leading-7 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_60px_-32px_rgba(220,38,38,0.95)] transition-transform duration-300 hover:scale-[1.01] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_28px_70px_-30px_rgba(220,38,38,1)] sm:px-8 sm:text-base"
                        onClick={() => document.getElementById("pricing-plans")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      >
                        <span className="text-pretty">{pageConfig.plans_page_problems_cta_text}</span>
                        <ArrowRight className="ml-2 mt-0.5 h-4 w-4 shrink-0 self-center transition-transform duration-300 group-hover:translate-x-1" />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {pageConfig.plans_page_reviews_enabled === "true" && reviewItems.length > 0 ? (
          <section className="mt-16 rounded-[36px] border border-white/10 bg-white/[0.03] px-5 py-8 backdrop-blur-xl sm:px-8 sm:py-10">
            <div className="mb-8 max-w-2xl">
              <p className="mb-3 text-xs uppercase tracking-[0.34em] text-primary/80">Confianca real</p>
              <h2 className="font-heading text-3xl uppercase text-white sm:text-4xl">Academias que aprovaram a experiencia</h2>
              <p className="mt-3 text-sm text-white/62">
                Um carrossel pensado para reforcar credibilidade logo abaixo dos planos, do jeito que voce pediu.
              </p>
            </div>

            <div className="px-10">
              <Carousel opts={{ align: "start", loop: true }}>
                <CarouselContent>
                  {reviewItems.map((review, index) => (
                    <CarouselItem key={`${review.name}-${index}`} className="md:basis-1/2 xl:basis-1/3">
                      <div className="h-full rounded-[30px] border border-white/10 bg-[#f3f0ed] p-6 text-slate-800 shadow-[0_30px_80px_-60px_rgba(255,255,255,0.4)]">
                        <Quote className="mb-4 h-8 w-8 text-primary" />
                        <p className="min-h-[180px] text-base leading-8 text-slate-600">"{review.text}"</p>
                        <div className="mt-6 border-t border-slate-300 pt-4">
                          <p className="text-lg font-semibold text-slate-800">{review.name}</p>
                          <p className="mt-1 text-sm font-semibold text-primary">{review.role}</p>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-0 border-white/15 bg-white/8 text-white hover:bg-white/15" />
                <CarouselNext className="right-0 border-white/15 bg-white/8 text-white hover:bg-white/15" />
              </Carousel>
            </div>
          </section>
        ) : null}

        <section className="mt-16 rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_35px_90px_-60px_rgba(220,38,38,0.65)] sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.3em] text-primary/80">Pronto para crescer</p>
              <h2 className="font-heading text-3xl uppercase text-white sm:text-4xl">Estrutura comercial, operacao e credibilidade em uma unica plataforma</h2>
              <p className="mt-4 max-w-2xl text-sm text-white/65 sm:text-base">
                O sistema foi desenhado para passar seguranca no primeiro contato e sustentar a operacao quando o CT comeca a escalar.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <p className="text-3xl font-semibold text-white">PIX + Cartao</p>
                <p className="mt-2 text-sm text-white/58">Checkout com Asaas, confirmacao e experiencia clara para o cliente.</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <p className="text-3xl font-semibold text-white">Admin total</p>
                <p className="mt-2 text-sm text-white/58">Planos, visual e prova social controlados pela aba de Configuracoes do admin.</p>
              </div>
            </div>
          </div>
        </section>

        {pageConfig.plans_page_footer_image_url ? (
          <footer
            className="mt-16 h-40 rounded-[36px] border border-white/10"
            style={{
              backgroundImage: `linear-gradient(180deg,rgba(3,7,18,0.25),rgba(3,7,18,0.8)), url(${pageConfig.plans_page_footer_image_url})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
        ) : null}
      </div>

      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto overflow-x-hidden border-white/10 bg-[#090b10] p-0 text-white sm:w-full">
          <DialogHeader>
            <DialogTitle className="sr-only">
              {step === 1 && "Dados da assinatura"}
              {step === 2 && "Forma de pagamento"}
              {step === 3 && "Finalizar pagamento"}
            </DialogTitle>
          </DialogHeader>

          {selectedPlan && step === 1 && (
            <div className="space-y-4 p-4 sm:p-6">
              <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                Plano selecionado: <strong className="text-foreground">{selectedPlan.name}</strong> ({billingCycle === "yearly" ? "anual" : "mensal"})
                {billingCycle === "yearly" && selectedPlan.price_yearly ? (
                  <span className="mt-2 block">
                    Valor equivalente por mes: <strong className="text-foreground">{formatCurrency(Number(selectedPlan.price_yearly))}</strong>
                    {" "}e total cobrado no ano: <strong className="text-foreground">{formatCurrency(getYearlyTotal(selectedPlan))}</strong>
                  </span>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Nome do CT</Label>
                <Input value={form.ctName} onChange={(event) => setForm((prev) => ({ ...prev, ctName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Nome do mestre</Label>
                <Input value={form.masterName} onChange={(event) => setForm((prev) => ({ ...prev, masterName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Nome de usuario</Label>
                <Input
                  value={form.username}
                  onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value.toLowerCase() }))}
                  placeholder="mestre.ct"
                  autoComplete="username"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Minimo 8 caracteres"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar senha</Label>
                  <Input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CPF ou CNPJ</Label>
                <Input
                  inputMode="numeric"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  value={form.cpfCnpj}
                  onChange={(event) => setForm((prev) => ({ ...prev, cpfCnpj: formatCpfCnpj(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  inputMode="tel"
                  placeholder="(85) 99999-9999"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: formatPhone(event.target.value) }))}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (validateSignupFields()) {
                    setStep(2);
                  }
                }}
              >
                Continuar
              </Button>
            </div>
          )}

          {selectedPlan && step === 2 && (
            <div className="space-y-4 p-4 sm:p-6">
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, paymentMethod: "pix" }))} className={`w-full rounded-xl border p-4 text-left ${form.paymentMethod === "pix" ? "border-primary bg-primary/10" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <QrCode className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">PIX</p>
                    <p className="text-sm text-muted-foreground">Pagamento instantaneo com QR Code e copia e cola.</p>
                  </div>
                </div>
              </button>

              <button type="button" onClick={() => setForm((prev) => ({ ...prev, paymentMethod: "credit_card" }))} className={`w-full rounded-xl border p-4 text-left ${form.paymentMethod === "credit_card" ? "border-primary bg-primary/10" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Cartao de credito</p>
                    <p className="text-sm text-muted-foreground">A conclusao acontece no checkout seguro do Asaas.</p>
                  </div>
                </div>
              </button>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" className="w-full" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {submitting ? "Criando..." : "Gerar pagamento"}
                </Button>
              </div>
            </div>
          )}

          {selectedPlan && step === 3 && checkout && (
            <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.22),transparent_40%),linear-gradient(145deg,rgba(17,24,39,0.98),rgba(7,9,13,0.98))] p-4 sm:p-6 xl:border-b-0 xl:border-r">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" /> {checkoutConfig.checkout_page_badge_text}
                </div>
                <h3 className="mt-4 font-heading text-2xl uppercase leading-[0.96] text-white sm:text-3xl">
                  {checkoutConfig.checkout_page_title}
                </h3>
                <p className="mt-3 max-w-xl text-sm text-white/72">{checkoutConfig.checkout_page_subtitle}</p>

                {form.paymentMethod === "pix" ? (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:rounded-[28px] sm:p-5">
                      <div className="flex items-start gap-2 text-emerald-300">
                        <QrCode className="h-4 w-4" />
                        <p className="text-[10px] uppercase tracking-[0.24em] sm:text-xs sm:tracking-[0.3em]">{checkoutConfig.checkout_page_security_badge}</p>
                      </div>
                      <p className="mt-4 text-lg font-semibold text-white">{checkoutConfig.checkout_page_pix_title}</p>
                      <p className="mt-2 text-sm text-white/68">{checkoutConfig.checkout_page_pix_description}</p>

                      <div className="mt-5 rounded-[24px] border border-white/10 bg-black/30 p-3 text-center sm:rounded-[28px] sm:p-4">
                        {checkout.pixQrCode ? (
                          <button
                            type="button"
                            className={`mx-auto block rounded-[24px] transition-transform ${checkout.invoiceUrl ? "cursor-pointer hover:scale-[1.02]" : "cursor-default"}`}
                            onClick={() => checkout.invoiceUrl && openInvoicePage()}
                            disabled={!checkout.invoiceUrl}
                            title={checkout.invoiceUrl ? "Abrir pagina de pagamento" : undefined}
                          >
                            <img src={`data:image/png;base64,${checkout.pixQrCode}`} alt="QR Code PIX" className="mx-auto h-40 w-40 rounded-[20px] border border-white/10 bg-white p-3 sm:h-52 sm:w-52 sm:rounded-[24px] sm:p-4" />
                          </button>
                        ) : (
                          <p className="text-sm text-white/55">QR Code indisponivel no momento.</p>
                        )}
                        <p className="mt-4 text-xs text-white/52">{checkoutConfig.checkout_page_pix_hint}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/78">Copia e cola</Label>
                      <Textarea value={checkout.pixCode || ""} readOnly rows={5} className="border-white/10 bg-black/30 text-white" />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        className="h-auto min-h-10 w-full whitespace-normal break-words px-4 py-3 text-center leading-5"
                        onClick={async () => {
                          await navigator.clipboard.writeText(checkout.pixCode || "");
                          toast.success("Codigo PIX copiado.");
                        }}
                      >
                        {checkoutConfig.checkout_page_copy_button_label}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto min-h-10 w-full whitespace-normal break-words border-white/10 bg-white/5 px-4 py-3 text-center leading-5 text-white hover:bg-white/10 hover:text-white"
                        disabled={!checkout.invoiceUrl}
                        onClick={openInvoicePage}
                      >
                        {checkoutConfig.checkout_page_invoice_button_label}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:rounded-[28px] sm:p-5">
                    <div className="flex items-center gap-2 text-emerald-300">
                      <ShieldCheck className="h-4 w-4" />
                      <p className="text-[10px] uppercase tracking-[0.24em] sm:text-xs sm:tracking-[0.3em]">{checkoutConfig.checkout_page_security_badge}</p>
                    </div>
                    <p className="mt-4 text-lg font-semibold text-white">{checkoutConfig.checkout_page_card_title}</p>
                    <p className="mt-2 text-sm text-white/68">{checkoutConfig.checkout_page_card_description}</p>
                    <Button className="mt-5 w-full" disabled={!checkout.invoiceUrl} onClick={openInvoicePage}>
                      {checkoutConfig.checkout_page_invoice_button_label}
                    </Button>
                  </div>
                )}

                <p className="mt-5 text-sm text-white/55">{checkoutConfig.checkout_page_support_text}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-auto min-h-10 w-full whitespace-normal break-words border-white/10 bg-transparent px-4 py-3 text-center leading-5 text-white hover:bg-white/5 hover:text-white"
                    onClick={() => setSelectedPlan(null)}
                  >
                    {checkoutConfig.checkout_page_close_button_label}
                  </Button>
                  <Button className="h-auto min-h-10 w-full whitespace-normal break-words bg-white px-4 py-3 text-center leading-5 text-slate-950 hover:bg-white/90" onClick={() => navigate("/login")}>
                    {checkoutConfig.checkout_page_login_button_label}
                  </Button>
                </div>
              </div>

              <div
                className="flex min-h-[180px] flex-col justify-end bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] bg-cover bg-center p-4 sm:min-h-[220px] sm:p-6 xl:min-h-[260px]"
                style={{
                  backgroundImage: checkoutConfig.checkout_page_artwork_url
                    ? `linear-gradient(180deg,rgba(7,9,13,0.08),rgba(7,9,13,0.76)), url(${checkoutConfig.checkout_page_artwork_url})`
                    : undefined,
                }}
              >
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Pagamento em andamento</p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {form.paymentMethod === "pix" ? "Escaneie ou abra a pagina de pagamento" : "Continue no checkout seguro"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  {selectedPlan.name} • {billingCycle === "yearly" ? "ciclo anual" : "ciclo mensal"} • {formatCurrency(getDisplayedPrice(selectedPlan, billingCycle))}
                  {billingCycle === "yearly" && selectedPlan.price_yearly ? " por mes equivalente" : ""}
                </p>
                <p className="mt-3 text-sm leading-6 text-amber-200/90">
                  O acesso do mestre <strong>{form.username.trim().toLowerCase()}</strong> sera liberado somente apos a confirmacao do pagamento pelo Asaas.
                </p>
                <div className="mt-4 rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                  <p className="font-semibold text-emerald-200">Assim que o pagamento for confirmado, a conta e o CT sao liberados automaticamente.</p>
                  <p className="mt-2 leading-6 text-emerald-50/85">
                    Se o valor ja entrou na conta e o acesso ainda nao estiver disponivel, basta tentar o primeiro login com o usuario e a senha cadastrados.
                    O sistema faz uma nova conferencia no Asaas e conclui a liberacao automaticamente quando encontrar o pagamento confirmado.
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className={`pointer-events-none fixed bottom-5 right-5 z-40 transition-all duration-500 ${showSocialProof && socialProof ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
        <div className="w-[320px] rounded-[24px] border border-white/10 bg-slate-950/92 p-4 text-white shadow-[0_30px_70px_-40px_rgba(0,0,0,1)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Compra recente</p>
          <p className="mt-2 text-sm leading-6 text-white/78">
            <strong className="text-white">{socialProof?.name}</strong> acabou de iniciar a assinatura do plano{" "}
            <strong className="text-primary">{socialProof?.planName}</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Planos;
