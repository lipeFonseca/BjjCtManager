import { useEffect, useMemo, useRef, useState } from "react";
import { mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Type,
  Link as LinkIcon,
  Smile,
  ImagePlus,
  PenLine,
  Save,
  Trash2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface Props {
  ctId: string;
  content: string;
  onChange: (html: string) => void;
}

type ImageAlignment = "left" | "center" | "right";
type ImageSizeMode = "small" | "optimized" | "original";

const EMOJIS = ["😀", "😁", "😉", "😊", "👏", "🔥", "✅", "📣", "📅", "📌", "🙏", "🥋"];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildSignatureHtml = (signatureName: string, signatureSubtitle: string) => `
  <div data-bjj-signature="true" style="margin-top:16px; padding-top:12px; border-top:1px solid #e8eaed; color:#5f6368;">
    <p style="margin:0;"><strong style="font-size:14px; color:#202124;">${escapeHtml(signatureName)}</strong></p>
    <p style="margin:4px 0 0; font-size:12px; color:#8a8f99;">${escapeHtml(signatureSubtitle)}</p>
  </div>
`;

const buildAutoNoticeHtml = (autoNoticeMessage: string) => `
  <div data-bjj-auto-notice="true" style="display:inline-block; margin:0 0 18px; padding:8px 14px; border:1px solid #d7dde6; border-radius:999px; background:#f7f8fa; color:#5b6472; font-size:12px; font-weight:500; line-height:1.45;">
    ${autoNoticeMessage}
  </div>
`;

const AUTO_NOTICE_ENABLED_KEY = "mensageria_auto_notice_enabled";
const AUTO_NOTICE_MESSAGE_KEY = "mensageria_auto_notice_message";
const DEFAULT_AUTO_NOTICE_MESSAGE = "Mensagem automatica. Nao responda este e-mail.";

const buildDirectMessageHtml = (
  editorHtml: string,
  autoNoticeEnabled: boolean,
  autoNoticeMessage: string,
  signatureEnabled: boolean,
  signatureName: string,
  signatureSubtitle: string,
) => {
  const body = editorHtml.trim();
  return [
    autoNoticeEnabled ? buildAutoNoticeHtml(autoNoticeMessage.trim() || DEFAULT_AUTO_NOTICE_MESSAGE) : "",
    body,
    signatureEnabled ? buildSignatureHtml(signatureName, signatureSubtitle) : "",
  ]
    .filter(Boolean)
    .join("");
};

const MessageImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widthPercent: {
        default: 100,
        parseHTML: (element) => Number(element.getAttribute("data-width-percent") || 100),
        renderHTML: (attributes) => ({
          "data-width-percent": attributes.widthPercent,
        }),
      },
      alignment: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-alignment") || "center",
        renderHTML: (attributes) => ({
          "data-alignment": attributes.alignment,
        }),
      },
      sizeMode: {
        default: "optimized",
        parseHTML: (element) => element.getAttribute("data-size-mode") || "optimized",
        renderHTML: (attributes) => ({
          "data-size-mode": attributes.sizeMode,
        }),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const widthPercent = Number(HTMLAttributes.widthPercent || 100);
    const alignment = HTMLAttributes.alignment || "center";
    const sizeMode = HTMLAttributes.sizeMode || "optimized";
    const margin =
      alignment === "left"
        ? "12px auto 12px 0"
        : alignment === "right"
          ? "12px 0 12px auto"
          : "12px auto";
    const maxWidth = sizeMode === "small" ? "260px" : sizeMode === "optimized" ? "560px" : "680px";
    const computedWidth =
      sizeMode === "small" ? Math.min(widthPercent, 40) : sizeMode === "optimized" ? Math.min(widthPercent, 78) : widthPercent;
    const widthStyle = sizeMode === "original" ? "width:auto;" : `width:${computedWidth}%;`;

    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        style: `display:block; ${widthStyle} max-width:min(100%, ${maxWidth}); height:auto; margin:${margin}; border-radius:16px; box-sizing:border-box;`,
      }),
    ];
  },
});

