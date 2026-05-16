import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface SimpleMessageDraft {
  mensagem: string;
}

export const createSimpleMessageDraft = (): SimpleMessageDraft => ({
  mensagem: "",
});

export const buildSimpleMessageHtml = (draft: SimpleMessageDraft) => {
  const blocks = draft.mensagem
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return "";
  }

  return blocks
    .map(
      (block) =>
        `<p style="margin:0 0 18px; color:#e5e7eb; font-size:15px; line-height:1.8;">${block.replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
};

interface Props {
  draft: SimpleMessageDraft;
  onDraftChange: (draft: SimpleMessageDraft) => void;
}

const SimpleMessageBuilder = ({ draft, onDraftChange }: Props) => {
  return (
    <div className="space-y-3 rounded-[28px] border border-border/80 bg-gradient-to-br from-secondary via-secondary to-secondary/60 p-4 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.8)] sm:rounded-2xl sm:p-5">
      <div className="space-y-1">
        <Label className="text-sm font-medium text-foreground">Texto da mensagem</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Escreva livremente. A mensageria aplica automaticamente o padrão visual do canal no envio.
        </p>
      </div>

      <Textarea
        value={draft.mensagem}
        onChange={(e) => onDraftChange({ mensagem: e.target.value })}
        rows={10}
        placeholder={`Digite a mensagem aqui...\n\nUse uma linha em branco para separar parágrafos.`}
        className="min-h-[240px] rounded-[24px] border-border/80 bg-background/70 px-4 py-4 text-sm leading-7 text-foreground shadow-inner shadow-black/10 placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-primary/40 sm:rounded-2xl"
      />
    </div>
  );
};

export default SimpleMessageBuilder;
