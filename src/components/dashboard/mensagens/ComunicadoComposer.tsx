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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { renderComunicadoPreviewHtml } from "./templateBranding";
import { toast } from "sonner";
import {
  ChevronDown,
  Type,
  Paperclip,
  Link as LinkIcon,
  Smile,
  ImagePlus,
  ShieldAlert,
  PenLine,
  MoreVertical,
  Trash2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Eye,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface Props {
  ctId: string;
  titulo: string;
  onTituloChange: (value: string) => void;
  content: string;
  onChange: (html: string) => void;
  sending: boolean;
  onSend: () => void;
  onDiscard: () => void;
}

interface AttachmentItem {
  name: string;
  url: string;
}

type ComposerStep = "compose" | "preview";
type UrgencyLevel = "normal" | "importante" | "urgente";
type ImageAlignment = "left" | "center" | "right";
type ImageSizeMode = "small" | "optimized" | "original";

interface UrgencyOption {
  value: UrgencyLevel;
  label: string;
  chipClassName: string;
  menuClassName: string;
  htmlBackground: string;
  htmlColor: string;
  htmlBorder: string;
}

const EMOJIS = ["😀", "😁", "😉", "😊", "👏", "🔥", "✅", "📣", "📅", "📌", "🙏", "🥋"];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const URGENCY_OPTIONS: UrgencyOption[] = [
  {
    value: "normal",
    label: "Normal",
    chipClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    menuClassName: "text-emerald-300",
    htmlBackground: "#e6f4ea",
    htmlColor: "#137333",
    htmlBorder: "#a8dab5",
  },
  {
    value: "importante",
    label: "Importante",
    chipClassName: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    menuClassName: "text-amber-300",
    htmlBackground: "#fff4e5",
    htmlColor: "#b06000",
    htmlBorder: "#ffd08a",
  },
  {
    value: "urgente",
    label: "Urgente",
    chipClassName: "border-red-500/30 bg-red-500/10 text-red-300",
    menuClassName: "text-red-300",
    htmlBackground: "#fce8e6",
    htmlColor: "#c5221f",
    htmlBorder: "#f6aea9",
  },
];

const buildAttachmentSectionHtml = (attachments: AttachmentItem[]) => {
  if (attachments.length === 0) return "";

  const items = attachments
    .map(
      (attachment) =>
        `<li style="margin:0 0 6px; font-size:14px;"><a href="${attachment.url}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8; text-decoration:none;">${attachment.name}</a></li>`,
    )
    .join("");

  return `
    <div data-bjj-attachments="true" style="margin-top:12px; padding-top:12px; border-top:1px solid #e8eaed;">
      <p style="margin:0 0 8px; font-size:12px; font-weight:700; color:#5f6368; text-transform:uppercase; letter-spacing:0.05em;">Anexos</p>
      <ul style="margin:0; padding-left:16px;">${items}</ul>
    </div>
  `;
};

const buildConfidentialBannerHtml = () => `
  <div data-bjj-confidential="true" style="margin:0 0 12px; padding:10px 12px; border:1px solid #fbbc04; border-radius:8px; background:#fff7e0; color:#7c4a03; font-size:13px; line-height:1.5;">
    <strong>Modo confidencial ativo.</strong> Evite encaminhar fora do contexto do CT.
  </div>
`;

const buildUrgencyHtml = (option: UrgencyOption) => `
  <div data-bjj-urgency="true" style="margin:5px 0 10px; display:flex; justify-content:center;">
    <span style="display:flex; align-items:center; justify-content:center; width:min(100%, 200px); min-height:36px; padding:0 16px; border-radius:999px; border:1.5px solid ${option.htmlBorder}; background:${option.htmlBackground}; color:${option.htmlColor}; box-sizing:border-box;">
      <span style="display:flex; align-items:center; justify-content:center; width:100%; text-align:center; font-size:15px; line-height:1; font-weight:800; letter-spacing:0.1em; text-transform:uppercase;">
        ${option.label}
      </span>
    </span>
  </div>
`;

const buildSignatureHtml = (signatureName: string, signatureSubtitle: string) => `
  <div data-bjj-signature="true" style="margin-top:12px; padding-top:10px; border-top:1px solid #e8eaed; color:#5f6368;">
    <p style="margin:0;"><strong style="font-size:14px; color:#202124;">${escapeHtml(signatureName)}</strong></p>
    <p style="margin:3px 0 0; font-size:12px; color:#8a8f99;">${escapeHtml(signatureSubtitle)}</p>
  </div>
`;

const buildComunicadoHtml = (
  editorHtml: string,
  attachments: AttachmentItem[],
  urgencyLevel: UrgencyLevel,
  confidentialMode: boolean,
  signatureEnabled: boolean,
  signatureName: string,
  signatureSubtitle: string,
) => {
  const body = editorHtml.trim();
  const urgencyOption = URGENCY_OPTIONS.find((option) => option.value === urgencyLevel) || URGENCY_OPTIONS[0];
  const sections = [
    buildUrgencyHtml(urgencyOption),
    confidentialMode ? buildConfidentialBannerHtml() : "",
    body,
    buildAttachmentSectionHtml(attachments),
    signatureEnabled ? buildSignatureHtml(signatureName, signatureSubtitle) : "",
  ].filter(Boolean);

  return sections.join("");
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
    const maxWidth = sizeMode === "small" ? "280px" : sizeMode === "optimized" ? "560px" : "680px";
    const computedWidth =
      sizeMode === "small" ? Math.min(widthPercent, 40) : sizeMode === "optimized" ? Math.min(widthPercent, 72) : widthPercent;
    const widthStyle = sizeMode === "original" ? "width:auto;" : `width:${computedWidth}%;`;

    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        style: `display:block; ${widthStyle} max-width:min(100%, ${maxWidth}); height:auto; margin:${margin}; border-radius:16px; box-sizing:border-box;`,
      }),
    ];
  },
});