const DirectMessageComposer = ({ ctId, content, onChange }: Props) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingAutoNotice, setSavingAutoNotice] = useState(false);
  const [defaultAutoNoticeEnabled, setDefaultAutoNoticeEnabled] = useState(true);
  const [defaultAutoNoticeMessage, setDefaultAutoNoticeMessage] = useState(DEFAULT_AUTO_NOTICE_MESSAGE);
  const [formattingOpen, setFormattingOpen] = useState(false);
  const [autoNoticeEnabled, setAutoNoticeEnabled] = useState(true);
  const [autoNoticeMessage, setAutoNoticeMessage] = useState(DEFAULT_AUTO_NOTICE_MESSAGE);
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  const [signatureName, setSignatureName] = useState("Equipe BJJ Manager");
  const [signatureSubtitle, setSignatureSubtitle] = useState("Mensagem enviada pela central de mensageria do CT.");
  const [selectedImageWidth, setSelectedImageWidth] = useState(72);
  const [selectedImageAlignment, setSelectedImageAlignment] = useState<ImageAlignment>("center");
  const [selectedImageSizeMode, setSelectedImageSizeMode] = useState<ImageSizeMode>("optimized");
  const [imageControlsVisible, setImageControlsVisible] = useState(false);
  const [selectedImagePos, setSelectedImagePos] = useState<number | null>(null);
  const [editorMinHeight, setEditorMinHeight] = useState(260);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: "https",
      }),
      MessageImage,
      Placeholder.configure({
        placeholder: "Escreva a mensagem do disparo...",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: "",
    onUpdate: ({ editor: currentEditor }) => {
      onChange(
        buildDirectMessageHtml(
          currentEditor.getHTML(),
          autoNoticeEnabled,
          autoNoticeMessage,
          signatureEnabled,
          signatureName,
          signatureSubtitle,
        ),
      );
    },
    editorProps: {
      attributes: {
        class:
          "px-6 py-5 text-[15px] leading-7 text-foreground focus:outline-none [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_p]:mb-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl",
        style: `min-height:${editorMinHeight}px;`,
      },
      handleClickOn(view, _pos, node, nodePos) {
        if (node.type.name !== "image") return false;
        const transaction = view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos));
        view.dispatch(transaction);
        return true;
      },
      handlePaste(view, event) {
        const clipboardItems = Array.from(event.clipboardData?.items || []);
        const imageItem = clipboardItems.find((item) => item.type.startsWith("image/"));
        if (!imageItem) return false;

        const file = imageItem.getAsFile();
        if (!file) return false;

        event.preventDefault();

        void (async () => {
          const url = await uploadImage(file);
          if (!url) return;

          const transaction = view.state.tr.replaceSelectionWith(
            view.state.schema.nodes.image.create({
              src: url,
              alt: file.name || "imagem-colada",
              widthPercent: 72,
              alignment: "center",
              sizeMode: "optimized",
            }),
          );
          view.dispatch(transaction);
          toast.success("Imagem colada no disparo");
        })();

        return true;
      },
    },
    immediatelyRender: false,
  }, [autoNoticeEnabled, autoNoticeMessage, editorMinHeight, signatureEnabled, signatureName, signatureSubtitle]);

  const finalHtml = useMemo(
    () =>
      buildDirectMessageHtml(
        editor?.getHTML() || "",
        autoNoticeEnabled,
        autoNoticeMessage,
        signatureEnabled,
        signatureName,
        signatureSubtitle,
      ),
    [autoNoticeEnabled, autoNoticeMessage, editor, signatureEnabled, signatureName, signatureSubtitle],
  );

  useEffect(() => {
    onChange(finalHtml);
  }, [finalHtml, onChange]);

  useEffect(() => {
    let cancelled = false;

    const loadAutoNoticeSettings = async () => {
      const { data, error } = await supabase
        .from("webhook_config")
        .select("id, config_key, config_value, updated_at")
        .eq("ct_id", ctId)
        .in("config_key", [AUTO_NOTICE_ENABLED_KEY, AUTO_NOTICE_MESSAGE_KEY])
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Erro ao carregar aviso automatico:", error);
        setSettingsLoaded(true);
        return;
      }

      const latestByKey = new Map<string, { id: string; config_value: string }>();
      const duplicateIds: string[] = [];

      for (const row of data || []) {
        if (!latestByKey.has(row.config_key)) {
          latestByKey.set(row.config_key, { id: row.id, config_value: row.config_value || "" });
        } else {
          duplicateIds.push(row.id);
        }
      }

      if (duplicateIds.length > 0) {
        const { error: deleteError } = await supabase.from("webhook_config").delete().in("id", duplicateIds);
        if (deleteError) {
          console.error("Erro ao limpar configuracoes duplicadas do aviso automatico:", deleteError);
        }
      }

      const savedEnabled = latestByKey.get(AUTO_NOTICE_ENABLED_KEY)?.config_value;
      const savedMessage = latestByKey.get(AUTO_NOTICE_MESSAGE_KEY)?.config_value;
      const nextEnabled = savedEnabled ? savedEnabled === "true" : true;
      const nextMessage = savedMessage?.trim() || DEFAULT_AUTO_NOTICE_MESSAGE;

      setDefaultAutoNoticeEnabled(nextEnabled);
      setDefaultAutoNoticeMessage(nextMessage);
      setAutoNoticeEnabled(nextEnabled);
      setAutoNoticeMessage(nextMessage);
      setSettingsLoaded(true);
    };

    void loadAutoNoticeSettings();

    return () => {
      cancelled = true;
    };
  }, [ctId]);

  const handleSaveAutoNoticeDefaults = async () => {
    setSavingAutoNotice(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      toast.error("Nao foi possivel identificar o usuario para salvar o aviso.");
      setSavingAutoNotice(false);
      return;
    }

    const normalizedMessage = autoNoticeMessage.trim() || DEFAULT_AUTO_NOTICE_MESSAGE;
    const normalizedEnabled = autoNoticeEnabled ? "true" : "false";

    const { data: existingRows, error: existingError } = await supabase
      .from("webhook_config")
      .select("id, config_key, updated_at")
      .eq("ct_id", ctId)
      .in("config_key", [AUTO_NOTICE_ENABLED_KEY, AUTO_NOTICE_MESSAGE_KEY])
      .order("updated_at", { ascending: false });

    if (existingError) {
      toast.error("Erro ao localizar a configuracao atual do aviso.");
      console.error(existingError);
      setSavingAutoNotice(false);
      return;
    }

    const latestByKey = new Map<string, string>();
    const duplicateIds: string[] = [];

    for (const row of existingRows || []) {
      if (!latestByKey.has(row.config_key)) {
        latestByKey.set(row.config_key, row.id);
      } else {
        duplicateIds.push(row.id);
      }
    }

    if (duplicateIds.length > 0) {
      const { error: deleteError } = await supabase.from("webhook_config").delete().in("id", duplicateIds);
      if (deleteError) {
        toast.error("Erro ao substituir configuracoes antigas do aviso.");
        console.error(deleteError);
        setSavingAutoNotice(false);
        return;
      }
    }

    const operations = [
      { key: AUTO_NOTICE_ENABLED_KEY, value: normalizedEnabled },
      { key: AUTO_NOTICE_MESSAGE_KEY, value: normalizedMessage },
    ];

    for (const operation of operations) {
      const existingId = latestByKey.get(operation.key);

      if (existingId) {
        const { error: updateError } = await supabase
          .from("webhook_config")
          .update({
            config_value: operation.value,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingId);

        if (updateError) {
          toast.error("Erro ao atualizar o aviso automatico.");
          console.error(updateError);
          setSavingAutoNotice(false);
          return;
        }
      } else {
        const { error: insertError } = await supabase.from("webhook_config").insert({
          ct_id: ctId,
          config_key: operation.key,
          config_value: operation.value,
          updated_by: user.id,
        });

        if (insertError) {
          toast.error("Erro ao salvar o novo aviso automatico.");
          console.error(insertError);
          setSavingAutoNotice(false);
          return;
        }
      }
    }

    setDefaultAutoNoticeEnabled(autoNoticeEnabled);
    setDefaultAutoNoticeMessage(normalizedMessage);
    setAutoNoticeMessage(normalizedMessage);
    toast.success("Aviso automatico salvo como padrao.");
    setSavingAutoNotice(false);
  };

  useEffect(() => {
    if (!editor) return;
    if (!content) {
      if (editor.getHTML() !== "<p></p>") {
        editor.commands.setContent("");
      }
      if (settingsLoaded) {
        setAutoNoticeEnabled(defaultAutoNoticeEnabled);
        setAutoNoticeMessage(defaultAutoNoticeMessage);
      }
      setSignatureEnabled(false);
      setSignatureName("Equipe BJJ Manager");
      setSignatureSubtitle("Mensagem enviada pela central de mensageria do CT.");
      setSelectedImageWidth(72);
      setSelectedImageAlignment("center");
      setSelectedImageSizeMode("optimized");
      setImageControlsVisible(false);
      setSelectedImagePos(null);
      setEditorMinHeight(260);
    }
  }, [content, defaultAutoNoticeEnabled, defaultAutoNoticeMessage, editor, settingsLoaded]);

  useEffect(() => {
    if (!editor) return;

    const syncImageControls = () => {
      const { selection } = editor.state;
      const isNodeSelection = selection instanceof NodeSelection;
      const selectedNode = isNodeSelection ? selection.node : null;
      const isImageActive = Boolean(selectedNode && selectedNode.type.name === "image");
      setImageControlsVisible(isImageActive);
      if (!isImageActive || !selectedNode) {
        setSelectedImagePos(null);
        return;
      }

      setSelectedImagePos(selection.from);

      const attrs = selectedNode.attrs as {
        widthPercent?: number;
        alignment?: ImageAlignment;
        sizeMode?: ImageSizeMode;
      };
      setSelectedImageWidth(Number(attrs.widthPercent || 72));
      setSelectedImageAlignment((attrs.alignment as ImageAlignment) || "center");
      setSelectedImageSizeMode((attrs.sizeMode as ImageSizeMode) || "optimized");
    };

    syncImageControls();
    editor.on("selectionUpdate", syncImageControls);
    editor.on("transaction", syncImageControls);

    return () => {
      editor.off("selectionUpdate", syncImageControls);
      editor.off("transaction", syncImageControls);
    };
  }, [editor]);

  const uploadImage = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return null;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
    const path = `mensagens/${ctId}/imagens/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("ct-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Erro ao enviar imagem");
      return null;
    }

    const { data } = supabase.storage.from("ct-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor) return;

    const url = await uploadImage(file);
    if (!url) return;

    editor
      .chain()
      .focus()
      .setImage({ src: url, alt: file.name, widthPercent: 72, alignment: "center", sizeMode: "optimized" })
      .run();
    toast.success("Imagem inserida");
  };

  const handleInsertLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Cole a URL do link:", previousUrl || "https://");

    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim(), target: "_blank" }).run();
  };

  const updateSelectedImage = (
    attrs: Partial<{ widthPercent: number; alignment: ImageAlignment; sizeMode: ImageSizeMode; alt: string }>,
  ) => {
    if (!editor || selectedImagePos === null) return;

    const node = editor.state.doc.nodeAt(selectedImagePos) as ProseMirrorNode | null;
    if (!node || node.type.name !== "image") return;

    const transaction = editor.state.tr.setNodeMarkup(selectedImagePos, undefined, {
      ...node.attrs,
      ...attrs,
    });

    transaction.setSelection(NodeSelection.create(transaction.doc, selectedImagePos));
    editor.view.dispatch(transaction);
  };

  const ToolbarButton = ({
    onClick,
    title,
    active = false,
    children,
  }: {
    onClick: () => void;
    title: string;
    active?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
        active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  const autoNoticePanel = (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Aviso automatico</p>
          <p className="mt-1 text-sm text-foreground">
            Defina um padrao salvo no banco e ligue ou desligue esse aviso em cada disparo quando precisar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={autoNoticeEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoNoticeEnabled((prev) => !prev)}
          >
            {autoNoticeEnabled ? "Aviso ativo" : "Ativar aviso"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleSaveAutoNoticeDefaults()} disabled={savingAutoNotice}>
            <Save className="mr-2 h-4 w-4" />
            {savingAutoNotice ? "Salvando..." : "Salvar padrao"}
          </Button>
        </div>
      </div>
      <Input
        value={autoNoticeMessage}
        onChange={(e) => setAutoNoticeMessage(e.target.value)}
        placeholder={DEFAULT_AUTO_NOTICE_MESSAGE}
        className="mt-3 bg-background"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Padrao salvo: {defaultAutoNoticeEnabled ? "ativo" : "desativado"}.
      </p>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-2xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3">
        <ToolbarButton onClick={() => setFormattingOpen((prev) => !prev)} title="Opções de formatação" active={formattingOpen}>
          <Type className="h-5 w-5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setEditorMinHeight((prev) => Math.max(220, prev - 120))} title="Recolher área da mensagem">
          <Minimize2 className="h-5 w-5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setEditorMinHeight((prev) => Math.min(960, prev + 120))} title="Esticar área da mensagem">
          <Maximize2 className="h-5 w-5" />
        </ToolbarButton>
        <ToolbarButton onClick={handleInsertLink} title="Inserir link">
          <LinkIcon className="h-5 w-5" />
        </ToolbarButton>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Inserir emoji"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Smile className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-md text-lg hover:bg-accent"
                  onClick={() => editor?.chain().focus().insertContent(emoji).run()}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <ToolbarButton onClick={() => imageInputRef.current?.click()} title="Inserir foto">
          <ImagePlus className="h-5 w-5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            const nextValue = !autoNoticeEnabled;
            setAutoNoticeEnabled(nextValue);
            toast.success(nextValue ? "Aviso de não resposta ativado" : "Aviso de não resposta removido");
          }}
          title="Aviso automático de não resposta"
          active={autoNoticeEnabled}
        >
          <Type className="h-5 w-5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            const nextValue = !signatureEnabled;
            setSignatureEnabled(nextValue);
            toast.success(nextValue ? "Assinatura ativada no e-mail" : "Assinatura removida do e-mail");
          }}
          title="Assinatura do e-mail"
          active={signatureEnabled}
        >
          <PenLine className="h-5 w-5" />
        </ToolbarButton>
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <div className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Editor do disparo
        </div>
        <div className="ml-auto">
          <ToolbarButton
            onClick={() => {
              editor?.commands.setContent("");
              setSignatureEnabled(false);
            }}
            title="Limpar mensagem"
          >
            <Trash2 className="h-5 w-5" />
          </ToolbarButton>
        </div>
      </div>

      {formattingOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
          <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} title="Negrito" active={!!editor?.isActive("bold")}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()} title="Itálico" active={!!editor?.isActive("italic")}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Sublinhado" active={!!editor?.isActive("underline")}>
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} title="Título grande" active={!!editor?.isActive("heading", { level: 1 })}>
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Título médio" active={!!editor?.isActive("heading", { level: 2 })}>
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().setTextAlign("left").run()} title="Alinhar à esquerda" active={!!editor?.isActive({ textAlign: "left" })}>
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().setTextAlign("center").run()} title="Centralizar" active={!!editor?.isActive({ textAlign: "center" })}>
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().setTextAlign("right").run()} title="Alinhar à direita" active={!!editor?.isActive({ textAlign: "right" })}>
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
        </div>
      )}

      {imageControlsVisible && (
        <div className="border-b border-border bg-secondary/30 px-6 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Imagem selecionada</p>
              <p className="text-sm text-foreground">Ajuste tamanho e posição antes de enviar.</p>
            </div>
            <div className="flex items-center gap-2">
              <ToolbarButton
                onClick={() => {
                  setSelectedImageAlignment("left");
                  updateSelectedImage({ alignment: "left" });
                }}
                title="Alinhar imagem à esquerda"
                active={selectedImageAlignment === "left"}
              >
                <AlignLeft className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => {
                  setSelectedImageAlignment("center");
                  updateSelectedImage({ alignment: "center" });
                }}
                title="Centralizar imagem"
                active={selectedImageAlignment === "center"}
              >
                <AlignCenter className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => {
                  setSelectedImageAlignment("right");
                  updateSelectedImage({ alignment: "right" });
                }}
                title="Alinhar imagem à direita"
                active={selectedImageAlignment === "right"}
              >
                <AlignRight className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelectedImageSizeMode("small");
                  setSelectedImageWidth(40);
                  updateSelectedImage({ sizeMode: "small", widthPercent: 40 });
                }}
                className={`rounded-full px-3 py-1 transition-colors ${selectedImageSizeMode === "small" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                Pequena
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelectedImageSizeMode("optimized");
                  setSelectedImageWidth(72);
                  updateSelectedImage({ sizeMode: "optimized", widthPercent: 72 });
                }}
                className={`rounded-full px-3 py-1 transition-colors ${selectedImageSizeMode === "optimized" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                Otimizada
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelectedImageSizeMode("original");
                  setSelectedImageWidth(100);
                  updateSelectedImage({ sizeMode: "original", widthPercent: 100 });
                }}
                className={`rounded-full px-3 py-1 transition-colors ${selectedImageSizeMode === "original" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                Original
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (editor && selectedImagePos !== null) {
                    const node = editor.state.doc.nodeAt(selectedImagePos);
                    if (node) {
                      const transaction = editor.state.tr.delete(selectedImagePos, selectedImagePos + node.nodeSize);
                      editor.view.dispatch(transaction);
                    }
                  }
                  setImageControlsVisible(false);
                  setSelectedImagePos(null);
                  toast.success("Imagem removida");
                }}
                className="rounded-full px-3 py-1 text-destructive transition-colors hover:bg-destructive/10"
              >
                Remover
              </button>
            </div>
            {selectedImageSizeMode !== "original" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-foreground">
                  <span>Largura da imagem</span>
                  <span>{selectedImageWidth}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={selectedImageWidth}
                  onChange={(e) => {
                    const nextValue = Number(e.target.value);
                    setSelectedImageWidth(nextValue);
                    updateSelectedImage({ widthPercent: nextValue });
                  }}
                  className="w-full accent-primary"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-background">
        <EditorContent editor={editor} />
      </div>

      {signatureEnabled && (
        <div className="border-t border-border bg-secondary/20 px-6 py-4">
          <div className="mb-4">{autoNoticePanel}</div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Assinatura do e-mail</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Nome da assinatura"
              className="bg-background"
            />
            <Input
              value={signatureSubtitle}
              onChange={(e) => setSignatureSubtitle(e.target.value)}
              placeholder="Descrição da assinatura"
              className="bg-background"
            />
          </div>
        </div>
      )}

      {!signatureEnabled && (
        <div className="border-t border-border bg-secondary/20 px-6 py-4">
          {autoNoticePanel}
        </div>
      )}

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </div>
  );
};

export default DirectMessageComposer;
