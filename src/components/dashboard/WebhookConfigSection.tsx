import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Webhook,
  Mail,
  MessageCircle,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Smartphone,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSecureConfig, saveSecureConfig, type SecureConfigSecrets } from "@/services/secureConfig";
import { getAuthHeaders, getFunctionsErrorMessage } from "@/services/functions";

interface VerifyConfigPayload {
  ct_id: string;
  gmail_email?: string;
  gmail_app_password?: string;
  whatsapp_send_mode?: string;
  uazapi_base_url?: string;
  uazapi_instance_name?: string;
  uazapi_instance_apikey?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
}

interface WebhookConfigSectionProps {
  role: "admin" | "mestre" | "aluno";
  userId: string;
}

const normalizeMessagingConfigState = (values: Record<string, string>) => ({
  ...values,
  gmail_format: values.gmail_format || "html",
  whatsapp_send_mode: values.whatsapp_send_mode || "wa_me",
  mensageria_auto_notice_enabled: values.mensageria_auto_notice_enabled || "true",
});

const WebhookConfigSection = ({ role, userId }: WebhookConfigSectionProps) => {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [messagingSecrets, setMessagingSecrets] = useState<SecureConfigSecrets>({});
  const [selectedCtId, setSelectedCtId] = useState<string | null>(null);
  const [availableCts, setAvailableCts] = useState<{ id: string; nome: string }[]>([]);
  const [userCtId, setUserCtId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

  const isAdmin = role === "admin";
  const isMestre = role === "mestre";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const webhookUrls = [
    {
      name: "Asaas - Webhook de Pagamentos",
      url: `${supabaseUrl}/functions/v1/webhook-asaas`,
      description: "URL principal para conectar com o Asaas e receber notificações de pagamentos.",
      events: ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED"],
    },
  ];

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      if (isAdmin) {
        const { data: ctData, error: ctError } = await supabase
          .from("centros_treinamento")
          .select("id, nome")
          .order("nome");

        if (ctError) {
          console.error(ctError);
        } else {
          setAvailableCts(ctData || []);
          setSelectedCtId((prev) => prev ?? ctData?.[0]?.id ?? null);
        }
      }

      if (isMestre) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("ct_id")
          .eq("user_id", userId)
          .single();

        if (profileError) {
          console.error(profileError);
        }

        setUserCtId(profile?.ct_id || null);
      }
    };

    void init();
  }, [isAdmin, isMestre, userId]);

  useEffect(() => {
    void fetchConfigs();
  }, [isAdmin, isMestre, selectedCtId, userCtId]);

  const fetchConfigs = async () => {
    const targetCtId = isAdmin ? selectedCtId : isMestre ? userCtId : null;

    if (!targetCtId) {
      setConfigs({});
      setSecretInputs({});
      setMessagingSecrets({});
      setLoading(false);
      return;
    }

    try {
      const data = await getSecureConfig("messaging", targetCtId);
      setConfigs(normalizeMessagingConfigState(data.values || {}));
      setSecretInputs({});
      setMessagingSecrets(data.secrets || {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar configurações";
      toast.error(message);
      console.error(error);
      setConfigs({});
      setSecretInputs({});
      setMessagingSecrets({});
    }
    setLoading(false);
  };

  const updateConfig = (key: string, value: string) => {
    setConfigs((prev) => ({ ...prev, [key]: value }));
  };

  const updateSecretInput = (key: string, value: string) => {
    setSecretInputs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleShow = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("URL copiada!");
  };

  const getTargetCtId = () => (isAdmin ? selectedCtId : userCtId);

  const verifyConfig = async (channel: "email" | "whatsapp" | "telegram", payload: VerifyConfigPayload) => {
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke("send-message", {
      headers,
      body: {
        action: "verify_config",
        channel,
        ...payload,
      },
    });

    if (error) {
      throw new Error(await getFunctionsErrorMessage(error, "Falha ao validar a integracao."));
    }

    if (!data?.ok) {
      throw new Error(data?.error || "Falha na verificação");
    }
  };

  const testGmail = async () => {
    const targetCtId = getTargetCtId();
    const gmailAppPassword = secretInputs.gmail_app_password?.trim();
    if (!configs.gmail_email || (!gmailAppPassword && !messagingSecrets["gmail_app_password"]?.configured)) {
      toast.error("Configure o e-mail e a senha de app do Gmail primeiro");
      return;
    }
    if (!targetCtId) {
      toast.error("Selecione um CT antes de validar.");
      return;
    }

    setTestingEmail(true);
    try {
      await verifyConfig("email", {
        ct_id: targetCtId,
        gmail_email: configs.gmail_email,
        gmail_app_password: gmailAppPassword || undefined,
      });
      toast.success("Configuração do Gmail validada com sucesso.");
    } catch (error) {
      toast.error(`Erro ao validar Gmail: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setTestingEmail(false);
    }
  };

  const testWhatsapp = async () => {
    const targetCtId = getTargetCtId();
    const whatsappMode = configs.whatsapp_send_mode || "wa_me";

    if (whatsappMode === "wa_me") {
      toast.success("O modo wa.me nao precisa de credenciais para teste.");
      return;
    }

    const uazapiApiKey = secretInputs.uazapi_instance_apikey?.trim();
    if (!configs.uazapi_base_url || !configs.uazapi_instance_name || (!uazapiApiKey && !messagingSecrets["uazapi_instance_apikey"]?.configured)) {
      toast.error("Configure URL base, instancia e API key da Uazapi primeiro");
      return;
    }
    if (!targetCtId) {
      toast.error("Selecione um CT antes de validar.");
      return;
    }

    setTestingWhatsapp(true);
    try {
      await verifyConfig("whatsapp", {
        ct_id: targetCtId,
        whatsapp_send_mode: whatsappMode,
        uazapi_base_url: configs.uazapi_base_url,
        uazapi_instance_name: configs.uazapi_instance_name,
        uazapi_instance_apikey: uazapiApiKey || undefined,
      });
      toast.success("Configuração do WhatsApp validada com sucesso.");
    } catch (error) {
      toast.error(`Erro ao validar WhatsApp: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setTestingWhatsapp(false);
    }
  };

  const testTelegram = async () => {
    const targetCtId = getTargetCtId();
    const telegramBotToken = secretInputs.telegram_bot_token?.trim();
    if ((!telegramBotToken && !messagingSecrets["telegram_bot_token"]?.configured) || !configs.telegram_chat_id) {
      toast.error("Configure o Bot Token e Chat ID do Telegram primeiro");
      return;
    }
    if (!targetCtId) {
      toast.error("Selecione um CT antes de validar.");
      return;
    }

    setTestingTelegram(true);
    try {
      await verifyConfig("telegram", {
        ct_id: targetCtId,
        telegram_bot_token: telegramBotToken || undefined,
        telegram_chat_id: configs.telegram_chat_id,
      });
      toast.success("Configuração do Telegram validada com sucesso.");
    } catch (error) {
      toast.error(`Erro ao validar Telegram: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const targetCtId = isAdmin ? selectedCtId : userCtId;
    if (!targetCtId) {
      toast.error("Selecione um CT antes de salvar.");
      setSaving(false);
      return;
    }

    try {
      const result = await saveSecureConfig("messaging", { ...configs, ...secretInputs }, targetCtId);
      setConfigs(normalizeMessagingConfigState(result.values || {}));
      setMessagingSecrets(result.secrets || {});
      setSecretInputs({});
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar configurações");
      console.error(error);
    }
    setSaving(false);
  };

  const SecretField = ({
    label,
    configKey,
    placeholder,
  }: {
    label: string;
    configKey: string;
    placeholder: string;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-foreground text-sm">{label}</Label>
      <div className="relative">
        <Input
          type={showKeys[configKey] ? "text" : "password"}
          value={secretInputs[configKey] || ""}
          onChange={(e) => updateSecretInput(configKey, e.target.value)}
          placeholder={messagingSecrets[configKey]?.configured ? "Ja configurado. Preencha para substituir" : placeholder}
          className="bg-secondary border-border pr-10"
        />
        <button
          type="button"
          onClick={() => toggleShow(configKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showKeys[configKey] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {messagingSecrets[configKey]?.configured && !secretInputs[configKey] && (
        <p className="text-xs text-muted-foreground">Atual: {messagingSecrets[configKey]?.maskedValue}</p>
      )}
    </div>
  );

  if (loading) {
    return <div className="text-muted-foreground animate-pulse">Carregando configurações...</div>;
  }

  return (
    <div className="mx-auto w-full space-y-6 px-4 sm:max-w-5xl sm:px-0">
      <div className="mx-auto flex w-full max-w-[340px] flex-col items-center gap-3 text-center sm:max-w-none sm:flex-row sm:text-left">
        <Webhook className="h-6 w-6 text-primary" />
        <h2 className="font-heading text-2xl uppercase text-foreground">Configuração de Integrações</h2>
      </div>
      <p className="mx-auto w-full max-w-[340px] text-center text-sm text-muted-foreground sm:max-w-2xl sm:mx-0 sm:text-left">
        Configure credenciais de integração e gerencie os endpoints de webhook do sistema.
      </p>
      <div className="rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        Campos secretos desta tela sao gravados somente pela edge function `secure-config` e pelo cofre seguro do projeto. Eles nao voltam mais para `webhook_config`.
      </div>

      {isAdmin && (
        <div className="mx-auto flex w-full max-w-[340px] flex-col items-center gap-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
          <Label className="text-foreground text-sm">CT:</Label>
          <select
            value={selectedCtId || ""}
            onChange={(e) => setSelectedCtId(e.target.value || null)}
            className="h-10 w-full rounded-xl border border-border bg-secondary px-3 text-sm text-foreground sm:h-9 sm:w-[220px] sm:rounded-md"
          >
            {availableCts.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {isMestre && !userCtId && (
        <div className="text-sm text-red-500">Não foi possível determinar o CT do mestre.</div>
      )}

      <Tabs defaultValue="credenciais" className="mx-auto w-full sm:max-w-none">
        <TabsList className={`mx-auto mb-6 grid h-auto w-full max-w-[340px] gap-2 rounded-2xl bg-secondary/60 p-1 sm:max-w-md sm:rounded-lg ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
          <TabsTrigger value="credenciais" className="w-full justify-center rounded-xl sm:rounded-md">Credenciais</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="webhooks" className="w-full justify-center rounded-xl sm:rounded-md">
              <Link2 className="h-4 w-4 mr-1" /> Webhooks
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="credenciais" className="mx-auto w-full sm:max-w-none">
          <div className="mx-auto grid w-full gap-6 sm:max-w-none xl:grid-cols-3">
            <Card className="mx-auto w-full max-w-full bg-card border-border sm:max-w-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Mail className="h-5 w-5 text-primary" />
                  E-mail (Gmail)
                </CardTitle>
                <CardDescription>
                  Configure com uma <strong>Senha de App</strong> do Google. Acesse{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    myaccount.google.com/apppasswords
                  </a>{" "}
                  para gerar uma.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">E-mail do Gmail</Label>
                  <Input
                    value={configs.gmail_email || ""}
                    onChange={(e) => updateConfig("gmail_email", e.target.value)}
                    placeholder="seuemail@gmail.com"
                    className="bg-secondary border-border"
                  />
                </div>
                <SecretField label="Senha de App" configKey="gmail_app_password" placeholder="xxxx xxxx xxxx xxxx" />
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Nome do Remetente</Label>
                  <Input
                    value={configs.gmail_from_name || ""}
                    onChange={(e) => updateConfig("gmail_from_name", e.target.value)}
                    placeholder="Sistema BJJ"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Formato do E-mail</Label>
                  <select
                    value={configs.gmail_format || "html"}
                    onChange={(e) => updateConfig("gmail_format", e.target.value)}
                    className="bg-secondary border-border rounded p-2 text-sm w-full"
                  >
                    <option value="text">Texto puro</option>
                    <option value="html">HTML (Recomendado)</option>
                  </select>
                </div>
                <Button variant="outline" size="sm" onClick={testGmail} disabled={testingEmail} className="gap-2">
                  {testingEmail ? "Verificando..." : "Verificar Configuração"}
                  {!testingEmail && <CheckCircle2 className="h-3.5 w-3.5" />}
                </Button>
              </CardContent>
            </Card>

            <Card className="mx-auto w-full max-w-full bg-card border-border sm:max-w-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Smartphone className="h-5 w-5 text-primary" />
                  WhatsApp
                </CardTitle>
                <CardDescription>Escolha entre abertura via wa.me ou envio automatizado pela Uazapi.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Modo de envio</Label>
                  <select
                    value={configs.whatsapp_send_mode || "wa_me"}
                    onChange={(e) => updateConfig("whatsapp_send_mode", e.target.value)}
                    className="w-full rounded-md border border-border bg-secondary p-2 text-sm text-foreground"
                  >
                    <option value="wa_me">wa.me (abre conversas no navegador)</option>
                    <option value="uazapi">Uazapi (envio automatizado)</option>
                  </select>
                </div>
                {(configs.whatsapp_send_mode || "wa_me") === "wa_me" ? (
                  <div className="rounded-xl border border-border/70 bg-secondary/30 p-3 text-sm text-muted-foreground">
                    O modo wa.me abre cada conversa individualmente no navegador do usuario. Nenhuma credencial adicional e necessaria.
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-foreground text-sm">URL base da Uazapi</Label>
                      <Input
                        value={configs.uazapi_base_url || ""}
                        onChange={(e) => updateConfig("uazapi_base_url", e.target.value)}
                        placeholder="https://server02.uazapi.dev"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground text-sm">Nome da instância</Label>
                      <Input
                        value={configs.uazapi_instance_name || ""}
                        onChange={(e) => updateConfig("uazapi_instance_name", e.target.value)}
                        placeholder="nome-da-instancia"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <SecretField label="API Key da instância" configKey="uazapi_instance_apikey" placeholder="API key da instancia" />
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testWhatsapp}
                  disabled={testingWhatsapp}
                  className="gap-2"
                >
                  {testingWhatsapp
                    ? "Verificando..."
                    : (configs.whatsapp_send_mode || "wa_me") === "uazapi"
                      ? "Testar Credenciais da API"
                      : "Verificar Configuração"}
                  {!testingWhatsapp && <CheckCircle2 className="h-3.5 w-3.5" />}
                </Button>
              </CardContent>
            </Card>

            <Card className="mx-auto w-full max-w-full bg-card border-border sm:max-w-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  Telegram (Bot)
                </CardTitle>
                <CardDescription>Configure um bot do Telegram para envio de mensagens.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <SecretField label="Bot Token" configKey="telegram_bot_token" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" />
                  <p className="text-xs text-muted-foreground">
                    Obtenha em{" "}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      @BotFather
                    </a>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Chat ID</Label>
                  <Input
                    value={configs.telegram_chat_id || ""}
                    onChange={(e) => updateConfig("telegram_chat_id", e.target.value)}
                    placeholder="-1001234567890"
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground">ID do chat/grupo onde as mensagens serão enviadas.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testTelegram}
                  disabled={testingTelegram}
                  className="gap-2"
                >
                  {testingTelegram ? "Testando..." : "Testar Conexão"}
                  {!testingTelegram && <CheckCircle2 className="h-3.5 w-3.5" />}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex w-full justify-stretch sm:justify-end">
            <Button onClick={handleSave} disabled={saving} className="h-11 w-full gap-2 rounded-xl sm:h-10 sm:w-auto sm:rounded-md">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </TabsContent>

        {isAdmin && (
        <TabsContent value="webhooks" className="mx-auto w-full sm:max-w-none">
          <div className="mx-auto grid w-full max-w-[340px] gap-6 sm:max-w-none">
            <div className="w-full space-y-1.5">
              <p className="text-foreground text-sm font-medium">URL principal para conectar com sistemas externos</p>
              <p className="text-xs text-muted-foreground">
                Configure o endpoint principal com o mesmo padrão visual da aba de credenciais.
              </p>
            </div>

            <div className="mx-auto grid w-full max-w-[340px] gap-6 sm:max-w-none">
              {webhookUrls.map((wh) => (
                <Card key={wh.name} className="mx-auto w-full max-w-[340px] bg-card border-border border-primary/20 sm:max-w-none">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="font-heading text-foreground text-sm uppercase tracking-wide">
                        {wh.name}
                      </CardTitle>
                      <Badge variant="default" className="text-[10px] bg-primary">
                        Essencial
                      </Badge>
                    </div>
                    <CardDescription>{wh.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-foreground text-sm">URL do webhook</Label>
                      <code className="block w-full overflow-x-auto rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground">
                        {wh.url}
                      </code>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground text-sm">Ações rápidas</Label>
                      <Button
                        variant="outline"
                        className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md"
                        onClick={() => copyToClipboard(wh.url)}
                      >
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Copiar URL
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground text-sm">Eventos</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {wh.events.map((ev) => (
                          <Badge key={ev} variant="outline" className="text-[10px] font-mono">
                            {ev}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mx-auto w-full max-w-[340px] bg-card border-border sm:max-w-none">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-heading text-foreground text-sm uppercase tracking-wide">Como configurar no Asaas</h3>
                    <ol className="text-muted-foreground text-xs mt-2 space-y-1 list-decimal list-inside">
                      <li>Acesse o painel Asaas - <strong>Configurações</strong> - <strong>Integrações</strong> - <strong>Webhooks</strong></li>
                      <li>Clique em <strong>"Adicionar webhook"</strong></li>
                      <li>Cole a URL acima</li>
                      <li>Selecione os eventos desejados e salve</li>
                      <li>Teste a conexão no painel do Asaas</li>
                    </ol>
                    <p className="text-muted-foreground text-xs mt-4 italic">
                      Os outros endpoints do sistema são usados internamente e não precisam de configuração externa.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default WebhookConfigSection;




