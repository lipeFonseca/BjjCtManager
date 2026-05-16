import { ChangeEvent, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, QrCode, Copy, Check, Clock, AlertTriangle, CheckCircle2, Upload, Eye, FileWarning, Loader2 } from "lucide-react";

interface Cobranca {
  id: string;
  valor: number;
  data_vencimento: string;
  status: string;
  asaas_boleto_url: string | null;
  asaas_pix_copia_cola: string | null;
  asaas_pix_qrcode: string | null;
  created_at: string;
  pago_em: string | null;
  payment_method: string | null;
  rejection_reason: string | null;
  plano_nome?: string;
}

interface PaymentReceipt {
  id: string;
  cobranca_id: string;
  storage_path: string;
  review_status: string;
  created_at: string;
  rejection_reason: string | null;
}

interface AlunoPagamentosSectionProps {
  userId: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  pendente: { label: "Pendente", variant: "outline", icon: Clock },
  aguardando_confirmacao: { label: "Aguardando confirmação", variant: "secondary", icon: Clock },
  rejeitado: { label: "Rejeitado", variant: "destructive", icon: FileWarning },
  pago: { label: "Pago", variant: "default", icon: CheckCircle2 },
  confirmado: { label: "Confirmado", variant: "default", icon: CheckCircle2 },
  atrasado: { label: "Atrasado", variant: "destructive", icon: AlertTriangle },
  vencido: { label: "Vencido", variant: "destructive", icon: AlertTriangle },
  cancelado: { label: "Cancelado", variant: "secondary", icon: AlertTriangle },
};

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
  cartao: "Cartão",
};

