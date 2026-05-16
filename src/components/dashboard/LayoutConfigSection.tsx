import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Monitor, Smartphone, Save, RotateCcw, PanelLeft, PanelTop, Eye, EyeOff, Upload, ImageIcon, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LayoutConfig, SidebarPosition, SidebarSize } from "@/hooks/useLayoutConfig";
import { DEFAULT_CONFIG } from "@/hooks/useLayoutConfig";

const SIDEBAR_LABELS: Record<string, { label: string; icon: string }> = {
  dashboard: { label: "Dashboard", icon: "📊" },
  mestres: { label: "Mestres do CT", icon: "👥" },
  alunos: { label: "Alunos do CT", icon: "🥋" },
  horarios: { label: "Horários", icon: "🕐" },
  mensagens: { label: "Mensagens", icon: "💬" },
  pagamentos: { label: "Pagamentos", icon: "💳" },
  // chat removed
  faixa: { label: "Minha Faixa", icon: "🏅" },
};

const WIDGET_LABELS: Record<string, { label: string; icon: string }> = {
  centros: { label: "Card: Centros de Treinamento", icon: "🏢" },
  mestres: { label: "Card: Mestres", icon: "👥" },
  alunos: { label: "Card: Alunos", icon: "🥋" },
  faixasPretas: { label: "Card: Faixas Pretas", icon: "🏅" },
  faixaChart: { label: "Gráfico: Membros por Faixa", icon: "📊" },
  mestresCT: { label: "Card: Mestres do CT", icon: "👥" },
  alunosCT: { label: "Card: Alunos do CT", icon: "🥋" },
  mensagens: { label: "Card: Mensagens", icon: "💬" },
  presencasHoje: { label: "Card: Presenças Hoje", icon: "✅" },
  attendanceChart: { label: "Gráfico: Frequência", icon: "📈" },
  schedule: { label: "Quadro de Horários", icon: "🕐" },
  faixaAtual: { label: "Card: Faixa Atual", icon: "🏅" },
  presencas: { label: "Card: Presenças", icon: "📍" },
  attendanceRanking: { label: "Ranking de Presença", icon: "🏆" },
};

// All available items for each section
const ALL_SIDEBAR_MESTRE = ["dashboard", "mestres", "alunos", "horarios", "mensagens"];
const ALL_SIDEBAR_ALUNO = ["dashboard", "horarios", "faixa", "mensagens", "pagamentos"];
const ALL_WIDGETS_ADMIN = ["centros", "mestres", "alunos", "faixasPretas", "faixaChart", "attendanceRanking"];
const ALL_WIDGETS_MESTRE = ["mestresCT", "alunosCT", "mensagens", "presencasHoje", "attendanceChart", "schedule", "attendanceRanking"];
const ALL_WIDGETS_ALUNO = ["faixaAtual", "presencas", "mensagens", "schedule", "attendanceRanking"];

type ConfigKey = keyof LayoutConfig;

const ARRAY_SECTIONS: { key: ConfigKey; label: string; type: "sidebar" | "widget"; allItems: string[] }[] = [
  { key: "sidebar_mestre", label: "Menu — Mestre", type: "sidebar", allItems: ALL_SIDEBAR_MESTRE },
  { key: "sidebar_aluno", label: "Menu — Aluno", type: "sidebar", allItems: ALL_SIDEBAR_ALUNO },
  { key: "widgets_admin", label: "Widgets — Admin", type: "widget", allItems: ALL_WIDGETS_ADMIN },
  { key: "widgets_mestre", label: "Widgets — Mestre", type: "widget", allItems: ALL_WIDGETS_MESTRE },
  { key: "widgets_aluno", label: "Widgets — Aluno", type: "widget", allItems: ALL_WIDGETS_ALUNO },
];

interface LayoutConfigSectionProps {
  sidebarOnly?: boolean;
  menuOnly?: boolean;
}

