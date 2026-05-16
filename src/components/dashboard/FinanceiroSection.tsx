import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, DollarSign, FileText, Send, Loader2, Eye, UserPlus, CheckCircle2, XCircle, FileWarning } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { getSecureConfig, saveSecureConfig } from "@/services/secureConfig";

interface FinanceiroSectionProps {
  ctId: string;
  role: "admin" | "mestre";
  userId: string;
}

interface Plano {
  id: string;
  nome: string;
  valor: number;
  descricao: string | null;
  periodicidade: string;
  ativo: boolean;
}

interface Cobranca {
  id: string;
  aluno_id: string;
  valor: number;
  data_vencimento: string;
  status: string;
  asaas_boleto_url: string | null;
  asaas_pix_copia_cola: string | null;
  created_at: string;
  pago_em: string | null;
  payment_method: string | null;
  rejection_reason: string | null;
  confirmed_at: string | null;
  aluno_nome?: string;
}

interface AlunoPlano {
  id: string;
  aluno_id: string;
  plano_id: string;
  dia_vencimento: number;
  ativo: boolean;
  payment_status?: string;
  valor_override?: number | null;
  aluno_nome?: string;
  plano_nome?: string;
  plano_valor?: number;
}

interface PaymentReceipt {
  id: string;
  cobranca_id: string;
  aluno_id: string;
  ct_id: string;
  storage_path: string;
  review_status: string;
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  aluno_nome?: string;
}

