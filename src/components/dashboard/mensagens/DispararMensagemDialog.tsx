import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Send, Mail, MessageCircle, Eye, ArrowLeft, ArrowRight, Settings2, Users, Trash2, Sparkles, CheckCircle2 } from "lucide-react";
import RecipientSelector, { type Recipient } from "./RecipientSelector";
import DirectMessageComposer from "./DirectMessageComposer";
import {
  buildTelegramChannelText,
  buildWhatsAppChannelText,
  renderDirectEmailHtml,
  renderDirectEmailPreviewHtml,
  renderTelegramPreviewHtml,
  renderWhatsAppPreviewHtml,
} from "./templateBranding";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctId: string;
  userId: string;
  onSent?: () => Promise<void> | void;
}

const STEP_META: Array<{ id: Step; number: string; title: string; description: string }> = [
  { id: "compose", number: "01", title: "Compor", description: "assunto, canais e mensagem" },
  { id: "recipients", number: "02", title: "Destinatarios", description: "alunos e grupos" },
  { id: "preview", number: "03", title: "Enviar", description: "revisao final do disparo" },
];

type Channel = "email" | "whatsapp" | "telegram";
type Step = "compose" | "recipients" | "preview";

interface RecipientGroup {
  id: string;
  nome: string;
  descricao: string | null;
  memberIds: string[];
}

const cleanWhatsAppPhone = (phone: string | null | undefined) => (phone || "").replace(/\D/g, "");