const LayoutConfigSection = ({ sidebarOnly, menuOnly }: LayoutConfigSectionProps = {}) => {
  const [config, setConfig] = useState<LayoutConfig>({ ...DEFAULT_CONFIG });
  const [original, setOriginal] = useState<LayoutConfig>({ ...DEFAULT_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [devicePreview, setDevicePreview] = useState<"desktop" | "mobile">("desktop");
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from("layout_config")
        .select("config_key, config_value");
      if (data) {
        const loaded = { ...DEFAULT_CONFIG };
        data.forEach((row: any) => {
          if (row.config_key in loaded) {
            if (row.config_key === "sidebar_position") {
              loaded.sidebar_position = (typeof row.config_value === "string" ? row.config_value : "left") as SidebarPosition;
            } else if (row.config_key === "sidebar_size") {
              loaded.sidebar_size = (typeof row.config_value === "string" ? row.config_value : "normal") as SidebarSize;
            } else if (row.config_key === "sidebar_icon_only") {
              loaded.sidebar_icon_only = row.config_value === true || row.config_value === "true";
            } else {
              (loaded as any)[row.config_key] = row.config_value;
            }
          }
        });
        setConfig(loaded);
        setOriginal(loaded);
      }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const moveItem = (key: ConfigKey, index: number, direction: -1 | 1) => {
    const arr = [...(config[key] as string[])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= arr.length) return;
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    setConfig(prev => ({ ...prev, [key]: arr }));
  };

  const toggleItemVisibility = (key: ConfigKey, item: string, allItems: string[]) => {
    const currentItems = config[key] as string[];
    const isVisible = currentItems.includes(item);

    if (isVisible) {
      // Hide: remove from array
      setConfig(prev => ({
        ...prev,
        [key]: currentItems.filter(i => i !== item)
      }));
    } else {
      // Show: add at the end, maintaining the default order for new items
      const defaultOrder = allItems;
      const newItems = [...currentItems, item].sort((a, b) => {
        const aIdx = defaultOrder.indexOf(a);
        const bIdx = defaultOrder.indexOf(b);
        // If both are in visible items, keep their current relative order
        const aVisibleIdx = currentItems.indexOf(a);
        const bVisibleIdx = currentItems.indexOf(b);
        if (aVisibleIdx !== -1 && bVisibleIdx !== -1) {
          return aVisibleIdx - bVisibleIdx;
        }
        // New item goes to its default position
        return aIdx - bIdx;
      });
      setConfig(prev => ({
        ...prev,
        [key]: newItems
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const allEntries: [string, any][] = [
      ...Object.entries(config).filter(([key]) => !["sidebar_position", "sidebar_size", "sidebar_icon_only", "sidebar_image_url", "sidebar_image_size", "sidebar_text", "sidebar_text_size"].includes(key)),
      ["sidebar_position", config.sidebar_position],
      ["sidebar_size", config.sidebar_size],
      ["sidebar_icon_only", config.sidebar_icon_only],
      ["sidebar_image_url", config.sidebar_image_url],
      ["sidebar_image_size", config.sidebar_image_size],
      ["sidebar_text", config.sidebar_text],
      ["sidebar_text_size", config.sidebar_text_size],
    ];

    const promises = allEntries.map(([key, value]) =>
      supabase
        .from("layout_config")
        .upsert(
          { config_key: key, config_value: value as any, updated_at: new Date().toISOString(), updated_by: user?.id },
          { onConflict: "config_key" }
        )
    );

    const results = await Promise.all(promises);
    const hasError = results.some(r => r.error);

    if (hasError) {
      toast.error("Erro ao salvar configuração de layout");
    } else {
      toast.success("Layout salvo com sucesso! Recarregue a página para aplicar.");
      setOriginal({ ...config });
    }
    setSaving(false);
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_CONFIG });
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(original);

  const getLabels = (type: "sidebar" | "widget") =>
    type === "sidebar" ? SIDEBAR_LABELS : WIDGET_LABELS;

  if (loading) {
    return <p className="text-muted-foreground text-sm animate-pulse">Carregando configurações de layout...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Sidebar global settings */}
      {!menuOnly && (
      <div className="rounded-[24px] border border-border bg-card p-4 space-y-4 sm:rounded-lg">
        <h3 className="text-sm font-heading uppercase tracking-wider text-foreground">Barra de Navegação</h3>

        {/* Position */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Label className="text-muted-foreground text-sm min-w-[100px]">Posição:</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant={config.sidebar_position === "left" ? "default" : "outline"}
              size="sm"
              className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md"
              onClick={() => setConfig(prev => ({ ...prev, sidebar_position: "left" }))}
            >
              <PanelLeft className="h-4 w-4 mr-2" /> Lateral Esquerda
            </Button>
            <Button
              variant={config.sidebar_position === "top" ? "default" : "outline"}
              size="sm"
              className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md"
              onClick={() => setConfig(prev => ({ ...prev, sidebar_position: "top" }))}
            >
              <PanelTop className="h-4 w-4 mr-2" /> Topo
            </Button>
          </div>
        </div>

        {/* Size */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Label className="text-muted-foreground text-sm min-w-[100px]">Tamanho:</Label>
          <Select
            value={config.sidebar_size}
            onValueChange={(v) => setConfig(prev => ({ ...prev, sidebar_size: v as SidebarSize }))}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal (256px)</SelectItem>
              <SelectItem value="compact">Compacto (200px)</SelectItem>
              <SelectItem value="mini">Mini (180px)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Icon only */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Label className="text-muted-foreground text-sm min-w-[100px]">Apenas ícones:</Label>
          <Switch
            checked={config.sidebar_icon_only}
            onCheckedChange={(v) => setConfig(prev => ({ ...prev, sidebar_icon_only: v }))}
          />
          <span className="text-xs text-muted-foreground">
            {config.sidebar_icon_only ? "Uma linha com ícones apenas" : "Ícones + texto"}
          </span>
        </div>

        {/* Sidebar Image */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <Label className="text-muted-foreground text-sm">Imagem da Sidebar</Label>
          </div>

          {config.sidebar_image_url ? (
            <div className="space-y-3">
              <div className="relative rounded-md overflow-hidden border border-border bg-secondary/30 flex items-center justify-center" style={{ height: 80 }}>
                <img
                  src={config.sidebar_image_url}
                  alt="Sidebar"
                  className="max-h-full max-w-full object-contain"
                  style={{ height: `${Math.min(Number(config.sidebar_image_size) || 64, 80)}px` }}
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Label className="text-muted-foreground text-xs min-w-[80px]">Tamanho: {config.sidebar_image_size}px</Label>
                <Slider
                  min={24}
                  max={128}
                  step={4}
                  value={[Number(config.sidebar_image_size) || 64]}
                  onValueChange={([v]) => setConfig(prev => ({ ...prev, sidebar_image_size: String(v) }))}
                  className="flex-1"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Trocar
                </Button>
                <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => setConfig(prev => ({ ...prev, sidebar_image_url: "", sidebar_image_size: "64" }))}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
              <Upload className="h-3.5 w-3.5 mr-1" /> {uploadingImage ? "Enviando..." : "Enviar Imagem"}
            </Button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploadingImage(true);
              const path = `sidebar/${Date.now()}_${file.name}`;
              const { error } = await supabase.storage.from("login-assets").upload(path, file, { upsert: true });
              if (error) {
                toast.error("Erro ao enviar imagem");
              } else {
                const { data: urlData } = supabase.storage.from("login-assets").getPublicUrl(path);
                setConfig(prev => ({ ...prev, sidebar_image_url: urlData.publicUrl }));
                toast.success("Imagem enviada!");
              }
              setUploadingImage(false);
              e.target.value = "";
            }}
          />
        </div>

        {/* Sidebar Text */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground text-sm">Texto da Sidebar</Label>
          </div>
          <input
            type="text"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Ex: BJJ Manager, Nome do Grupo..."
            value={config.sidebar_text}
            onChange={(e) => setConfig(prev => ({ ...prev, sidebar_text: e.target.value }))}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Label className="text-muted-foreground text-xs min-w-[80px]">Tamanho: {config.sidebar_text_size}px</Label>
            <Slider
              min={10}
              max={28}
              step={1}
              value={[Number(config.sidebar_text_size) || 14]}
              onValueChange={([v]) => setConfig(prev => ({ ...prev, sidebar_text_size: String(v) }))}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">Texto exibido abaixo da logo na sidebar para todos os usuários.</p>
        </div>

        {/* Live preview of sidebar */}
        <div className="rounded-lg border-2 border-dashed border-border p-3 mt-2">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-heading">
            Pré-visualização da barra
          </p>
          <SidebarPreview config={config} devicePreview={devicePreview} />
        </div>
      </div>
      )}

      {!sidebarOnly && (<>

      {/* Device toggle */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          variant={devicePreview === "desktop" ? "default" : "outline"}
          size="sm"
          className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md"
          onClick={() => setDevicePreview("desktop")}
        >
          <Monitor className="h-4 w-4 mr-2" /> Desktop
        </Button>
        <Button
          variant={devicePreview === "mobile" ? "default" : "outline"}
          size="sm"
          className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md"
          onClick={() => setDevicePreview("mobile")}
        >
          <Smartphone className="h-4 w-4 mr-2" /> Mobile
        </Button>
      </div>

      {/* Ordering tabs */}
      <Tabs defaultValue="sidebar_mestre" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-secondary/50 p-1 sm:grid-cols-2 xl:grid-cols-5">
          {ARRAY_SECTIONS.map(s => (
            <TabsTrigger key={s.key} value={s.key} className="w-full min-w-0 rounded-xl text-xs sm:rounded-md">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {ARRAY_SECTIONS.map(section => {
          const labels = getLabels(section.type);
          const visibleItems = config[section.key] as string[];
          const allItems = section.allItems;

          return (
            <TabsContent key={section.key} value={section.key} className="mt-4">
              <div className={`${devicePreview === "mobile" ? "max-w-[320px] mx-auto" : "max-w-2xl"}`}>
                {/* Visibility & Reorder controls */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-heading">
                      Visibilidade e Ordem
                    </p>
                  </div>
                  
                  {/* Show all items with visibility toggle */}
                  {allItems.map((item) => {
                    const isVisible = visibleItems.includes(item);
                    const visibleIndex = visibleItems.indexOf(item);
                    
                    return (
                      <div
                        key={item}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition-all sm:rounded-md ${
                          isVisible 
                            ? "bg-card/50 border-border" 
                            : "bg-muted/20 border-transparent opacity-60"
                        }`}
                      >
                        {/* Visibility checkbox */}
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={() => toggleItemVisibility(section.key, item, allItems)}
                          className="h-4 w-4"
                        />
                        
                        {/* Icon and label */}
                        <span className="text-sm">{labels[item]?.icon || "📄"}</span>
                        <span className={`text-sm flex-1 ${isVisible ? "text-foreground" : "text-muted-foreground line-through"}`}>
                          {labels[item]?.label || item}
                        </span>
                        
                        {/* Visibility indicator */}
                        {isVisible ? (
                          <Eye className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        
                        {/* Reorder buttons - only for visible items */}
                        {isVisible && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl sm:h-7 sm:w-7 sm:rounded-md"
                              disabled={visibleIndex === 0}
                              onClick={() => moveItem(section.key, visibleIndex, -1)}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl sm:h-7 sm:w-7 sm:rounded-md"
                              disabled={visibleIndex === visibleItems.length - 1}
                              onClick={() => moveItem(section.key, visibleIndex, 1)}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Summary */}
                  <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
                    {visibleItems.length} de {allItems.length} itens visíveis
                  </p>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
      </>)}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:rounded-md" onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Layout"}
        </Button>
        <Button className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:rounded-md" variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" /> Restaurar Padrão
        </Button>
      </div>
    </div>
  );
};

/** Mini preview of how the sidebar/topbar will look */
const SidebarPreview = ({ config, devicePreview }: { config: LayoutConfig; devicePreview: "desktop" | "mobile" }) => {
  const items = Array.isArray(config.sidebar_mestre) ? config.sidebar_mestre : [];
  const isTop = config.sidebar_position === "top";
  const iconOnly = config.sidebar_icon_only;

  if (items.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic p-2">
        Nenhum item visível na barra
      </div>
    );
  }

  if (isTop) {
    return (
      <div className="flex items-center gap-1 bg-secondary/30 rounded-md p-2 overflow-x-auto">
        {items.map(item => (
          <div
            key={item}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 bg-card border border-border text-xs whitespace-nowrap"
          >
            <span>{SIDEBAR_LABELS[item]?.icon || "📄"}</span>
            {!iconOnly && <span className="text-foreground">{SIDEBAR_LABELS[item]?.label || item}</span>}
          </div>
        ))}
      </div>
    );
  }

  // Left sidebar preview
  return (
    <div className={`flex gap-2 ${devicePreview === "mobile" ? "max-w-[200px]" : ""}`}>
      <div className={`bg-secondary/30 rounded-md p-2 space-y-1 ${iconOnly ? "w-auto" : "w-48"}`}>
        {items.map(item => (
          <div
            key={item}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 bg-card border border-border text-xs ${iconOnly ? "justify-center" : ""}`}
          >
            <span>{SIDEBAR_LABELS[item]?.icon || "📄"}</span>
            {!iconOnly && <span className="text-foreground">{SIDEBAR_LABELS[item]?.label || item}</span>}
          </div>
        ))}
      </div>
      <div className="flex-1 bg-secondary/10 rounded-md p-2 min-h-[80px] flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Conteúdo</span>
      </div>
    </div>
  );
};

export default LayoutConfigSection;
