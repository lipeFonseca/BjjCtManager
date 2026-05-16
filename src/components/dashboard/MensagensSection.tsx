import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, MessageSquare, Plus, Trash2, Megaphone, Pencil, ChevronDown, ChevronUp } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DispararMensagemDialog from "./mensagens/DispararMensagemDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import RichTextEditor from "./mensagens/RichTextEditor";
import ComunicadoComposer from "./mensagens/ComunicadoComposer";
import { renderComunicadoEmailHtml } from "./mensagens/templateBranding";
import { sanitizeHtmlDocument, sanitizeHtmlFragment } from "@/lib/htmlSecurity";

interface Mensagem {
  id: string;
  titulo: string;
  conteudo: string;
  created_at: string;
  remetente_id: string;
  ct_id: string;
  tipo: "comunicado" | "disparo";
  remetente_nome?: string;
}

interface MensagensSectionProps {
  role: "admin" | "mestre" | "aluno";
  userId: string;
  ctId?: string;
}

type MensagensView = "comunicados" | "disparos";
const mapWithSender = (items: Mensagem[], profileMap: Map<string, string>) =>
  items.map((m) => ({
    ...m,
    remetente_nome: profileMap.get(m.remetente_id) || "Desconhecido",
  }));

const MensagensSection = ({ role, userId, ctId: propCtId }: MensagensSectionProps) => {
  const [comunicados, setComunicados] = useState<Mensagem[]>([]);
  const [disparos, setDisparos] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<MensagensView>("comunicados");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dispararOpen, setDispararOpen] = useState(false);
  const [ctId, setCtId] = useState<string | null>(propCtId || null);
  const [editingMsg, setEditingMsg] = useState<Mensagem | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editConteudo, setEditConteudo] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const canSend = role === "mestre" || role === "admin";
  const visibleMensagens = activeView === "comunicados" ? comunicados : disparos;

  useEffect(() => {
    const init = async () => {
      if (propCtId) {
        setCtId(propCtId);
        await fetchMensagens(propCtId);
        setLoading(false);
        return;
      }

      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("ct_id").eq("user_id", userId).single();

      if (profile?.ct_id) {
        setCtId(profile.ct_id);
        await fetchMensagens(profile.ct_id);
      }
      setLoading(false);
    };

    void init();
  }, [userId, propCtId]);

  const fetchMensagens = async (ct: string) => {
    const { data, error } = await supabase
      .from("mensagens")
      .select("*")
      .eq("ct_id", ct)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar mensagens");
      return;
    }

    const allMensagens = (data || []) as Mensagem[];
    const senderIds = [...new Set(allMensagens.map((m) => m.remetente_id))].filter(Boolean);
    let profiles: Array<{ user_id: string; nome: string; sobrenome: string | null }> = [];

    if (senderIds.length > 0) {
      const { data: profileData } = await supabase.from("profiles").select("user_id, nome, sobrenome").in("user_id", senderIds);
      profiles = profileData || [];
    }

    const profileMap = new Map(profiles.map((p) => [p.user_id, `${p.nome} ${p.sobrenome || ""}`.trim()]));
    const comunicadosData = allMensagens.filter((m) => (m.tipo || "comunicado") !== "disparo");
    const disparosData = allMensagens.filter((m) => m.tipo === "disparo");

    setComunicados(mapWithSender(comunicadosData, profileMap));
    setDisparos(mapWithSender(disparosData, profileMap));
  };

  const handleSend = async () => {
    if (!titulo.trim() || !conteudo.trim() || !ctId) return;
    setSending(true);

    const renderedConteudo = renderComunicadoEmailHtml(conteudo, titulo.trim());

    const { error } = await supabase.from("mensagens").insert({
      titulo: titulo.trim(),
      conteudo: renderedConteudo,
      remetente_id: userId,
      ct_id: ctId,
      tipo: "comunicado",
    });

    if (error) {
      toast.error("Erro ao enviar mensagem");
      console.error(error);
    } else {
      toast.success("Comunicado enviado com sucesso!");
      setTitulo("");
      setConteudo("");
      setDialogOpen(false);
      await fetchMensagens(ctId);
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("mensagens").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir mensagem");
    } else {
      toast.success("Mensagem excluída");
      if (ctId) await fetchMensagens(ctId);
    }
  };

  const handleDeleteAll = async () => {
    if (!ctId) return;
    setDeletingAll(true);

    const { error } = await supabase.from("mensagens").delete().eq("ct_id", ctId);

    if (error) {
      toast.error("Erro ao apagar toda a mensageria");
      console.error(error);
    } else {
      toast.success("Toda a mensageria foi apagada");
      await fetchMensagens(ctId);
    }

    setDeletingAll(false);
  };

  const openEdit = (msg: Mensagem) => {
    setEditingMsg(msg);
    setEditTitulo(msg.titulo);
    setEditConteudo(msg.conteudo);
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingMsg || !editTitulo.trim() || !editConteudo.trim()) return;
    setUpdating(true);
    const { error } = await supabase
      .from("mensagens")
      .update({ titulo: editTitulo.trim(), conteudo: editConteudo.trim() })
      .eq("id", editingMsg.id);

    if (error) {
      toast.error("Erro ao editar comunicado");
    } else {
      toast.success("Comunicado atualizado!");
      setEditDialogOpen(false);
      setEditingMsg(null);
      if (ctId) await fetchMensagens(ctId);
    }
    setUpdating(false);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openNewComunicado = () => {
    setTitulo("");
    setConteudo("");
    setDialogOpen(true);
  };

  const discardNewComunicado = () => {
    setTitulo("");
    setConteudo("");
    setDialogOpen(false);
  };

  if (loading) {
    return <div className="text-muted-foreground animate-pulse">Carregando mensagens...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 rounded-[24px] border border-border/70 bg-card/70 p-5 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:flex-row sm:items-start sm:justify-between sm:rounded-lg sm:p-6">
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-heading text-foreground">
            <MessageSquare className="h-5 w-5 text-primary" />
            Mensageria
          </h2>
          <div className="grid w-full grid-cols-2 rounded-2xl border border-border bg-card p-1 sm:inline-flex sm:w-auto sm:rounded-lg">
            <button
              type="button"
              onClick={() => setActiveView("comunicados")}
              className={`rounded-xl px-3 py-2 text-sm transition-colors sm:rounded-md sm:py-1.5 ${
                activeView === "comunicados" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Comunicados
            </button>
            <button
              type="button"
              onClick={() => setActiveView("disparos")}
              className={`rounded-xl px-3 py-2 text-sm transition-colors sm:rounded-md sm:py-1.5 ${
                activeView === "disparos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Disparos
            </button>
          </div>
        </div>
        {canSend && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="h-11 w-full justify-center gap-2 rounded-xl sm:h-9 sm:w-auto sm:rounded-md" disabled={!ctId || deletingAll}>
                  <Trash2 className="h-4 w-4" />
                  {deletingAll ? "Apagando..." : "Apagar Tudo"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Apagar toda a mensageria?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação remove todos os comunicados e disparos deste CT. Os destinatários vinculados aos disparos também serão removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Apagar Tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button size="sm" variant="outline" className="h-11 w-full justify-center gap-2 rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => setDispararOpen(true)}>
              <Megaphone className="h-4 w-4" />
              Disparar Mensagem
            </Button>

            <Button size="sm" className="h-11 w-full justify-center gap-2 rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={openNewComunicado}>
              <Plus className="h-4 w-4" />
              Novo Comunicado
            </Button>
          </div>
        )}
      </div>

      {ctId && (
        <DispararMensagemDialog
          open={dispararOpen}
          onOpenChange={setDispararOpen}
          ctId={ctId}
          userId={userId}
          onSent={() => fetchMensagens(ctId)}
        />
      )}

      {visibleMensagens.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{activeView === "comunicados" ? "Nenhum comunicado ainda." : "Nenhum disparo disponível para você."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleMensagens.map((msg) => {
            const expanded = expandedIds.has(msg.id);
            const safeDocumentContent = sanitizeHtmlDocument(msg.conteudo);
            const safeFragmentContent = sanitizeHtmlFragment(msg.conteudo);
            return (
              <div
                key={msg.id}
                className={`rounded-2xl border shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] transition-all ${
                  activeView === "comunicados"
                    ? "border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-card to-card"
                    : "border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(msg.id)}
                  className="flex w-full flex-col gap-4 p-5 text-left sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p
                      className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] ${
                        activeView === "comunicados" ? "text-orange-300" : "text-emerald-300"
                      }`}
                    >
                      {activeView === "comunicados" ? "Comunicado" : "Disparo"}
                    </p>
                    <h3 className="font-heading text-base text-foreground sm:truncate">{msg.titulo}</h3>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      Por {msg.remetente_nome} • {format(new Date(msg.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-start">
                    {activeView === "comunicados" && (role === "admin" || (role === "mestre" && msg.remetente_id === userId)) && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary sm:h-8 sm:w-8 sm:rounded-md" onClick={() => openEdit(msg)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive sm:h-8 sm:w-8 sm:rounded-md">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">Excluir comunicado</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir este comunicado? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(msg.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                    {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </button>

                {expanded && (
                  <div className="px-5 pb-5 sm:px-6">
                    {msg.conteudo.includes("<") ? (
                      activeView === "comunicados" ? (
                        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/5">
                          <iframe
                            srcDoc={safeDocumentContent}
                            className="w-full border-0 rounded-2xl"
                            style={{ minHeight: "300px" }}
                            title={msg.titulo}
                            sandbox={{ allow: ["same-origin"] }}
                          />
                        </div>
                      ) : (
                        <div
                          className="rounded-2xl border border-white/10 bg-black/15 p-4 max-w-none overflow-hidden text-sm [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_li]:marker:text-emerald-300"
                          dangerouslySetInnerHTML={{
                            __html: safeFragmentContent,
                          }}
                        />
                      )
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-7">{msg.conteudo}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">Enviar Comunicado</DialogTitle>
          </DialogHeader>
          {ctId && (
            <ComunicadoComposer
              ctId={ctId}
              titulo={titulo}
              onTituloChange={setTitulo}
              content={conteudo}
              onChange={setConteudo}
              sending={sending}
              onSend={handleSend}
              onDiscard={discardNewComunicado}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">Editar Comunicado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Título</label>
              <Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Mensagem</label>
              <RichTextEditor ctId={ctId || ""} content={editConteudo} onChange={setEditConteudo} placeholder="Ajuste o comunicado com o estilo que quiser..." />
            </div>
            <Button onClick={handleUpdate} disabled={updating || !editTitulo.trim() || !editConteudo.trim()} className="w-full gap-2">
              <Send className="h-4 w-4" />
              {updating ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MensagensSection;