const FinanceiroSection = ({ ctId, role, userId }: FinanceiroSectionProps) => {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [alunoPlanos, setAlunoPlanos] = useState<AlunoPlano[]>([]);
  const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceipt[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; nome: string; sobrenome?: string; email?: string; telefone?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessChecked, setAccessChecked] = useState(role === "admin");
  const [accessAllowed, setAccessAllowed] = useState(role === "admin");

  // Plano form
  const [planoDialogOpen, setPlanoDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [planoNome, setPlanoNome] = useState("");
  const [planoValor, setPlanoValor] = useState("");
  const [planoDescricao, setPlanoDescricao] = useState("");
  const [planoPeriodicidade, setPlanoPeriodicidade] = useState("mensal");
  const [saving, setSaving] = useState(false);

  // Associar aluno
  const [associarDialogOpen, setAssociarDialogOpen] = useState(false);
  const [selectedAlunoId, setSelectedAlunoId] = useState("");
  const [selectedPlanoId, setSelectedPlanoId] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("10");

  // Config pagamento
  const [configMap, setConfigMap] = useState<Record<string, string>>({});
  const [configSaving, setConfigSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saldoInterno, setSaldoInterno] = useState<number | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState("planos");

  // Bulk selection
  const [selectedCobrancas, setSelectedCobrancas] = useState<Set<string>>(new Set());
  const [reviewingReceiptId, setReviewingReceiptId] = useState<string | null>(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState("");
  const [previewReceiptOpen, setPreviewReceiptOpen] = useState(false);
  const [previewReceiptLoading, setPreviewReceiptLoading] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Cobrança manual
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualAlunoId, setManualAlunoId] = useState("");
  const [manualValor, setManualValor] = useState("");
  const [manualDescricao, setManualDescricao] = useState("");
  const [manualVencimento, setManualVencimento] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [manualNotifyEmail, setManualNotifyEmail] = useState(true);
  const [manualNotifyWts, setManualNotifyWts] = useState(true);
  const [manualEmail, setManualEmail] = useState("");
  const [manualTelefone, setManualTelefone] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  // Template cobrança
  const [templateTitulo, setTemplateTitulo] = useState("Cobrança de Mensalidade");
  const [templateMensagem, setTemplateMensagem] = useState(
    "Olá {nome}, sua mensalidade de R$ {valor} vence em {data_vencimento}.\n\nPIX: {chave_pix}"
  );

  useEffect(() => {
    let active = true;

    const validateAccess = async () => {
      if (role === "admin") {
        if (!active) return;
        setAccessAllowed(true);
        setAccessChecked(true);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("ct_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Erro ao validar acesso ao financeiro do CT:", error);
        toast.error("Nao foi possivel validar o acesso ao financeiro deste CT.");
        setAccessAllowed(false);
        setAccessChecked(true);
        setLoading(false);
        return;
      }

      let allowed = profile?.ct_id === ctId;

      if (allowed) {
        const { data: ctData, error: ctError } = await supabase
          .from("centros_treinamento")
          .select("mestre_lider_id")
          .eq("id", ctId)
          .maybeSingle();

        if (ctError) {
          console.error("Erro ao validar responsavel do financeiro do CT:", ctError);
          toast.error("Nao foi possivel validar o responsavel financeiro deste CT.");
          setAccessAllowed(false);
          setAccessChecked(true);
          setLoading(false);
          return;
        }

        allowed = ctData?.mestre_lider_id === userId;
      }

      if (!allowed) {
        toast.error("Apenas o mestre responsavel por este CT pode acessar o financeiro.");
        setLoading(false);
      }

      setAccessAllowed(allowed);
      setAccessChecked(true);
    };

    void validateAccess();

    return () => {
      active = false;
    };
  }, [ctId, role, userId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [planosRes, cobrancasRes, alunosPlanosRes, profilesRes, receiptsRes, secureConfig] = await Promise.all([
        supabase.from("planos_mensalidade").select("*").eq("ct_id", ctId).order("nome"),
        supabase.from("cobrancas").select("*").eq("ct_id", ctId).order("data_vencimento", { ascending: false }).limit(100),
        supabase.from("aluno_planos").select("*").eq("ct_id", ctId),
        supabase.from("profiles").select("user_id, nome, sobrenome, email, telefone").eq("ct_id", ctId),
        supabase.from("payment_receipts").select("*").eq("ct_id", ctId).order("created_at", { ascending: false }).limit(100),
        getSecureConfig("payment", ctId),
      ]);

      if (planosRes.error) throw planosRes.error;
      if (cobrancasRes.error) throw cobrancasRes.error;
      if (alunosPlanosRes.error) throw alunosPlanosRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (receiptsRes.error) throw receiptsRes.error;

      setPlanos((planosRes.data as any[]) || []);

      const profs = profilesRes.data || [];
      setProfiles(profs);

      const cobData = (cobrancasRes.data as any[]) || [];
      const enrichedCob = cobData.map(c => ({
        ...c,
        aluno_nome: profs.find(p => p.user_id === c.aluno_id)?.nome || "?",
      }));
      setCobrancas(enrichedCob);

      const apData = (alunosPlanosRes.data as any[]) || [];
      const planosList = (planosRes.data as any[]) || [];
      const enrichedAp = apData.map(ap => ({
        ...ap,
        aluno_nome: profs.find(p => p.user_id === ap.aluno_id)?.nome || "?",
        plano_nome: planosList.find(pl => pl.id === ap.plano_id)?.nome || "?",
        plano_valor: planosList.find(pl => pl.id === ap.plano_id)?.valor || 0,
      }));
      setAlunoPlanos(enrichedAp);

      const receiptData = (receiptsRes.data as any[]) || [];
      const enrichedReceipts = receiptData.map((receipt) => ({
        ...receipt,
        aluno_nome: profs.find((p) => p.user_id === receipt.aluno_id)?.nome || "?",
      }));
      setPaymentReceipts(enrichedReceipts);

      const cfgMap: Record<string, string> = { ...(secureConfig.values || {}) };
      setConfigMap(cfgMap);
      if (cfgMap["template_titulo"]) setTemplateTitulo(cfgMap["template_titulo"]);
      if (cfgMap["template_mensagem"]) setTemplateMensagem(cfgMap["template_mensagem"]);
    } catch (error) {
      console.error("Erro ao carregar financeiro do CT:", error);
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar o financeiro deste CT.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch saldo interno from financeiro table
  const fetchSaldoInterno = async () => {
    const { data } = await supabase
      .from("financeiro")
      .select("saldo")
      .eq("ct_id", ctId)
      .single();
    setSaldoInterno(data ? Number(data.saldo) : 0);
  };

  useEffect(() => {
    if (!accessChecked || !accessAllowed) return;
    fetchAll();
    fetchSaldoInterno();
  }, [accessAllowed, accessChecked, ctId]);

  // Realtime subscription for financeiro saldo
  useEffect(() => {
    if (!accessAllowed) return;
    const channel = supabase
      .channel('financeiro-saldo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financeiro', filter: `ct_id=eq.${ctId}` },
        () => { fetchSaldoInterno(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [accessAllowed, ctId]);

  useEffect(() => {
    if (!accessAllowed) return;
    const channel = supabase
      .channel(`financeiro-cobrancas-${ctId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cobrancas", filter: `ct_id=eq.${ctId}` },
        () => { void fetchAll(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_receipts", filter: `ct_id=eq.${ctId}` },
        () => { void fetchAll(); },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [accessAllowed, ctId]);

  const getActorId = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  };

  // PLANO CRUD
  const openPlanoForm = (plano?: Plano) => {
    if (plano) {
      setEditingPlano(plano);
      setPlanoNome(plano.nome);
      setPlanoValor(String(plano.valor));
      setPlanoDescricao(plano.descricao || "");
      setPlanoPeriodicidade(plano.periodicidade);
    } else {
      setEditingPlano(null);
      setPlanoNome("");
      setPlanoValor("");
      setPlanoDescricao("");
      setPlanoPeriodicidade("mensal");
    }
    setPlanoDialogOpen(true);
  };

  const handleSavePlano = async () => {
    if (!planoNome.trim() || !planoValor.trim()) return;
    setSaving(true);
    const valor = parseFloat(planoValor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { toast.error("Valor inválido"); setSaving(false); return; }

    if (editingPlano) {
      const { error } = await supabase.from("planos_mensalidade").update({
        nome: planoNome.trim(), valor, descricao: planoDescricao.trim() || null, periodicidade: planoPeriodicidade,
      }).eq("id", editingPlano.id);
      if (error) toast.error("Erro ao atualizar plano");
      else toast.success("Plano atualizado");
    } else {
      const actorId = await getActorId();
      if (!actorId) {
        toast.error("Sessão expirada. Faça login novamente.");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("planos_mensalidade").insert({
        ct_id: ctId, nome: planoNome.trim(), valor, descricao: planoDescricao.trim() || null,
        periodicidade: planoPeriodicidade, created_by: actorId,
      });
      if (error) toast.error(error.message || "Erro ao criar plano");
      else toast.success("Plano criado");
    }
    setSaving(false);
    setPlanoDialogOpen(false);
    fetchAll();
  };

  const handleDeletePlano = async (id: string) => {
    const { error } = await supabase.from("planos_mensalidade").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir plano");
    else { toast.success("Plano excluído"); fetchAll(); }
  };

  const handleTogglePlano = async (plano: Plano) => {
    await supabase.from("planos_mensalidade").update({ ativo: !plano.ativo }).eq("id", plano.id);
    fetchAll();
  };

  // ASSOCIAR ALUNO A PLANO
  const handleAssociar = async () => {
    if (!selectedAlunoId || !selectedPlanoId) return;
    const dia = parseInt(diaVencimento);
    if (isNaN(dia) || dia < 1 || dia > 28) { toast.error("Dia de vencimento inválido (1-28)"); return; }

    const { error } = await supabase.from("aluno_planos").insert({
      aluno_id: selectedAlunoId, plano_id: selectedPlanoId, ct_id: ctId, dia_vencimento: dia,
    });
    if (error) toast.error(error.message);
    else { toast.success("Aluno associado ao plano"); setAssociarDialogOpen(false); fetchAll(); }
  };

  const handleRemoveAssociacao = async (id: string) => {
    await supabase.from("aluno_planos").delete().eq("id", id);
    toast.success("Associação removida");
    fetchAll();
  };

  // CONFIG PAGAMENTO
  const persistConfigs = async (
    entries: Array<{ key: string; value: string }>,
    successMessage?: string,
  ) => {
    setConfigSaving(true);

    try {
      const payload = entries.reduce<Record<string, string>>((acc, entry) => {
        acc[entry.key] = entry.value;
        return acc;
      }, {});
      const result = await saveSecureConfig("payment", payload, ctId);
      setConfigMap(result.values);
      if (result.values["template_titulo"]) setTemplateTitulo(result.values["template_titulo"]);
      if (result.values["template_mensagem"]) setTemplateMensagem(result.values["template_mensagem"]);

      if (successMessage) toast.success(successMessage);
      return true;
    } catch (err) {
      console.error("Erro inesperado ao salvar configurações:", err);
      toast.error("Erro ao salvar configuração");
      return false;
    } finally {
      setConfigSaving(false);
    }
  };

  const savePixConfig = async () => {
    const pixChave = (configMap["pix_chave"] || "").trim();
    const pixBeneficiario = (configMap["pix_beneficiario"] || "").trim();

    if (!pixChave) {
      toast.error("Informe a chave PIX");
      return;
    }

    if (!pixBeneficiario) {
      toast.error("Informe o nome do beneficiário");
      return;
    }

    await persistConfigs(
      [
        { key: "recebimento_modo", value: "pix_manual" },
        { key: "pix_tipo", value: configMap["pix_tipo"] || "cpf" },
        { key: "pix_chave", value: pixChave },
        { key: "pix_beneficiario", value: pixBeneficiario },
        { key: "pix_banco_nome", value: configMap["pix_banco_nome"] || "" },
      ],
      "Dados PIX salvos"
    );
  };

  const saveTemplate = async () => {
    await persistConfigs(
      [
        { key: "template_titulo", value: templateTitulo },
        { key: "template_mensagem", value: templateMensagem },
      ],
      "Template de cobrança salvo"
    );
  };

  // GERAR COBRAN?AS
  const handleGerarCobrancas = async () => {
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast.error("Sessão expirada"); setGenerating(false); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gerar-cobrancas`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ct_id: ctId }),
        }
      );
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Erro ao gerar cobranças"); }
      else {
        const geradas = data.results?.filter((r: any) => r.status === "gerada").length || 0;
        const existentes = data.results?.filter((r: any) => r.status?.includes("já existe")).length || 0;
        toast.success(`${geradas} cobrança(s) gerada(s)${existentes ? `, ${existentes} já existente(s)` : ""}`);
        fetchAll();
      }
    } catch (err) {
      toast.error("Erro ao gerar cobranças");
    }
    setGenerating(false);
  };

  // OPEN MANUAL CHARGE DIALOG
  const openManualDialog = () => {
    setManualAlunoId("");
    setManualValor("");
    setManualDescricao("");
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setManualVencimento(d.toISOString().slice(0, 10));
    setManualNotifyEmail(true);
    setManualNotifyWts(true);
    setManualEmail("");
    setManualTelefone("");
    setManualDialogOpen(true);
  };

  // Pre-fill email/phone when aluno is selected
  const handleManualAlunoChange = (alunoId: string) => {
    setManualAlunoId(alunoId);
    const prof = profiles.find(p => p.user_id === alunoId) as any;
    if (prof) {
      setManualEmail(prof.email || "");
      setManualTelefone(prof.telefone || "");
    }
  };

  // CREATE MANUAL CHARGE
  const handleCriarCobrancaManual = async () => {
    if (!manualAlunoId) { toast.error("Selecione um aluno"); return; }
    const valor = parseFloat(manualValor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { toast.error("Valor inválido"); return; }
    if (!manualVencimento) { toast.error("Informe a data de vencimento"); return; }

    setSavingManual(true);
    try {
      const actorId = await getActorId();
      if (!actorId) { toast.error("Sessão expirada"); setSavingManual(false); return; }

      // Insert cobrança directly
      const { error: insertErr } = await supabase.from("cobrancas").insert({
        aluno_id: manualAlunoId,
        ct_id: ctId,
        valor,
        data_vencimento: manualVencimento,
        status: "pendente",
      });

      if (insertErr) {
        toast.error(insertErr.message || "Erro ao criar cobrança");
        setSavingManual(false);
        return;
      }

      // Send notification if requested
      const channels: string[] = [];
      if (manualNotifyEmail && manualEmail.trim()) channels.push("email");
      if (manualNotifyWts && manualTelefone.trim()) channels.push("whatsapp");

      if (channels.length > 0) {
        const prof = profiles.find(p => p.user_id === manualAlunoId);
        const nomeAluno = prof?.nome || "Aluno";
        const chavePix = configMap["pix_chave"] || "";
        const msg = templateMensagem
          .replace(/{nome}/g, nomeAluno)
          .replace(/{valor}/g, valor.toFixed(2).replace(".", ","))
          .replace(/{data_vencimento}/g, new Date(manualVencimento + "T12:00:00").toLocaleDateString("pt-BR"))
          .replace(/{chave_pix}/g, chavePix)
          .replace(/{link_boleto}/g, "");

        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-message`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                ct_id: ctId,
                titulo: templateTitulo,
                conteudo: `<p>${msg.replace(/\n/g, "<br>")}</p>`,
                conteudo_texto: msg,
                channels,
                recipients: [{
                  nome: nomeAluno,
                  sobrenome: (prof as any)?.sobrenome || "",
                  email: manualNotifyEmail ? manualEmail.trim() : undefined,
                  telefone: manualNotifyWts ? manualTelefone.trim() : undefined,
                }],
              }),
            });
            toast.success("Cobrança criada e notificação enviada!");
          } else {
            toast.success("Cobrança criada, mas não foi possível enviar notificação (sessão expirada)");
          }
        } catch {
          toast.success("Cobrança criada, mas erro ao enviar notificação");
        }
      } else {
        toast.success("Cobrança criada com sucesso!");
      }

      setManualDialogOpen(false);
      fetchAll();
    } catch (err) {
      toast.error("Erro ao criar cobrança");
    }
    setSavingManual(false);
  };

  // STATUS BADGE
  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pendente: { label: "Pendente", variant: "outline" },
      aguardando_confirmacao: { label: "Aguardando confirmação", variant: "secondary" },
      rejeitado: { label: "Rejeitado", variant: "destructive" },
      pago: { label: "Pago", variant: "default" },
      vencido: { label: "Vencido", variant: "destructive" },
      cancelado: { label: "Cancelado", variant: "secondary" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const paymentMethodLabel = (value: string | null) => {
    const labels: Record<string, string> = {
      pix: "PIX",
      dinheiro: "Dinheiro",
      transferencia: "Transferência",
      boleto: "Boleto",
      cartao: "Cartão",
    };

    if (!value) return "?";
    return labels[value] || value;
  };

  const openReceiptPreview = async (receipt: PaymentReceipt) => {
    setSelectedReceipt(receipt);
    setPreviewReceiptLoading(true);
    setPreviewReceiptOpen(true);
    setPreviewReceiptUrl("");

    try {
      const { data, error } = await supabase.storage
        .from("payment-receipts")
        .createSignedUrl(receipt.storage_path, 3600);

      if (error || !data?.signedUrl) {
        toast.error("Não foi possível abrir o comprovante.");
        setPreviewReceiptOpen(false);
        return;
      }

      setPreviewReceiptUrl(data.signedUrl);
    } finally {
      setPreviewReceiptLoading(false);
    }
  };

  const handleReviewReceipt = async (receipt: PaymentReceipt, action: "approve" | "reject", reason?: string) => {
    setReviewingReceiptId(receipt.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-payment-receipt`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt_id: receipt.id,
            action,
            rejection_reason: reason,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error || "Não foi possível revisar o comprovante.");
        return;
      }

      toast.success(action === "approve" ? "Pagamento aprovado." : "Comprovante rejeitado.");
      setRejectionDialogOpen(false);
      setRejectionReason("");
      setSelectedReceipt(null);
      await fetchAll();
      await fetchSaldoInterno();
    } catch (error) {
      console.error("Erro ao revisar comprovante:", error);
      toast.error("Erro ao revisar comprovante.");
    } finally {
      setReviewingReceiptId(null);
    }
  };

  if (!accessChecked) return <div className="text-muted-foreground text-center py-8">Validando acesso ao financeiro...</div>;
  if (!accessAllowed) return <div className="text-muted-foreground text-center py-8">Acesso restrito ao financeiro deste CT.</div>;
  if (loading) return <div className="text-muted-foreground text-center py-8">Carregando financeiro...</div>;

  const alunosComPlano = new Set(alunoPlanos.filter(ap => ap.ativo).map(ap => ap.aluno_id));
  const pendingReceipts = paymentReceipts.filter((receipt) => receipt.review_status === "pending");
  const receiptsByCharge = Object.fromEntries(paymentReceipts.map((receipt) => [receipt.cobranca_id, receipt]));
  const cobrancasComReceipts = cobrancas.map((cobranca) => ({
    ...cobranca,
    receipt: receiptsByCharge[cobranca.id] as PaymentReceipt | undefined,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h2 className="flex items-center gap-2 text-center font-heading text-2xl uppercase text-foreground sm:text-left">
        <DollarSign className="h-6 w-6" /> Financeiro
      </h2>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-[20px] bg-secondary/60 p-1 sm:max-w-2xl sm:grid-cols-4">
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="alunos">Alunos</TabsTrigger>
          <TabsTrigger value="cobrancas">Cobranças</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        {/* PLANOS TAB */}
        <TabsContent value="planos" className="space-y-4">
          <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <p className="text-muted-foreground text-sm">Gerencie os planos de mensalidade do CT</p>
            <Button size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => openPlanoForm()}><Plus className="h-4 w-4 mr-1" /> Novo Plano</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {planos.map(plano => (
              <Card key={plano.id} className={`rounded-[24px] border-border/80 bg-card/80 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-lg ${!plano.ativo ? "opacity-50" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <CardTitle className="text-lg">{plano.nome}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl sm:h-7 sm:w-7 sm:rounded-md" onClick={() => openPlanoForm(plano)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:text-destructive sm:h-7 sm:w-7 sm:rounded-md">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir plano</AlertDialogTitle>
                            <AlertDialogDescription>Tem certeza? Isso removerá o plano e todas as associações.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePlano(plano.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">R$ {Number(plano.valor).toFixed(2).replace(".", ",")}</p>
                  <p className="text-xs text-muted-foreground capitalize">{plano.periodicidade}</p>
                  {plano.descricao && <p className="text-sm text-muted-foreground mt-2">{plano.descricao}</p>}
                  <div className="flex items-center gap-2 mt-3">
                    <Switch checked={plano.ativo} onCheckedChange={() => handleTogglePlano(plano)} />
                    <span className="text-xs text-muted-foreground">{plano.ativo ? "Ativo" : "Inativo"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {planos.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">Nenhum plano cadastrado</p>}
          </div>
        </TabsContent>

        {/* ALUNOS TAB */}
        <TabsContent value="alunos" className="space-y-4">
          <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <p className="text-muted-foreground text-sm">Associe alunos a planos de mensalidade</p>
            <Button size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => { setSelectedAlunoId(""); setSelectedPlanoId(""); setDiaVencimento("10"); setAssociarDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Associar Aluno
            </Button>
          </div>

          <div className="overflow-x-auto rounded-[20px] border sm:rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Aluno</th>
                  <th className="text-left p-3 font-medium">Plano</th>
                  <th className="text-left p-3 font-medium">Valor</th>
                  <th className="text-left p-3 font-medium">Dia Venc.</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {alunoPlanos.map(ap => (
                  <tr key={ap.id} className="border-b">
                    <td className="p-3">{ap.aluno_nome}</td>
                    <td className="p-3">{ap.plano_nome}</td>
                    <td className="p-3">R$ {Number(ap.plano_valor || 0).toFixed(2).replace(".", ",")}</td>
                    <td className="p-3">Dia {ap.dia_vencimento}</td>
                    <td className="p-3"><Badge variant={ap.ativo ? "default" : "secondary"}>{ap.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-3">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:text-destructive sm:h-7 sm:w-7 sm:rounded-md"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover associação</AlertDialogTitle>
                            <AlertDialogDescription>Deseja remover este aluno do plano?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRemoveAssociacao(ap.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
                {alunoPlanos.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum aluno associado a planos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* COBRAN?AS TAB */}
        <TabsContent value="cobrancas" className="space-y-4">
          <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:flex-wrap sm:text-left">
            <p className="text-muted-foreground text-sm">Histórico de cobranças geradas</p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              {selectedCobrancas.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md">
                      <Trash2 className="h-4 w-4 mr-1" /> Excluir selecionadas ({selectedCobrancas.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir {selectedCobrancas.size} cobrança(s)?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                        const ids = Array.from(selectedCobrancas);
                        const { error } = await supabase.from("cobrancas").delete().in("id", ids);
                        if (error) toast.error("Erro ao excluir cobranças");
                        else { toast.success(`${ids.length} cobrança(s) excluída(s)`); setSelectedCobrancas(new Set()); fetchAll(); }
                      }}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {cobrancas.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-11 w-full rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 sm:h-9 sm:w-auto sm:rounded-md">
                      <Trash2 className="h-4 w-4 mr-1" /> Apagar Todas
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apagar TODAS as {cobrancas.length} cobranças?</AlertDialogTitle>
                      <AlertDialogDescription>Todas as cobranças serão removidas permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                        const { error } = await supabase.from("cobrancas").delete().eq("ct_id", ctId);
                        if (error) toast.error("Erro ao excluir cobranças");
                        else { toast.success("Todas as cobranças excluídas"); setSelectedCobrancas(new Set()); fetchAll(); }
                      }}>Apagar Todas</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button size="sm" variant="outline" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={openManualDialog}>
                <UserPlus className="h-4 w-4 mr-1" /> Cobrança Manual
              </Button>
              <Button size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={handleGerarCobrancas} disabled={generating || alunoPlanos.length === 0}>
                {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                {generating ? "Gerando..." : "Gerar Cobranças do Mês"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <Card className="rounded-[24px] border-green-500/30 bg-card/80 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-lg">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Saldo Recebido</p>
                <p className="text-2xl font-bold text-green-600">
                  {saldoInterno !== null ? `R$ ${saldoInterno.toFixed(2).replace(".", ",")}` : "?"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Atualizado em tempo real</p>
              </CardContent>
            </Card>
            <Card className="rounded-[24px] border-border/80 bg-card/80 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-lg">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-500">{cobrancas.filter(c => c.status === "pendente").length}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[24px] border-border/80 bg-card/80 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-lg">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Em revisão</p>
                <p className="text-2xl font-bold text-amber-500">{cobrancas.filter(c => c.status === "aguardando_confirmacao").length}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[24px] border-border/80 bg-card/80 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-lg">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Pagas</p>
                <p className="text-2xl font-bold text-green-500">{cobrancas.filter(c => c.status === "pago").length}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[24px] border-border/80 bg-card/80 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-lg">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Rejeitadas</p>
                <p className="text-2xl font-bold text-destructive">{cobrancas.filter(c => c.status === "rejeitado").length}</p>
              </CardContent>
            </Card>
          </div>

          {pendingReceipts.length > 0 && (
            <Card className="rounded-[24px] border-border/80 bg-card/80 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileWarning className="h-4 w-4 text-primary" />
                  Comprovantes aguardando revisão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingReceipts.map((receipt) => {
                  const cobranca = cobrancas.find((item) => item.id === receipt.cobranca_id);
                  return (
                    <div key={receipt.id} className="rounded-[20px] border border-border/70 bg-secondary/20 p-4 sm:rounded-md">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{receipt.aluno_nome}</p>
                            <Badge variant="secondary">Aguardando confirmação</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Valor: {cobranca ? `R$ ${Number(cobranca.valor).toFixed(2).replace(".", ",")}` : "?"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Vencimento: {cobranca ? new Date(cobranca.data_vencimento).toLocaleDateString("pt-BR") : "?"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Método: {paymentMethodLabel(cobranca?.payment_method || null)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Enviado em {new Date(receipt.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button variant="outline" className="gap-2" onClick={() => void openReceiptPreview(receipt)}>
                            <Eye className="h-4 w-4" />
                            Ver comprovante
                          </Button>
                          <Button
                            className="gap-2"
                            disabled={reviewingReceiptId === receipt.id}
                            onClick={() => void handleReviewReceipt(receipt, "approve")}
                          >
                            {reviewingReceiptId === receipt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Aprovar
                          </Button>
                          <Button
                            variant="destructive"
                            className="gap-2"
                            disabled={reviewingReceiptId === receipt.id}
                            onClick={() => {
                              setSelectedReceipt(receipt);
                              setRejectionReason("");
                              setRejectionDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <div className="overflow-x-auto rounded-[20px] border sm:rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 w-10">
                    <Checkbox
                      checked={cobrancas.length > 0 && selectedCobrancas.size === cobrancas.length}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedCobrancas(new Set(cobrancas.map(c => c.id)));
                        else setSelectedCobrancas(new Set());
                      }}
                    />
                  </th>
                  <th className="text-left p-3 font-medium">Aluno</th>
                  <th className="text-left p-3 font-medium">Valor</th>
                  <th className="text-left p-3 font-medium">Vencimento</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Método</th>
                  <th className="text-left p-3 font-medium">Pago em</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {cobrancasComReceipts.map(c => (
                  <tr key={c.id} className="border-b">
                    <td className="p-3">
                      <Checkbox
                        checked={selectedCobrancas.has(c.id)}
                        onCheckedChange={(checked) => {
                          setSelectedCobrancas(prev => {
                            const next = new Set(prev);
                            if (checked) next.add(c.id); else next.delete(c.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="p-3">{c.aluno_nome}</td>
                    <td className="p-3">R$ {Number(c.valor).toFixed(2).replace(".", ",")}</td>
                    <td className="p-3">{new Date(c.data_vencimento).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3">{statusBadge(c.status)}</td>
                    <td className="p-3">{paymentMethodLabel(c.payment_method)}</td>
                    <td className="p-3">{c.pago_em ? new Date(c.pago_em).toLocaleDateString("pt-BR") : "?"}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        {c.receipt && (
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl sm:h-7 sm:w-7 sm:rounded-md" onClick={() => void openReceiptPreview(c.receipt)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive hover:text-destructive sm:h-7 sm:w-7 sm:rounded-md">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir cobrança?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cobrança de R$ {Number(c.valor).toFixed(2).replace(".", ",")} para {c.aluno_nome} será removida permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => {
                                  const { error } = await supabase.from("cobrancas").delete().eq("id", c.id);
                                  if (error) toast.error("Erro ao excluir cobrança");
                                  else { toast.success("Cobrança excluída"); setSelectedCobrancas(prev => { const n = new Set(prev); n.delete(c.id); return n; }); fetchAll(); }
                                }}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
                {cobrancas.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhuma cobrança gerada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
        {/* CONFIG TAB */}
        <TabsContent value="config" className="space-y-6">
          {/* Chave PIX */}
          <Card className="rounded-[24px] border-border/80 bg-card/80 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-lg">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> PIX manual do CT</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Configure a chave PIX usada pelos alunos para pagar as mensalidades diretamente ao CT.
              </p>
              <div>
                <Label>Tipo de Chave PIX</Label>
                <Select
                  value={configMap["pix_tipo"] || "cpf"}
                  onValueChange={(v) => setConfigMap((prev) => ({ ...prev, pix_tipo: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chave PIX</Label>
                <Input
                  value={configMap["pix_chave"] || ""}
                  onChange={(e) => setConfigMap(prev => ({ ...prev, pix_chave: e.target.value }))}
                  placeholder="Digite sua chave PIX"
                />
              </div>
              <div>
                <Label>Nome do Beneficiário</Label>
                <Input
                  value={configMap["pix_beneficiario"] || ""}
                  onChange={(e) => setConfigMap(prev => ({ ...prev, pix_beneficiario: e.target.value }))}
                  placeholder="Nome que aparecerá na cobrança"
                />
              </div>
              <div>
                <Label>Banco (opcional)</Label>
                <Input
                  value={configMap["pix_banco_nome"] || ""}
                  onChange={(e) => setConfigMap(prev => ({ ...prev, pix_banco_nome: e.target.value }))}
                  placeholder="Ex: Nubank, Itaú, Banco do Brasil"
                />
              </div>
              <Button onClick={savePixConfig} disabled={configSaving} className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:rounded-md">
                {configSaving ? "Salvando..." : "Salvar Informações PIX"}
              </Button>
            </CardContent>
          </Card>
          {/* Template de Cobrança */}
          <Card className="rounded-[24px] border-border/80 bg-card/80 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-lg">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Template de Mensagem de Cobrança</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {"{nome}"}, {"{valor}"}, {"{data_vencimento}"}, {"{chave_pix}"}
              </p>
              <div>
                <Label>Título</Label>
                <Input value={templateTitulo} onChange={(e) => setTemplateTitulo(e.target.value)} />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea value={templateMensagem} onChange={(e) => setTemplateMensagem(e.target.value)} rows={6} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={saveTemplate} disabled={configSaving} className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:rounded-md">
                  {configSaving ? "Salvando..." : "Salvar Template"}
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="h-11 w-full gap-2 rounded-xl sm:h-10 sm:w-auto sm:rounded-md">
                      <Eye className="h-4 w-4" /> Pré-visualizar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border-border bg-card sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-heading">Pré-visualização da Mensagem</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Título</Label>
                        <p className="text-foreground font-medium">
                          {templateTitulo}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Mensagem</Label>
                        <div className="bg-secondary rounded-md p-3 text-sm text-foreground whitespace-pre-wrap">
                          {templateMensagem
                            .replace(/{nome}/g, "João Silva")
                            .replace(/{valor}/g, "150,00")
                            .replace(/{data_vencimento}/g, "15/04/2026")
                            .replace(/{chave_pix}/g, configMap["pix_chave"] || "sua-chave-pix")
                            .replace(/{link_boleto}/g, "")}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={previewReceiptOpen} onOpenChange={setPreviewReceiptOpen}>
        <DialogContent className="border-border bg-card sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Comprovante enviado</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-border/70 bg-secondary/20 p-4">
            {previewReceiptLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : previewReceiptUrl ? (
              <img src={previewReceiptUrl} alt="Comprovante de pagamento" className="max-h-[70vh] rounded-lg object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">Não foi possível carregar o comprovante.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Rejeitar comprovante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-secondary/20 p-3">
              <p className="text-sm text-muted-foreground">Informe um motivo claro para o aluno corrigir o envio.</p>
            </div>
            <div>
              <Label>Motivo da rejeição</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                placeholder="Ex: comprovante ilegível, valor divergente ou comprovante de outra cobrança."
              />
            </div>
            <Button
              variant="destructive"
              className="w-full gap-2"
              disabled={!selectedReceipt || reviewingReceiptId === selectedReceipt?.id || rejectionReason.trim().length < 3}
              onClick={() => selectedReceipt && void handleReviewReceipt(selectedReceipt, "reject", rejectionReason.trim())}
            >
              {reviewingReceiptId === selectedReceipt?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirmar rejeição
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plano Dialog */}
      <Dialog open={planoDialogOpen} onOpenChange={setPlanoDialogOpen}>
        <DialogContent className="border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editingPlano ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={planoNome} onChange={e => setPlanoNome(e.target.value)} placeholder="Ex: Mensal Básico" /></div>
            <div><Label>Valor (R$)</Label><Input value={planoValor} onChange={e => setPlanoValor(e.target.value)} placeholder="150,00" /></div>
            <div><Label>Descrição</Label><Textarea value={planoDescricao} onChange={e => setPlanoDescricao(e.target.value)} placeholder="Descrição do plano" rows={3} /></div>
            <div>
              <Label>Periodicidade</Label>
              <Select value={planoPeriodicidade} onValueChange={setPlanoPeriodicidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSavePlano} disabled={saving} className="w-full">
              {saving ? "Salvando..." : editingPlano ? "Atualizar" : "Criar Plano"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Associar Aluno Dialog */}
      <Dialog open={associarDialogOpen} onOpenChange={setAssociarDialogOpen}>
        <DialogContent className="border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Associar Aluno a Plano</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Aluno</Label>
              <Select value={selectedAlunoId} onValueChange={setSelectedAlunoId}>
                <SelectTrigger><SelectValue placeholder="Selecione um aluno" /></SelectTrigger>
                <SelectContent>
                  {profiles.filter((p) => !alunosComPlano.has(p.user_id)).map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome} {p.sobrenome || ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={selectedPlanoId} onValueChange={setSelectedPlanoId}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {planos.filter(p => p.ativo).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ? R$ {Number(p.valor).toFixed(2).replace(".", ",")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dia de Vencimento</Label>
              <Select value={diaVencimento} onValueChange={setDiaVencimento}>
                <SelectTrigger><SelectValue placeholder="Selecione o dia" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                    <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAssociar} className="w-full">Associar</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Cobrança Manual Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Nova Cobrança Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Aluno</Label>
              <Select value={manualAlunoId} onValueChange={handleManualAlunoChange}>
                <SelectTrigger><SelectValue placeholder="Selecione um aluno" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome} {p.sobrenome || ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Valor (R$)</Label>
                <Input value={manualValor} onChange={e => setManualValor(e.target.value)} placeholder="150,00" />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={manualVencimento} onChange={e => setManualVencimento(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={manualDescricao} onChange={e => setManualDescricao(e.target.value)} placeholder="Ex: Mensalidade Março" />
            </div>

            <div className="space-y-3 rounded-[20px] border p-3 sm:rounded-md">
              <p className="text-sm font-medium text-foreground">Notificar aluno</p>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="notify-email"
                  checked={manualNotifyEmail}
                  onCheckedChange={(v) => setManualNotifyEmail(!!v)}
                />
                <Label htmlFor="notify-email" className="text-sm cursor-pointer">E-mail</Label>
              </div>
              {manualNotifyEmail && (
                <Input
                  value={manualEmail}
                  onChange={e => setManualEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  type="email"
                />
              )}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="notify-wts"
                  checked={manualNotifyWts}
                  onCheckedChange={(v) => setManualNotifyWts(!!v)}
                />
                <Label htmlFor="notify-wts" className="text-sm cursor-pointer">WhatsApp</Label>
              </div>
              {manualNotifyWts && (
                <Input
                  value={manualTelefone}
                  onChange={e => setManualTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              )}
            </div>
            <Button onClick={handleCriarCobrancaManual} disabled={savingManual} className="w-full">
              {savingManual ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Criando...</> : "Criar Cobrança"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceiroSection;