const ComunicadoComposer = ({
  ctId,
  titulo,
  onTituloChange,
  content,
  onChange,
  sending,
  onSend,
  onDiscard,
}: Props) => {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [formattingOpen, setFormattingOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>("normal");
  const [confidentialMode, setConfidentialMode] = useState(false);
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  const [signatureName, setSignatureName] = useState("Equipe BJJ Manager");
  const [signatureSubtitle, setSignatureSubtitle] = useState("Comunicado enviado pela central de mensageria do CT.");
  const [step, setStep] = useState<ComposerStep>("compose");
  const [selectedImageWidth, setSelectedImageWidth] = useState(100);
  const [selectedImageAlignment, setSelectedImageAlignment] = useState<ImageAlignment>("center");
  const [selectedImageSizeMode, setSelectedImageSizeMode] = useState<ImageSizeMode>("optimized");
  const [imageControlsVisible, setImageControlsVisible] = useState(false);
  const [selectedImagePos, setSelectedImagePos] = useState<number | null>(null);
  const [editorMinHeight, setEditorMinHeight] = useState(280);

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
        placeholder: "Escreva o comunicado...",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: "",
    onUpdate: ({ editor: currentEditor }) => {
      onChange(
        buildComunicadoHtml(
          currentEditor.getHTML(),
          attachments,
          urgencyLevel,
          confidentialMode,
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
      handleClickOn(view, pos, node, nodePos) {
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
          const url = await uploadFile(file, "imagens");
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
          toast.success("Imagem colada no comunicado");
        })();

        return true;
      },
    },
    immediatelyRender: false,
  }, [editorMinHeight]);

  const finalHtml = useMemo(
    () =>
      buildComunicadoHtml(
        editor?.getHTML() || "",
        attachments,
        urgencyLevel,
        confidentialMode,
        signatureEnabled,
        signatureName,
        signatureSubtitle,
      ),
    [attachments, urgencyLevel, confidentialMode, editor, signatureEnabled, signatureName, signatureSubtitle],
  );

  const previewHtml = useMemo(() => renderComunicadoPreviewHtml(finalHtml, titulo || "Comunicado"), [finalHtml, titulo]);
  const selectedUrgency = URGENCY_OPTIONS.find((option) => option.value === urgencyLevel) || URGENCY_OPTIONS[0];

  useEffect(() => {
    onChange(finalHtml);
  }, [finalHtml, onChange]);

  useEffect(() => {
    if (!editor) return;
    if (!content) {
      if (editor.getHTML() !== "<p></p>") {
        editor.commands.setContent("");
      }
      setAttachments([]);
      setUrgencyLevel("normal");
      setConfidentialMode(false);
      setSignatureEnabled(false);
      setSignatureName("Equipe BJJ Manager");
      setSignatureSubtitle("Comunicado enviado pela central de mensageria do CT.");
      setSelectedImageWidth(100);
      setSelectedImageAlignment("center");
      setSelectedImageSizeMode("optimized");
      setImageControlsVisible(false);
      setSelectedImagePos(null);
      setEditorMinHeight(280);
      setStep("compose");
    }
  }, [content, editor]);

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
      setSelectedImageWidth(Number(attrs.widthPercent || 100));
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

  const uploadFile = async (file: File, folder: "anexos" | "imagens") => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB");
      return null;
    }

    const ext = file.name.split(".").pop() || "bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
    const path = `mensagens/${ctId}/${folder}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("ct-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error(`Erro ao enviar ${folder === "imagens" ? "imagem" : "anexo"}`);
      return null;
    }

    const { data } = supabase.storage.from("ct-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const url = await uploadFile(file, "anexos");
    if (!url) return;

    setAttachments((prev) => [...prev, { name: file.name, url }]);
    toast.success("Anexo adicionado");
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor) return;

    const url = await uploadFile(file, "imagens");
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

  const handleInsertSignature = () => {
    const nextValue = !signatureEnabled;
    setSignatureEnabled(nextValue);
    toast.success(nextValue ? "Assinatura ativada" : "Assinatura removida");
  };

  const handleToggleConfidential = () => {
    const nextValue = !confidentialMode;
    setConfidentialMode(nextValue);
    toast.success(nextValue ? "Modo confidencial ativado" : "Modo confidencial desativado");
  };

  const removeAttachment = (attachmentUrl: string) => {
    setAttachments((prev) => prev.filter((item) => item.url !== attachmentUrl));
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

  const handlePreview = () => {
    if (!titulo.trim()) {
      toast.error("Informe o assunto antes de visualizar");
      return;
    }
    if (!editor?.getText().trim()) {
      toast.error("Escreva o comunicado antes de visualizar");
      return;
    }
    setStep("preview");
  };

  const handleDiscard = () => {
    setStep("compose");
    onDiscard();
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

  return (
    <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)] sm:rounded-xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3">
        <div className="flex items-center rounded-full bg-primary text-primary-foreground">
          <Button
            type="button"
            className="h-11 rounded-l-full rounded-r-none px-6 shadow-none"
            disabled={sending || !titulo.trim()}
            onClick={step === "compose" ? handlePreview : onSend}
          >
            {step === "compose" ? "Visualizar" : sending ? "Enviando" : "Enviar"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-11 w-12 items-center justify-center rounded-r-full border-l border-white/20 transition-colors hover:bg-white/10"
                disabled={sending}
                title="Mais opções de envio"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {step === "compose" ? (
                <DropdownMenuItem onClick={handlePreview}>
                  <Eye className="mr-2 h-4 w-4" /> Abrir pré-visualização
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onSend}>Enviar comunicado</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDiscard}>Limpar rascunho</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {step === "compose" && (
          <>
            <Separator orientation="vertical" className="hidden h-6 sm:block" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${selectedUrgency.chipClassName}`}
                  title="Nível de urgência"
                >
                  {selectedUrgency.label}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {URGENCY_OPTIONS.map((option) => (
                  <DropdownMenuItem key={option.value} onClick={() => setUrgencyLevel(option.value)} className="gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${option.value === "normal" ? "bg-emerald-400" : option.value === "importante" ? "bg-amber-400" : "bg-red-400"}`} />
                    <span className={option.menuClassName}>{option.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolbarButton onClick={() => setFormattingOpen((prev) => !prev)} title="Opções de formatação" active={formattingOpen}>
              <Type className="h-5 w-5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => setEditorMinHeight((prev) => Math.max(220, prev - 120))} title="Recolher área da mensagem">
              <Minimize2 className="h-5 w-5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => setEditorMinHeight((prev) => Math.min(960, prev + 120))} title="Esticar área da mensagem">
              <Maximize2 className="h-5 w-5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => attachmentInputRef.current?.click()} title="Anexar arquivo">
              <Paperclip className="h-5 w-5" />
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
            <ToolbarButton onClick={handleToggleConfidential} title="Modo confidencial" active={confidentialMode}>
              <ShieldAlert className="h-5 w-5" />
            </ToolbarButton>
            <ToolbarButton onClick={handleInsertSignature} title="Assinatura" active={signatureEnabled}>
              <PenLine className="h-5 w-5" />
            </ToolbarButton>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Mais opções"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                  <List className="mr-2 h-4 w-4" /> Lista com marcadores
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                  <ListOrdered className="mr-2 h-4 w-4" /> Lista numerada
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                  <Quote className="mr-2 h-4 w-4" /> Citação
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
                  Limpar formatação
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        <div className="ml-auto">
          <ToolbarButton onClick={handleDiscard} title="Descartar rascunho">
            <Trash2 className="h-5 w-5" />
          </ToolbarButton>
        </div>
      </div>

      {step === "compose" && formattingOpen && (
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

      {step === "compose" && imageControlsVisible && (
        <div className="border-b border-border bg-secondary/30 px-6 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Imagem selecionada</p>
              <p className="text-sm text-foreground">Ajuste tamanho e posição antes de seguir.</p>
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
              <span className="text-muted-foreground">|</span>
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
                Tamanho otimizado
              </button>
              <span className="text-muted-foreground">|</span>
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
                Tamanho original
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const currentAlt = (editor?.getAttributes("image").alt as string | undefined) || "";
                  const nextAlt = window.prompt("Texto alternativo da imagem:", currentAlt);
                  if (nextAlt === null) return;
                  updateSelectedImage({ alt: nextAlt });
                  toast.success("Texto alternativo atualizado");
                }}
                className="rounded-full px-3 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Edite o texto alternativo
              </button>
              <span className="text-muted-foreground">|</span>
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

      <div className="border-b border-border">
        <Input
          value={titulo}
          onChange={(e) => onTituloChange(e.target.value)}
          placeholder="Assunto"
          className="h-14 rounded-none border-0 bg-transparent px-6 text-lg font-medium text-foreground focus-visible:ring-0"
          readOnly={step === "preview"}
        />
      </div>

      {step === "compose" ? (
        <div className="bg-background">
          <EditorContent editor={editor} />
        </div>
      ) : (
        <div className="space-y-4 bg-background px-6 py-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/30 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pré-visualização</p>
              <p className="text-sm text-foreground">Confira o comunicado final antes do envio.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setStep("compose")}>
              Voltar para editar
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div
              className="max-w-none overflow-hidden rounded-[20px] [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      )}

      {step === "compose" && signatureEnabled && (
        <div className="border-t border-border bg-secondary/20 px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Assinatura</p>
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

      {attachments.length > 0 && (
        <div className="border-t border-border bg-secondary/20 px-6 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Anexos</p>
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <button
                key={attachment.url}
                type="button"
                onClick={() => removeAttachment(attachment.url)}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                title="Remover anexo"
              >
                {attachment.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <input ref={attachmentInputRef} type="file" className="hidden" onChange={handleAttachmentUpload} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </div>
  );
};

export default ComunicadoComposer;
