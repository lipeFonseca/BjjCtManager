import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Users, UserCheck, UserX, ChevronDown, Check, X, Mail, Phone } from "lucide-react";
import FaixaBadge from "../FaixaBadge";

export interface Recipient {
  user_id: string;
  nome: string;
  sobrenome: string | null;
  faixa: string;
  grau: number;
  email: string | null;
  telefone: string | null;
}

interface Props {
  alunos: Recipient[];
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onUpdateContact?: (userId: string, field: "email" | "telefone", value: string) => Promise<boolean> | boolean;
}

const RecipientSelector = ({ alunos, selected, onSelectionChange, onUpdateContact }: Props) => {
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<"all" | "faixa">("all");

  const filtered = useMemo(() => {
    if (!search.trim()) return alunos;
    const q = search.toLowerCase();
    return alunos.filter((a) => a.nome.toLowerCase().includes(q) || (a.sobrenome || "").toLowerCase().includes(q));
  }, [alunos, search]);

  const grouped = useMemo(() => {
    if (groupBy === "all") return { Todos: filtered };
    const groups: Record<string, Recipient[]> = {};
    filtered.forEach((a) => {
      const key = a.faixa || "branca";
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return groups;
  }, [filtered, groupBy]);

  const toggleAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(new Set(filtered.map((a) => a.user_id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const toggleGroup = (faixa: string, checked: boolean) => {
    const groupIds = (grouped[faixa] || []).map((a) => a.user_id);
    const newSet = new Set(selected);
    groupIds.forEach((id) => {
      if (checked) newSet.add(id);
      else newSet.delete(id);
    });
    onSelectionChange(newSet);
  };

  const toggle = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    onSelectionChange(newSet);
  };

  const allSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.user_id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <UserCheck className="h-3 w-3" />
            {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {alunos.length} total
          </Badge>
        </div>
        <div className="flex gap-1">
          <Button variant={groupBy === "all" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setGroupBy("all")}>
            Lista
          </Button>
          <Button variant={groupBy === "faixa" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setGroupBy("faixa")}>
            Por Faixa
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar aluno..." className="pl-9 h-9" />
      </div>

      <div className="flex items-center gap-2 px-1">
        <Checkbox checked={allSelected} onCheckedChange={(checked) => toggleAll(!!checked)} />
        <span className="text-xs text-muted-foreground">Selecionar todos</span>
      </div>

      <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border bg-card">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            {groupBy === "faixa" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border sticky top-0">
                <Checkbox checked={items.every((a) => selected.has(a.user_id))} onCheckedChange={(checked) => toggleGroup(group, !!checked)} />
                <FaixaBadge faixa={group} grau={0} size="sm" />
                <span className="text-xs text-muted-foreground">({items.length})</span>
              </div>
            )}
            {items.map((aluno) => (
              <div
                key={aluno.user_id}
                className={`flex items-center gap-3 px-3 py-2 border-b border-border last:border-0 transition-colors hover:bg-muted/10 ${
                  selected.has(aluno.user_id) ? "bg-primary/5" : ""
                }`}
              >
                <Checkbox checked={selected.has(aluno.user_id)} onCheckedChange={() => toggle(aluno.user_id)} />
                <FaixaBadge faixa={aluno.faixa} grau={aluno.grau} size="sm" />
                <span className="text-sm text-foreground flex-1 cursor-pointer" onClick={() => toggle(aluno.user_id)}>
                  {aluno.nome} {aluno.sobrenome || ""}
                </span>
                <ContactPopover aluno={aluno} onUpdateContact={onUpdateContact} />
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-6 text-center text-muted-foreground text-sm">
            <UserX className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Nenhum aluno encontrado.
          </div>
        )}
      </div>
    </div>
  );
};

function ContactPopover({
  aluno,
  onUpdateContact,
}: {
  aluno: Recipient;
  onUpdateContact?: (userId: string, field: "email" | "telefone", value: string) => Promise<boolean> | boolean;
}) {
  const [open, setOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState(aluno.email || "");
  const [phoneDraft, setPhoneDraft] = useState(aluno.telefone || "");
  const [editingField, setEditingField] = useState<"email" | "telefone" | null>(null);
  const [savingField, setSavingField] = useState<"email" | "telefone" | null>(null);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setEmailDraft(aluno.email || "");
      setPhoneDraft(aluno.telefone || "");
      setEditingField(null);
      setSavingField(null);
    }
  };

  const saveField = async (field: "email" | "telefone") => {
    const value = field === "email" ? emailDraft.trim() : phoneDraft.trim();

    if (!onUpdateContact) {
      setEditingField(null);
      return;
    }

    setSavingField(field);
    const saved = await onUpdateContact(aluno.user_id, field, value);
    setSavingField(null);

    if (saved) {
      setEditingField(null);
    }
  };

  const hasEmail = !!aluno.email;
  const hasPhone = !!aluno.telefone;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground rounded px-1.5 py-0.5 hover:bg-muted transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {hasEmail && <Mail className="h-3 w-3 text-primary/60" />}
          {hasPhone && <Phone className="h-3 w-3 text-primary/60" />}
          {!hasEmail && !hasPhone && <span className="italic text-muted-foreground/50">sem contato</span>}
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3" align="end" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium text-foreground">
          {aluno.nome} {aluno.sobrenome || ""}
        </p>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Mail className="h-3 w-3" /> E-mail
          </label>
          {editingField === "email" ? (
            <div className="flex items-center gap-1">
              <Input
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="email@exemplo.com"
                className="h-7 text-xs px-2"
                type="email"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveField("email");
                  if (e.key === "Escape") setEditingField(null);
                }}
              />
              <button className="p-1 rounded hover:bg-primary/10 text-primary disabled:opacity-50" disabled={savingField === "email"} onClick={() => void saveField("email")}>
                <Check className="h-3.5 w-3.5" />
              </button>
              <button className="p-1 rounded hover:bg-destructive/10 text-destructive disabled:opacity-50" disabled={savingField === "email"} onClick={() => setEditingField(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              className="w-full text-left text-xs px-2 py-1.5 rounded border border-border hover:bg-muted/30 transition-colors truncate"
              onClick={() => {
                setEmailDraft(aluno.email || "");
                setEditingField("email");
              }}
            >
              {aluno.email || <span className="italic text-muted-foreground/50">Clique para adicionar</span>}
            </button>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" /> Telefone
          </label>
          {editingField === "telefone" ? (
            <div className="flex items-center gap-1">
              <Input
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                placeholder="(11) 99999-9999"
                className="h-7 text-xs px-2"
                type="tel"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveField("telefone");
                  if (e.key === "Escape") setEditingField(null);
                }}
              />
              <button className="p-1 rounded hover:bg-primary/10 text-primary disabled:opacity-50" disabled={savingField === "telefone"} onClick={() => void saveField("telefone")}>
                <Check className="h-3.5 w-3.5" />
              </button>
              <button className="p-1 rounded hover:bg-destructive/10 text-destructive disabled:opacity-50" disabled={savingField === "telefone"} onClick={() => setEditingField(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              className="w-full text-left text-xs px-2 py-1.5 rounded border border-border hover:bg-muted/30 transition-colors truncate"
              onClick={() => {
                setPhoneDraft(aluno.telefone || "");
                setEditingField("telefone");
              }}
            >
              {aluno.telefone || <span className="italic text-muted-foreground/50">Clique para adicionar</span>}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default RecipientSelector;