const DispararMensagemDialog = ({ open, onOpenChange, ctId, userId, onSent }: Props) => {
  const [step, setStep] = useState<Step>("compose");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [channels, setChannels] = useState<Set<Channel>>(new Set(["email"]));
  const [alunos, setAlunos] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewDate, setPreviewDate] = useState(() => new Date());
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("compose");
    setTitulo("");
    setConteudo("");
    setChannels(new Set(["email"]));
    setSelected(new Set());
    setNewGroupName("");
    setNewGroupDescription("");
    void fetchAlunos();
    void fetchGroups();
  }, [open, ctId]);

  useEffect(() => {
    if (!open) return;

    setPreviewDate(new Date());
    const intervalId = window.setInterval(() => {
      setPreviewDate(new Date());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [open]);

  const fetchAlunos = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome, sobrenome, faixa, grau, email, telefone")
      .eq("ct_id", ctId);

    if (!profiles) {
      setLoading(false);
      return;
    }

    const userIds = profiles.map((p) => p.user_id);
    const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
    const alunoIds = new Set((roles || []).filter((r) => r.role === "aluno").map((r) => r.user_id));

    setAlunos(
      profiles
        .filter((p) => alunoIds.has(p.user_id))
        .map((p) => ({
          user_id: p.user_id,
          nome: p.nome,
          sobrenome: p.sobrenome,
          faixa: p.faixa || "branca",
          grau: p.grau,
          email: p.email,
          telefone: p.telefone,
        }))
    );
    setLoading(false);
  };

  const fetchGroups = async () => {
    setGroupsLoading(true);
    const { data: groupRows, error: groupError } = await supabase
      .from("mensagem_grupos")
      .select("id, nome, descricao")
      .eq("ct_id", ctId)
      .order("nome");

    if (groupError) {
      console.error(groupError);
      setGroups([]);
      setGroupsLoading(false);
      return;
    }

    const groupIds = (groupRows || []).map((group) => group.id);
    if (groupIds.length === 0) {
      setGroups([]);
      setGroupsLoading(false);
      return;
    }

    const { data: memberRows, error: memberError } = await supabase
      .from("mensagem_grupo_membros")
      .select("grupo_id, destinatario_id")
      .in("grupo_id", groupIds);

    if (memberError) {
      console.error(memberError);
      setGroups([]);
      setGroupsLoading(false);
      return;
    }

    const memberMap = new Map<string, string[]>();
    (memberRows || []).forEach((member) => {
      const current = memberMap.get(member.grupo_id) || [];
      current.push(member.destinatario_id);
      memberMap.set(member.grupo_id, current);
    });

    setGroups(
      (groupRows || []).map((group) => ({
        ...group,
        memberIds: memberMap.get(group.id) || [],
      }))
    );
    setGroupsLoading(false);
  };

  const toggleChannel = (ch: Channel) => {
    const newSet = new Set(channels);
    if (newSet.has(ch)) {
      if (newSet.size > 1) newSet.delete(ch);
    } else {
      newSet.add(ch);
    }
    setChannels(newSet);
  };

  const handleUpdateContact = async (recipientUserId: string, field: "email" | "telefone", value: string) => {
    const normalizedValue = value || null;
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: normalizedValue })
      .eq("user_id", recipientUserId)
      .eq("ct_id", ctId);

    if (error) {
      toast.error(`Erro ao atualizar ${field === "email" ? "e-mail" : "telefone"}`);
      console.error(error);
      return false;
    }

    setAlunos((prev) => prev.map((a) => (a.user_id === recipientUserId ? { ...a, [field]: normalizedValue } : a)));
    toast.success(`${field === "email" ? "E-mail" : "Telefone"} atualizado`);
    return true;
  };

  const selectedAlunos = alunos.filter((a) => selected.has(a.user_id));
  const messageBodyHtml = useMemo(() => conteudo, [conteudo]);
  const plainBodyText = useMemo(() => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = messageBodyHtml;
    tempDiv.querySelectorAll('[data-bjj-signature="true"]').forEach((node) => node.remove());

    const blockTags = new Set(["P", "DIV", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE"]);

    const extractNodeText = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || "";
      }

      if (!(node instanceof HTMLElement)) {
        return "";
      }

      if (node.tagName === "BR") {
        return "\n";
      }

      if (node.tagName === "IMG") {
        return "";
      }

      const childText = Array.from(node.childNodes).map(extractNodeText).join("");
      const normalizedChildText = childText.replace(/\u00a0/g, " ");

      if (node.tagName === "LI") {
        return `• ${normalizedChildText.trim()}\n`;
      }

      if (blockTags.has(node.tagName) || node.hasAttribute("data-bjj-attachments") || node.hasAttribute("data-bjj-confidential")) {
        return `${normalizedChildText.trim()}\n\n`;
      }

      return normalizedChildText;
    };

    return Array.from(tempDiv.childNodes)
      .map(extractNodeText)
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }, [messageBodyHtml]);
  const emailHtmlForSend = useMemo(() => renderDirectEmailHtml(messageBodyHtml, titulo || "Mensagem"), [messageBodyHtml, titulo]);
  const previewByChannel = useMemo(
    () => ({
      email: renderDirectEmailPreviewHtml(messageBodyHtml, titulo || "Mensagem", previewDate),
      telegram: renderTelegramPreviewHtml(messageBodyHtml, titulo || "Mensagem", previewDate),
      whatsapp: renderWhatsAppPreviewHtml(messageBodyHtml, titulo || "Mensagem", previewDate),
    }),
    [messageBodyHtml, previewDate, titulo]
  );
  const canonicalPreview = useMemo(() => {
    if (channels.has("email")) return previewByChannel.email;
    if (channels.has("telegram")) return previewByChannel.telegram;
    return previewByChannel.whatsapp;
  }, [channels, previewByChannel]);
  const plainPreview = plainBodyText;
  const canProceedCompose = Boolean(titulo.trim() && plainPreview);
  const canProceedRecipients = selected.size > 0;
  const selectedWithoutEmail = selectedAlunos.filter((a) => !a.email);
  const selectedWithoutPhone = selectedAlunos.filter((a) => !a.telefone);

  const applyGroup = (group: RecipientGroup) => {
    const next = new Set(selected);
    group.memberIds.forEach((memberId) => next.add(memberId));
    setSelected(next);
    toast.success(`Grupo "${group.nome}" aplicado`);
  };

  const handleSaveGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Informe um nome para o grupo");
      return;
    }
    if (selected.size === 0) {
      toast.error("Selecione destinatários antes de salvar um grupo");
      return;
    }

    setSavingGroup(true);
    const { data: insertedGroup, error: groupError } = await supabase
      .from("mensagem_grupos")
      .insert({
        nome: newGroupName.trim(),
        descricao: newGroupDescription.trim() || null,
        ct_id: ctId,
        created_by: userId,
      })
      .select("id")
      .single();

    if (groupError) {
      toast.error("Erro ao criar grupo");
      console.error(groupError);
      setSavingGroup(false);
      return;
    }

    const { error: membersError } = await supabase.from("mensagem_grupo_membros").insert(
      Array.from(selected).map((memberId) => ({
        grupo_id: insertedGroup.id,
        destinatario_id: memberId,
      }))
    );

    if (membersError) {
      toast.error("Erro ao salvar membros do grupo");
      console.error(membersError);
      await supabase.from("mensagem_grupos").delete().eq("id", insertedGroup.id);
      setSavingGroup(false);
      return;
    }

    toast.success("Grupo salvo com sucesso");
    setNewGroupName("");
    setNewGroupDescription("");
    setGroupDialogOpen(false);
    await fetchGroups();
    setSavingGroup(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    setDeletingGroupId(groupId);
    const { error } = await supabase.from("mensagem_grupos").delete().eq("id", groupId);
    if (error) {
      toast.error("Erro ao apagar grupo");
      console.error(error);
    } else {
      toast.success("Grupo apagado");
      await fetchGroups();
    }
    setDeletingGroupId(null);
  };

  const rollbackSavedDisparo = async (messageId: string) => {
    const { error } = await supabase.from("mensagens").delete().eq("id", messageId);
    if (error) {
      console.error("Erro ao desfazer disparo salvo:", error);
    }
  };

  const getWhatsAppSendMode = async () => {
    const { data, error } = await supabase
      .from("webhook_config")
      .select("config_value, updated_at")
      .eq("ct_id", ctId)
      .eq("config_key", "whatsapp_send_mode")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Erro ao carregar modo do WhatsApp:", error);
      return "wa_me" as const;
    }

    return (data?.[0]?.config_value as "wa_me" | "uazapi" | undefined) || "wa_me";
  };

  const openWhatsAppConversation = (recipient: Recipient, message: string) => {
    const normalizedPhone = cleanWhatsAppPhone(recipient.telefone);
    if (!normalizedPhone) return null;

    const phoneWithCountryCode = normalizedPhone.startsWith("55") ? normalizedPhone : `55${normalizedPhone}`;
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${phoneWithCountryCode}?text=${encodedMessage}`;

    return window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSend = async () => {
    const currentSelectedAlunos = alunos.filter((a) => selected.has(a.user_id));
    if (currentSelectedAlunos.length === 0) {
      toast.error("Selecione pelo menos um destinatário");
      return;
    }

    setSending(true);

    const { data: savedMessage, error: saveMessageError } = await supabase
      .from("mensagens")
        .insert({
        titulo: titulo.trim(),
        conteudo: canonicalPreview,
        remetente_id: userId,
        ct_id: ctId,
        tipo: "disparo",
      })
      .select("id")
      .single();

    if (saveMessageError) {
      toast.error("Erro ao salvar o disparo");
      console.error(saveMessageError);
      setSending(false);
      return;
    }

    const conteudoTexto = plainBodyText;
    const whatsappText = buildWhatsAppChannelText(titulo.trim(), conteudoTexto);

    const recipientPayload = currentSelectedAlunos.map((a) => ({
      user_id: a.user_id,
      nome: a.nome,
      sobrenome: a.sobrenome,
      email: a.email,
      telefone: a.telefone,
    }));

    const { error: recipientsError } = await supabase.from("mensagem_destinatarios").insert(
      currentSelectedAlunos.map((a) => ({
        mensagem_id: savedMessage.id,
        destinatario_id: a.user_id,
      }))
    );

    if (recipientsError) {
      toast.error("Erro ao registrar destinatários do disparo");
      console.error(recipientsError);
      await rollbackSavedDisparo(savedMessage.id);
      setSending(false);
      return;
    }

    const whatsappSendMode = channels.has("whatsapp") ? await getWhatsAppSendMode() : "wa_me";
    const backendChannels = Array.from(channels).filter(
      (channel) => channel !== "whatsapp" || whatsappSendMode === "uazapi"
    );
    let localWhatsAppResult:
      | {
          channel: "whatsapp";
          success: number;
          failed: number;
          errors: string[];
        }
      | null = null;

    if (channels.has("whatsapp") && whatsappSendMode === "wa_me") {
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      const whatsappRecipients = currentSelectedAlunos.filter((recipient) => cleanWhatsAppPhone(recipient.telefone));

      whatsappRecipients.forEach((recipient, index) => {
        window.setTimeout(() => {
          const openedWindow = openWhatsAppConversation(recipient, whatsappText);
          if (!openedWindow) {
            console.warn("Popup bloqueado ao abrir WhatsApp para:", recipient.nome);
          }
        }, index * 800);
      });

      success += whatsappRecipients.length;

      const noPhoneRecipients = currentSelectedAlunos.filter((recipient) => !cleanWhatsAppPhone(recipient.telefone));
      if (noPhoneRecipients.length > 0) {
        failed += noPhoneRecipients.length;
        errors.push(`${noPhoneRecipients.length} destinatario(s) sem telefone cadastrado`);
      }

      localWhatsAppResult = {
        channel: "whatsapp",
        success,
        failed,
        errors,
      };
    }

    try {
      const aggregatedResults: Array<{ channel: string; success: number; failed: number; errors: string[] }> = [];

      if (backendChannels.length > 0) {
        const { data, error } = await supabase.functions.invoke("send-message", {
          body: {
            ct_id: ctId,
            titulo: titulo.trim(),
            conteudo: messageBodyHtml,
            conteudo_texto: conteudoTexto,
            email_body_html: messageBodyHtml,
            email_html: emailHtmlForSend,
            telegram_text: buildTelegramChannelText(titulo.trim(), conteudoTexto),
            whatsapp_text: whatsappText,
            channels: backendChannels,
            recipients: recipientPayload,
          },
        });

        if (error) {
          toast.error(`Erro ao enviar mensagens: ${error.message}`);
          await rollbackSavedDisparo(savedMessage.id);
          setSending(false);
          return;
        }

        if (data?.results) {
          aggregatedResults.push(...data.results);
        }
      }

      if (localWhatsAppResult) {
        aggregatedResults.push(localWhatsAppResult);
      }

      const totalSuccess = aggregatedResults.reduce((sum, result) => sum + result.success, 0);
      const totalFailed = aggregatedResults.reduce((sum, result) => sum + result.failed, 0);

      for (const result of aggregatedResults) {
        const channelName =
          result.channel === "email" ? "E-mail" : result.channel === "telegram" ? "Telegram" : "WhatsApp";
        if (result.success > 0) {
          if (result.channel === "whatsapp") {
            toast.success(`${channelName}: ${result.success} conversa(s) aberta(s)`);
          } else {
            toast.success(`${channelName}: ${result.success} mensagem(ns) enviada(s)`);
          }
        }
        if (result.failed > 0) {
          toast.error(`${channelName}: ${result.failed} falha(s)${result.errors?.length ? ` - ${result.errors[0]}` : ""}`);
        }
      }

      if (channels.has("whatsapp") && whatsappSendMode === "wa_me" && localWhatsAppResult?.success) {
        toast.message("WhatsApp aberto no navegador. Permita pop-ups se alguma conversa nao aparecer.");
      }

      if (totalSuccess === 0) {
        toast.error("Nenhuma mensagem foi enviada. O disparo salvo foi desfeito.");
        await rollbackSavedDisparo(savedMessage.id);
        setSending(false);
        return;
      }

      if (totalFailed > 0) {
        toast.warning("O disparo foi enviado apenas parcialmente. Revise os destinatarios com falha.");
      }

      await onSent?.();
    } catch (err) {
      toast.error("Erro ao disparar mensagens");
      console.error(err);
      await rollbackSavedDisparo(savedMessage.id);
      setSending(false);
      return;
    }

    setSending(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[min(96vw,1680px)] overflow-y-auto border-border bg-card p-0 sm:max-w-[96vw] 2xl:max-w-[1680px]">
        <DialogHeader className="border-b border-border bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_100%)] px-6 py-5">
          <DialogTitle className="flex items-center gap-3 font-heading text-foreground">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-primary/10 text-primary shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
              <Send className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-lg">Disparar Mensagem</span>
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Mesmo ecossistema visual do comunicado, agora no envio direto
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-3 lg:grid-cols-3">
            {STEP_META.map((item) => {
              const active = step === item.id;
              const unlocked = STEP_META.findIndex((meta) => meta.id === step) >= STEP_META.findIndex((meta) => meta.id === item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-[24px] border px-4 py-4 transition-all sm:rounded-2xl",
                    active
                      ? "border-primary/30 bg-primary/10 shadow-[0_20px_60px_-42px_rgba(59,130,246,0.45)]"
                      : unlocked
                        ? "border-border/70 bg-card/60"
                        : "border-border/50 bg-secondary/30 opacity-80",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-2xl border text-xs font-semibold tracking-[0.16em]",
                        active ? "border-primary/35 bg-primary/15 text-primary" : "border-border bg-background/60 text-muted-foreground",
                      )}
                    >
                      {unlocked && !active ? <CheckCircle2 className="h-4 w-4" /> : item.number}
                    </span>
                    <div className="space-y-1">
                      <p className={cn("text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground")}>{item.title}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        {step === "compose" && (
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.18fr)_minmax(380px,0.82fr)]">
            <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-2xl">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <div className="flex items-center rounded-full bg-primary text-primary-foreground">
                  <Button
                    type="button"
                    className="h-11 rounded-l-full rounded-r-none px-6 shadow-none"
                    disabled={!canProceedCompose}
                    onClick={() => setStep("recipients")}
                  >
                    Avancar
                  </Button>
                  <button
                    type="button"
                    className="flex h-11 w-12 items-center justify-center rounded-r-full border-l border-white/20 transition-colors hover:bg-white/10"
                    onClick={() => setStep("recipients")}
                    disabled={!canProceedCompose}
                    title="Ir para destinatarios"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="ml-auto flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Disparo com identidade visual
                </div>
              </div>

              <div className="space-y-5 px-5 py-5 sm:px-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Assunto</Label>
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Titulo da mensagem" className="h-14 rounded-[20px] border-border/80 bg-background/70 px-4 text-base shadow-inner shadow-black/10" />
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Canais de envio</Label>
                    <p className="text-sm text-muted-foreground">Escolha por onde essa mensagem vai sair. Ao menos um canal precisa permanecer ativo.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <label className={cn("cursor-pointer rounded-[24px] border p-4 transition-all sm:rounded-2xl", channels.has("email") ? "border-sky-500/30 bg-sky-500/10 text-sky-100 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.75)]" : "border-border/70 bg-secondary/35 text-muted-foreground hover:border-border hover:bg-secondary/55 hover:text-foreground")}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", channels.has("email") ? "border-white/15 bg-black/15" : "border-border bg-background/70")}><Mail className="h-4 w-4" /></span>
                        <Checkbox checked={channels.has("email")} onCheckedChange={() => toggleChannel("email")} className="pointer-events-none" />
                      </div>
                      <p className="text-sm font-semibold">E-mail</p>
                      <p className="mt-1 text-xs leading-relaxed opacity-80">Template visual completo</p>
                    </label>
                    <label className={cn("cursor-pointer rounded-[24px] border p-4 transition-all sm:rounded-2xl", channels.has("whatsapp") ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.75)]" : "border-border/70 bg-secondary/35 text-muted-foreground hover:border-border hover:bg-secondary/55 hover:text-foreground")}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", channels.has("whatsapp") ? "border-white/15 bg-black/15" : "border-border bg-background/70")}><MessageCircle className="h-4 w-4" /></span>
                        <Checkbox checked={channels.has("whatsapp")} onCheckedChange={() => toggleChannel("whatsapp")} className="pointer-events-none" />
                      </div>
                      <p className="text-sm font-semibold">WhatsApp</p>
                      <p className="mt-1 text-xs leading-relaxed opacity-80">Texto direto e rapido</p>
                    </label>
                    <label className={cn("cursor-pointer rounded-[24px] border p-4 transition-all sm:rounded-2xl", channels.has("telegram") ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-100 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.75)]" : "border-border/70 bg-secondary/35 text-muted-foreground hover:border-border hover:bg-secondary/55 hover:text-foreground")}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", channels.has("telegram") ? "border-white/15 bg-black/15" : "border-border bg-background/70")}><MessageCircle className="h-4 w-4" /></span>
                        <Checkbox checked={channels.has("telegram")} onCheckedChange={() => toggleChannel("telegram")} className="pointer-events-none" />
                      </div>
                      <p className="text-sm font-semibold">Telegram</p>
                      <p className="mt-1 text-xs leading-relaxed opacity-80">Texto direto no canal</p>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mensagem</Label>
                    <p className="text-sm text-muted-foreground">Monte o disparo com texto rico, assinatura no e-mail e imagens ajustáveis. WhatsApp e Telegram recebem a versão textual.</p>
                  </div>
                  <DirectMessageComposer ctId={ctId} content={conteudo} onChange={setConteudo} />
                </div>
              </div>
            </div>

            <div className="space-y-5 2xl:sticky 2xl:top-0">
              <div className="rounded-[28px] border border-border bg-card/70 p-5 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Resumo rapido</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                  <div className="rounded-[20px] border border-border/70 bg-secondary/30 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Assunto</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{titulo.trim() || "Defina um titulo claro para o disparo"}</p>
                  </div>
                  <div className="rounded-[20px] border border-border/70 bg-secondary/30 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Canais ativos</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Array.from(channels).map((channel) => (
                        <span key={channel} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
                          {channel === "email" ? "E-mail" : channel === "whatsapp" ? "WhatsApp" : "Telegram"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-border bg-card/70 p-5 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Previa editorial</p>
                <p className="mt-2 text-sm text-muted-foreground">Uma amostra visual do disparo com o layout real de cada canal selecionado.</p>
                <div className="mt-4 space-y-4">
                  {plainPreview ? (
                    Array.from(channels).map((channel) => (
                      <div key={channel} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {channel === "email" ? "Previa de e-mail" : channel === "telegram" ? "Previa de Telegram" : "Previa de WhatsApp"}
                        </div>
                        <div className="mx-auto max-w-full overflow-hidden text-sm [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl" dangerouslySetInnerHTML={{ __html: previewByChannel[channel] }} />
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <div className="py-8 text-center text-sm text-muted-foreground">Comece a escrever a mensagem para visualizar o disparo.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "recipients" && (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="rounded-[28px] border border-border bg-card/70 p-5 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-2xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Selecao de destinatarios</p>
                    <p className="mt-2 text-sm text-muted-foreground">Escolha alunos individualmente ou aplique grupos prontos antes de seguir.</p>
                  </div>
                  <div className="rounded-full border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium text-foreground">
                    {selected.size} selecionado(s)
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-border bg-card/70 p-5 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-2xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      Grupos de disparo
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Aplique grupos salvos ou abra o gerenciador para montar conjuntos reutilizaveis.</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-11 w-full gap-2 rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => setGroupDialogOpen(true)}>
                    <Settings2 className="h-4 w-4" />
                    Gerenciar Grupos
                  </Button>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {groupsLoading ? (
                    <div className="rounded-[20px] border border-border/70 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">Carregando grupos...</div>
                  ) : groups.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-border bg-secondary/20 px-4 py-4 text-sm text-muted-foreground">Nenhum grupo salvo ainda. Selecione destinatarios e salve um grupo para reutilizar depois.</div>
                  ) : (
                    groups.map((group) => (
                      <button key={group.id} type="button" onClick={() => applyGroup(group)} className="flex items-center justify-between rounded-[20px] border border-border/70 bg-secondary/25 px-4 py-3 text-left transition-colors hover:border-primary/25 hover:bg-primary/8">
                        <span>
                          <span className="block text-sm font-medium text-foreground">{group.nome}</span>
                          <span className="block text-xs text-muted-foreground">{group.memberIds.length} membro(s){group.descricao ? ` • ${group.descricao}` : ""}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="rounded-[28px] border border-border bg-card/70 p-6 text-muted-foreground shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-2xl">Carregando alunos...</div>
            ) : (
              <RecipientSelector alunos={alunos} selected={selected} onSelectionChange={setSelected} onUpdateContact={handleUpdateContact} />
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep("compose")} className="h-11 w-full gap-2 rounded-xl sm:h-10 sm:w-auto sm:rounded-md">
                <ArrowLeft className="h-4 w-4" /> Voltar para mensagem
              </Button>
              <Button onClick={() => setStep("preview")} disabled={!canProceedRecipients} className="h-11 w-full gap-2 rounded-xl sm:h-10 sm:w-auto sm:rounded-md">
                Pre-visualizar envio <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="grid gap-5 2xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-border bg-card/70 p-5 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Checklist do disparo</p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-[20px] border border-border/70 bg-secondary/30 p-4">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Assunto</span>
                    <p className="mt-2 text-sm font-medium text-foreground">{titulo}</p>
                  </div>
                  <div className="rounded-[20px] border border-border/70 bg-secondary/30 p-4">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Canais</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {channels.has("email") && <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary"><Mail className="h-3 w-3" /> E-mail</span>}
                      {channels.has("whatsapp") && <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary"><MessageCircle className="h-3 w-3" /> WhatsApp</span>}
                      {channels.has("telegram") && <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary"><MessageCircle className="h-3 w-3" /> Telegram</span>}
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-border/70 bg-secondary/30 p-4">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Destinatarios</span>
                    <p className="mt-2 text-sm text-foreground">{selectedAlunos.length} aluno(s) selecionado(s)</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedAlunos.slice(0, 10).map((a) => (
                        <span key={a.user_id} className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-foreground">
                          {a.nome} {a.sobrenome || ""}
                        </span>
                      ))}
                      {selectedAlunos.length > 10 && <span className="text-xs text-muted-foreground">+{selectedAlunos.length - 10} mais</span>}
                    </div>
                  </div>
                </div>
              </div>

              {channels.has("email") && selectedWithoutEmail.length > 0 && <div className="rounded-[24px] border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100 sm:rounded-2xl">{selectedWithoutEmail.length} destinatario(s) selecionado(s) estao sem e-mail cadastrado.</div>}
              {channels.has("whatsapp") && selectedWithoutPhone.length > 0 && <div className="rounded-[24px] border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100 sm:rounded-2xl">{selectedWithoutPhone.length} destinatario(s) selecionado(s) estao sem telefone cadastrado.</div>}
            </div>

            <div className="rounded-[28px] border border-border bg-card/70 p-5 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-2xl">
              <div className="flex items-center justify-between gap-3 rounded-[22px] border border-border bg-secondary/30 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pre-visualizacao</p>
                  <p className="text-sm text-foreground">Confira o disparo final antes de enviar.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => setStep("recipients")}>Voltar</Button>
              </div>

              <div className="mt-4 rounded-[24px] border border-white/10 bg-black/15 p-4">
                <div className="space-y-4">
                  {Array.from(channels).map((channel) => (
                    <div key={channel} className="rounded-[20px] border border-white/10 bg-black/10 p-3">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {channel === "email" ? "E-mail" : channel === "telegram" ? "Telegram" : "WhatsApp"}
                      </div>
                      <div className="mx-auto max-w-full overflow-hidden text-sm [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl" dangerouslySetInnerHTML={{ __html: previewByChannel[channel] }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setStep("recipients")} className="h-11 w-full gap-2 rounded-xl sm:h-10 sm:w-auto sm:rounded-md">
                  <ArrowLeft className="h-4 w-4" /> Voltar para destinatarios
                </Button>
                <Button onClick={handleSend} disabled={sending} className="h-11 w-full gap-2 rounded-xl sm:h-10 sm:w-auto sm:rounded-md">
                  <Send className="h-4 w-4" />
                  {sending ? "Enviando..." : `Enviar para ${selected.size} aluno(s)`}
                </Button>
              </div>
            </div>
          </div>
        )}

        </div>

        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogContent className="border-border bg-card sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground">Grupos de disparo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nome do grupo" />
                <Input value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} placeholder="Descrição opcional" />
                <Button onClick={handleSaveGroup} disabled={savingGroup || selected.size === 0}>
                  {savingGroup ? "Salvando..." : "Salvar Grupo Atual"}
                </Button>
              </div>
              <div className="rounded-[24px] border border-border divide-y divide-border sm:rounded-lg">
                {groupsLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">Carregando grupos...</div>
                ) : groups.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">Nenhum grupo salvo ainda.</div>
                ) : (
                  groups.map((group) => (
                    <div key={group.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{group.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.memberIds.length} membro(s){group.descricao ? ` • ${group.descricao}` : ""}
                        </p>
                      </div>
                      <div className="flex w-full gap-2 sm:w-auto">
                        <Button size="sm" variant="outline" className="h-10 flex-1 rounded-xl sm:h-9 sm:flex-none sm:rounded-md" onClick={() => applyGroup(group)}>
                          Aplicar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive sm:h-9 sm:w-9 sm:rounded-md">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">Apagar grupo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O grupo "{group.nome}" será removido. Isso não apaga mensagens já enviadas.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteGroup(group.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deletingGroupId === group.id ? "Apagando..." : "Apagar"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Dica: selecione os destinatários abaixo e use "Salvar Grupo Atual" para reutilizar esse conjunto depois.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default DispararMensagemDialog;







