import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Bold, Italic, Underline as UnderlineIcon,
  ImagePlus, Link as LinkIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeHtmlFragment, sanitizeUrlForHtml } from "@/lib/htmlSecurity";

interface Props {
  ctId: string;
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const RichTextEditor = ({ ctId, content, onChange, placeholder = "Escreva sua mensagem..." }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(content);

  useEffect(() => {
    setValue(content);
  }, [content]);

  const wrapSelection = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const newValue = value.substring(0, start) + before + selected + after + value.substring(end);
    const sanitizedValue = sanitizeHtmlFragment(newValue);
    setValue(sanitizedValue);
    onChange(sanitizedValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
    const path = `mensagens/${ctId}/imagens/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage.from("ct-assets").upload(path, file);
    if (error) {
      toast.error("Erro ao enviar imagem");
      return;
    }

    const { data: urlData } = supabase.storage.from("ct-assets").getPublicUrl(path);
    const imgTag = `\n<img src="${urlData.publicUrl}" alt="${file.name.replace(/"/g, "&quot;")}" />\n`;
    const newValue = sanitizeHtmlFragment(value + imgTag);
    setValue(newValue);
    onChange(newValue);
    toast.success("Imagem adicionada!");
  };

  const addLink = () => {
    const url = window.prompt("URL do link:");
    if (url) {
      const safeUrl = sanitizeUrlForHtml(url);
      if (!safeUrl) {
        toast.error("URL invalida ou nao permitida");
        return;
      }
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart || value.length;
      const end = textarea?.selectionEnd || value.length;
      const selected = value.substring(start, end) || url;
      const linkHtml = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${selected}</a>`;
      const newValue = sanitizeHtmlFragment(value.substring(0, start) + linkHtml + value.substring(end));
      setValue(newValue);
      onChange(newValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const sanitizedValue = sanitizeHtmlFragment(e.target.value);
    setValue(sanitizedValue);
    onChange(sanitizedValue);
  };

  const ToolBtn = ({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title: string }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div className="rounded-lg border border-border bg-secondary overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-muted/30">
        <ToolBtn onClick={() => wrapSelection("<b>", "</b>")} title="Negrito">
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => wrapSelection("<i>", "</i>")} title="Itálico">
          <Italic className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => wrapSelection("<u>", "</u>")} title="Sublinhado">
          <UnderlineIcon className="h-4 w-4" />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolBtn onClick={() => fileInputRef.current?.click()} title="Inserir imagem">
          <ImagePlus className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={addLink} title="Inserir link">
          <LinkIcon className="h-4 w-4" />
        </ToolBtn>
      </div>

      {/* Editor */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="min-h-[200px] border-0 rounded-none focus-visible:ring-0 resize-y bg-secondary text-foreground"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  );
};

export default RichTextEditor;