const AlunoPagamentosSection = ({ userId }: AlunoPagamentosSectionProps) => {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [receiptsByCharge, setReceiptsByCharge] = useState<Record<string, PaymentReceipt>>({});
  const [loading, setLoading] = useState(true);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [selectedCobranca, setSelectedCobranca] = useState<Cobranca | null>(null);
  const [copied, setCopied] = useState(false);
  const [pixChave, setPixChave] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchCobrancas = async () => {
    setLoading(true);

    const [{ data: cobData, error }, { data: receipts }, { data: profile }] = await Promise.all([
      supabase.from("cobrancas").select("*").eq("aluno_id", userId).order("data_vencimento", { ascending: false }),
      supabase
        .from("payment_receipts")
        .select("id, cobranca_id, storage_path, review_status, created_at, rejection_reason")
        .eq("aluno_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("ct_id").eq("user_id", userId).single(),
    ]);

    if (error) {
      console.error("Error fetching cobrancas:", error);
      setLoading(false);
      return;
    }

    const planoIds = [...new Set((cobData || []).map((c) => c.plano_id).filter(Boolean))];
    const planoMap: Record<string, string> = {};
    if (planoIds.length > 0) {
      const { data: planos } = await supabase
        .from("planos_mensalidade")
        .select("id, nome")
        .in("id", planoIds);
      (planos || []).forEach((p) => { planoMap[p.id] = p.nome; });
    }

    if (profile?.ct_id) {
      const { data: configs } = await supabase
        .from("config_pagamento")
        .select("config_key, config_value")
        .eq("ct_id", profile.ct_id)
        .eq("config_key", "pix_chave");

      if (configs && configs.length > 0) {
        setPixChave(configs[0].config_value);
      }
    }

    const latestReceipts = Object.fromEntries(
      (receipts || []).map((receipt) => [receipt.cobranca_id, receipt]),
    );

    const mapped: Cobranca[] = (cobData || []).map((c) => ({
      ...c,
      plano_nome: c.plano_id ? planoMap[c.plano_id] || "Plano" : "Mensalidade",
    }));

    setReceiptsByCharge(latestReceipts);
    setCobrancas(mapped);
    setLoading(false);
  };

  useEffect(() => {
    if (userId) void fetchCobrancas();
  }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`aluno-pagamentos-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cobrancas", filter: `aluno_id=eq.${userId}` },
        () => { void fetchCobrancas(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_receipts", filter: `aluno_id=eq.${userId}` },
        () => { void fetchCobrancas(); },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  const handleCopyPix = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const openPixDialog = (cobranca: Cobranca) => {
    setSelectedCobranca(cobranca);
    setPixDialogOpen(true);
  };

  const openUploadDialog = (cobranca: Cobranca) => {
    setSelectedCobranca(cobranca);
    setSelectedFile(null);
    setPaymentMethod(cobranca.payment_method || "pix");
    setUploadDialogOpen(true);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("O comprovante deve ter no máximo 2MB.");
      event.target.value = "";
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Envie uma imagem JPG, PNG ou WEBP.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmitReceipt = async () => {
    if (!selectedCobranca) return;
    if (!selectedFile) {
      toast.error("Selecione a imagem do comprovante.");
      return;
    }

    setUploadingReceipt(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-payment-receipt`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cobranca_id: selectedCobranca.id,
            payment_method: paymentMethod,
            file_name: selectedFile.name,
            mime_type: selectedFile.type,
            file_base64: base64,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error || "Não foi possível enviar o comprovante.");
        return;
      }

      toast.success("Comprovante enviado para revisão.");
      setUploadDialogOpen(false);
      setSelectedFile(null);
      await fetchCobrancas();
    } catch (error) {
      console.error("Erro ao enviar comprovante:", error);
      toast.error("Erro ao enviar comprovante.");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const openReceiptPreview = async (receipt: PaymentReceipt) => {
    setPreviewLoading(true);
    setPreviewDialogOpen(true);
    setPreviewUrl("");

    try {
      const { data, error } = await supabase.storage
        .from("payment-receipts")
        .createSignedUrl(receipt.storage_path, 3600);

      if (error || !data?.signedUrl) {
        toast.error("Não foi possível abrir o comprovante.");
        setPreviewDialogOpen(false);
        return;
      }

      setPreviewUrl(data.signedUrl);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Carregando pagamentos...</div>
      </div>
    );
  }

  const pendentes = cobrancas.filter((c) => ["pendente", "atrasado", "vencido", "aguardando_confirmacao", "rejeitado"].includes(c.status));
  const historico = cobrancas.filter((c) => ["pago", "confirmado", "cancelado"].includes(c.status));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-heading font-bold text-foreground">Minhas Mensalidades</h2>
      </div>

      {pixChave && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <QrCode className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Chave PIX do CT</p>
                  <p className="text-sm text-muted-foreground font-mono">{pixChave}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleCopyPix(pixChave)} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pendentes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Mensalidades em aberto</h3>
          {pendentes.map((cob) => {
            const cfg = statusConfig[cob.status] || statusConfig.pendente;
            const StatusIcon = cfg.icon;
            const receipt = receiptsByCharge[cob.id];

            return (
              <Card key={cob.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{cob.plano_nome}</span>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(cob.valor)}</p>
                      <p className="text-sm text-muted-foreground">Vencimento: {formatDate(cob.data_vencimento)}</p>
                      {cob.payment_method && (
                        <p className="text-sm text-muted-foreground">
                          Método informado: {paymentMethodLabels[cob.payment_method] || cob.payment_method}
                        </p>
                      )}
                      {cob.status === "aguardando_confirmacao" && receipt && (
                        <p className="text-sm text-muted-foreground">
                          Comprovante enviado em {formatDate(receipt.created_at)}
                        </p>
                      )}
                      {(cob.rejection_reason || receipt?.rejection_reason) && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          Motivo da rejeição: {cob.rejection_reason || receipt?.rejection_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {pixChave && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => openPixDialog(cob)}>
                          <QrCode className="h-4 w-4" />
                          PIX
                        </Button>
                      )}
                      {receipt && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => void openReceiptPreview(receipt)}>
                          <Eye className="h-4 w-4" />
                          Comprovante
                        </Button>
                      )}
                      {cob.status !== "aguardando_confirmacao" && (
                        <Button size="sm" className="gap-2" onClick={() => openUploadDialog(cob)}>
                          <Upload className="h-4 w-4" />
                          {cob.status === "rejeitado" ? "Reenviar comprovante" : "Enviar comprovante"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pendentes.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Nenhuma mensalidade pendente</p>
          </CardContent>
        </Card>
      )}

      {historico.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Histórico</h3>
          {historico.map((cob) => {
            const cfg = statusConfig[cob.status] || statusConfig.pendente;
            return (
              <Card key={cob.id} className="border-border opacity-80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{cob.plano_nome}</span>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>
                      <p className="text-foreground">{formatCurrency(cob.valor)}</p>
                      <p className="text-sm text-muted-foreground">
                        Vencimento: {formatDate(cob.data_vencimento)}
                        {cob.pago_em ? ` • Pago em: ${formatDate(cob.pago_em)}` : ""}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={pixDialogOpen} onOpenChange={setPixDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Pagamento via PIX
            </DialogTitle>
          </DialogHeader>
          {selectedCobranca && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{formatCurrency(selectedCobranca.valor)}</p>
                <p className="text-sm text-muted-foreground">Vencimento: {formatDate(selectedCobranca.data_vencimento)}</p>
              </div>

              {pixChave && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Chave PIX:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 p-2 bg-muted rounded text-sm break-all">{pixChave}</code>
                    <Button variant="outline" size="sm" onClick={() => handleCopyPix(pixChave)}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Enviar comprovante</DialogTitle>
          </DialogHeader>
          {selectedCobranca && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
                <p className="text-sm font-medium text-foreground">{selectedCobranca.plano_nome}</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(selectedCobranca.valor)}</p>
                <p className="text-xs text-muted-foreground">Vencimento: {formatDate(selectedCobranca.data_vencimento)}</p>
              </div>

              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Imagem do comprovante</Label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
                />
                <p className="text-xs text-muted-foreground">Envie JPG, PNG ou WEBP com até 2MB.</p>
                {selectedFile && (
                  <p className="text-xs text-foreground">
                    Arquivo selecionado: <span className="font-medium">{selectedFile.name}</span>
                  </p>
                )}
              </div>

              <Button onClick={() => void handleSubmitReceipt()} disabled={uploadingReceipt} className="w-full gap-2">
                {uploadingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadingReceipt ? "Enviando..." : "Enviar para revisão"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Comprovante enviado</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-border/70 bg-secondary/20 p-4">
            {previewLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : previewUrl ? (
              <img src={previewUrl} alt="Comprovante de pagamento" className="max-h-[70vh] rounded-lg object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">Não foi possível carregar o comprovante.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlunoPagamentosSection;
