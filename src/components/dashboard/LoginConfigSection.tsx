import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, RotateCcw, Upload, Trash2, Image, Palette, GripVertical, Type, Info, Ruler, Sparkles, PanelRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_LOGIN_CONFIG, normalizeConfigValue, type LoginConfig } from "@/hooks/useLoginConfig";
import logo from "@/assets/logo.png";
import { Slider } from "@/components/ui/slider";

const COLOR_FIELDS: { key: keyof LoginConfig; label: string }[] = [
  { key: "login_bg_color", label: "Cor de Fundo" },
  { key: "login_card_bg_color", label: "Cor do Card" },
  { key: "login_primary_color", label: "Cor Primária (botão)" },
  { key: "login_text_color", label: "Cor do Texto" },
  { key: "login_accent_color", label: "Cor de Destaque (inputs)" },
  { key: "login_glow_color", label: "Cor do Brilho (glow do card)" },
  { key: "login_input_glow_color", label: "Cor do Brilho dos Inputs" },
];

const IMAGE_SIZE_HINTS: Record<string, string> = {
  banner: "Tamanho ideal: 1920×400px (proporção 4.8:1)",
  logo: "Tamanho ideal: 256×256px (quadrado, PNG transparente)",
  footer: "Tamanho ideal: 1920×300px (proporção 6.4:1)",
  bg: "Tamanho ideal: 1920×1080px (Full HD, 16:9)",
};

const LoginConfigSection = () => {
  const [config, setConfig] = useState<LoginConfig>({ ...DEFAULT_LOGIN_CONFIG });
  const [original, setOriginal] = useState<LoginConfig>({ ...DEFAULT_LOGIN_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFooter, setUploadingFooter] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingSide, setUploadingSide] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const sideInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from("layout_config")
        .select("config_key, config_value")
        .in("config_key", Object.keys(DEFAULT_LOGIN_CONFIG));

      if (data) {
        const loaded = { ...DEFAULT_LOGIN_CONFIG };
        data.forEach((row: any) => {
          const key = row.config_key as keyof LoginConfig;
          if (key in loaded) {
            loaded[key] = normalizeConfigValue(row.config_value);
          }
        });
        setConfig(loaded);
        setOriginal(loaded);
      }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const uploadImage = async (file: File, type: "banner" | "logo" | "footer" | "bg" | "side") => {
    const setUploadingMap = { banner: setUploadingBanner, logo: setUploadingLogo, footer: setUploadingFooter, bg: setUploadingBg, side: setUploadingSide };
    const setUploading = setUploadingMap[type];
    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `login-${type}.${ext}`;

      console.log(`Enviando imagem para: ${path}`);

      const { error: uploadError } = await supabase.storage
        .from("login-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        console.error("Erro upload:", uploadError);
        toast.error(`Erro ao enviar imagem: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("login-assets").getPublicUrl(path);
      const url = urlData.publicUrl + "?t=" + Date.now();

      console.log(`URL gerada: ${url}`);

      const keyMap: Record<string, keyof LoginConfig> = {
        banner: "login_banner_url",
        logo: "login_logo_url",
        footer: "login_footer_image_url",
        bg: "login_bg_image_url",
        side: "login_side_image_url",
      };
      
      setConfig(prev => {
        const updated = { ...prev, [keyMap[type]]: url };
        console.log(`Config atualizada - ${keyMap[type]}: ${url}`);
        return updated;
      });
      
      setUploading(false);
      const nameMap: Record<string, string> = { banner: "Banner", logo: "Logo", footer: "Imagem do rodapé", bg: "Imagem de fundo", side: "Imagem lateral" };
      toast.success(`${nameMap[type]} carregado! Clique em "Salvar" para confirmar.`);
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error(`Erro: ${error?.message || "Falha ao enviar imagem"}`);
      setUploading(false);
    }
  };

  const removeImage = (type: "banner" | "logo" | "footer" | "bg" | "side") => {
    const keyMap: Record<string, keyof LoginConfig> = {
      banner: "login_banner_url",
      logo: "login_logo_url",
      footer: "login_footer_image_url",
      bg: "login_bg_image_url",
      side: "login_side_image_url",
    };
    setConfig(prev => ({ ...prev, [keyMap[type]]: "" }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Usuário não autenticado");
        setSaving(false);
        return;
      }

      const promises = Object.entries(config).map(([key, value]) =>
        supabase
          .from("layout_config")
          .upsert({
            config_key: key,
            config_value: value as any,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          }, { onConflict: "config_key" })
      );

      const results = await Promise.all(promises);
      
      // Verificar se algum resultado retornou erro
      const errorResults = results.filter(r => r.error);
      
      if (errorResults.length > 0) {
        console.error("Erros ao salvar:", errorResults);
        const errorMsg = errorResults[0].error?.message || "Erro desconhecido";
        toast.error(`Erro ao salvar: ${errorMsg}`);
      } else {
        toast.success("Configurações da tela de login salvas!");
        setOriginal({ ...config });
      }
    } catch (error: any) {
      console.error("Erro ao salvar configurações:", error);
      toast.error(`Erro: ${error?.message || "Falha ao salvar"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setConfig({ ...DEFAULT_LOGIN_CONFIG });
  const hasChanges = JSON.stringify(config) !== JSON.stringify(original);

  if (loading) {
    return <p className="text-muted-foreground text-sm animate-pulse">Carregando...</p>;
  }

  const bannerHeight = Number(config.login_banner_height) || 208;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Image uploads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Banner */}
        <div className="rounded-[24px] border border-border bg-card p-4 space-y-3 sm:rounded-lg">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-primary" />
            <Label className="text-foreground font-heading uppercase text-sm">Banner de Cabeçalho</Label>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" /> {IMAGE_SIZE_HINTS.banner}
          </p>
          {config.login_banner_url ? (
            <BannerPositioner
              src={config.login_banner_url}
              position={Number(config.login_banner_position) || 50}
              onPositionChange={(pos) => setConfig(prev => ({ ...prev, login_banner_position: String(pos) }))}
              onRemove={() => removeImage("banner")}
            />
          ) : (
            <div className="h-24 rounded-md border-2 border-dashed border-border flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Sem banner</span>
            </div>
          )}
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "banner")} />
          <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}>
            <Upload className="h-3.5 w-3.5 mr-2" /> {uploadingBanner ? "Enviando..." : "Enviar Banner"}
          </Button>

          {/* Banner height */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Altura do Banner: {bannerHeight}px</Label>
            </div>
            <Slider
              value={[bannerHeight]}
              onValueChange={([val]) => setConfig(prev => ({ ...prev, login_banner_height: String(val) }))}
              min={80}
              max={500}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>80px</span>
              <span>500px</span>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="rounded-[24px] border border-border bg-card p-4 space-y-3 sm:rounded-lg">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-primary" />
            <Label className="text-foreground font-heading uppercase text-sm">Logo / Ícone</Label>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" /> {IMAGE_SIZE_HINTS.logo}
          </p>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="h-16 w-16 rounded-lg border border-border flex items-center justify-center overflow-hidden bg-secondary">
              <img src={config.login_logo_url || logo} alt="Logo" className="h-12 w-12 object-contain" />
            </div>
            {config.login_logo_url && (
              <Button variant="ghost" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => removeImage("logo")}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
              </Button>
            )}
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "logo")} />
          <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
            <Upload className="h-3.5 w-3.5 mr-2" /> {uploadingLogo ? "Enviando..." : "Enviar Logo"}
          </Button>

          {/* Logo size */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Tamanho da Logo: {Number(config.login_logo_size) || 64}px</Label>
            </div>
            <Slider
              value={[Number(config.login_logo_size) || 64]}
              onValueChange={([val]) => setConfig(prev => ({ ...prev, login_logo_size: String(val) }))}
              min={32}
              max={200}
              step={4}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>32px</span>
              <span>200px</span>
            </div>
          </div>
        </div>

        {/* Background Image */}
        <div className="rounded-[24px] border border-border bg-card p-4 space-y-3 sm:rounded-lg">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-primary" />
            <Label className="text-foreground font-heading uppercase text-sm">Imagem de Fundo</Label>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" /> {IMAGE_SIZE_HINTS.bg}
          </p>
          {config.login_bg_image_url ? (
            <div className="relative rounded-md overflow-hidden border border-border h-24">
              <img src={config.login_bg_image_url} alt="Fundo" className="w-full h-full object-cover" />
              <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-9 w-9 rounded-xl sm:h-7 sm:w-7 sm:rounded-md" onClick={() => removeImage("bg")}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="h-24 rounded-md border-2 border-dashed border-border flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Sem imagem de fundo</span>
            </div>
          )}
          <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "bg")} />
          <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => bgInputRef.current?.click()} disabled={uploadingBg}>
            <Upload className="h-3.5 w-3.5 mr-2" /> {uploadingBg ? "Enviando..." : "Enviar Imagem de Fundo"}
          </Button>

          {/* Background opacity */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Opacidade: {Number(config.login_bg_image_opacity) || 100}%</Label>
            </div>
            <Slider
              value={[Number(config.login_bg_image_opacity) || 100]}
              onValueChange={([val]) => setConfig(prev => ({ ...prev, login_bg_image_opacity: String(val) }))}
              min={5}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Footer Image */}
        <div className="rounded-[24px] border border-border bg-card p-4 space-y-3 sm:rounded-lg">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-primary" />
            <Label className="text-foreground font-heading uppercase text-sm">Imagem do Rodapé</Label>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" /> {IMAGE_SIZE_HINTS.footer}
          </p>
          {config.login_footer_image_url ? (
            <div className="relative rounded-md overflow-hidden border border-border h-24">
              <img src={config.login_footer_image_url} alt="Rodapé" className="w-full h-full object-cover" />
              <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-9 w-9 rounded-xl sm:h-7 sm:w-7 sm:rounded-md" onClick={() => removeImage("footer")}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="h-24 rounded-md border-2 border-dashed border-border flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Sem imagem de rodapé</span>
            </div>
          )}
          <input ref={footerInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "footer")} />
          <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => footerInputRef.current?.click()} disabled={uploadingFooter}>
            <Upload className="h-3.5 w-3.5 mr-2" /> {uploadingFooter ? "Enviando..." : "Enviar Imagem do Rodapé"}
          </Button>

          {/* Footer height */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Altura do Rodapé: {Number(config.login_footer_height) || 150}px</Label>
            </div>
            <Slider
              value={[Number(config.login_footer_height) || 150]}
              onValueChange={([val]) => setConfig(prev => ({ ...prev, login_footer_height: String(val) }))}
              min={50}
              max={400}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>50px</span>
              <span>400px</span>
            </div>
          </div>
        </div>
        {/* Side Image */}
        <div className="rounded-[24px] border border-border bg-card p-4 space-y-3 sm:rounded-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <PanelRight className="h-4 w-4 text-primary" />
              <Label className="text-foreground font-heading uppercase text-sm">Imagem Lateral</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{config.login_side_image_enabled !== "false" ? "Ativada" : "Desativada"}</Label>
              <Switch
                checked={config.login_side_image_enabled !== "false"}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, login_side_image_enabled: checked ? "true" : "false" }))}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Quando desativada, o painel de login ficará centralizado na tela.
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" /> Tamanho ideal: 800×1200px (proporção 2:3, vertical). Visível apenas em desktop.
          </p>
          {config.login_side_image_url ? (
            <div className="relative rounded-md overflow-hidden border border-border h-24">
              <img src={config.login_side_image_url} alt="Lateral" className="w-full h-full object-cover" />
              <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-9 w-9 rounded-xl sm:h-7 sm:w-7 sm:rounded-md" onClick={() => removeImage("side")}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="h-24 rounded-md border-2 border-dashed border-border flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Sem imagem lateral</span>
            </div>
          )}
          <input ref={sideInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "side")} />
          <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => sideInputRef.current?.click()} disabled={uploadingSide}>
            <Upload className="h-3.5 w-3.5 mr-2" /> {uploadingSide ? "Enviando..." : "Enviar Imagem Lateral"}
          </Button>

          {/* Side image opacity */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Opacidade: {Number(config.login_side_image_opacity) || 40}%</Label>
            </div>
            <Slider
              value={[Number(config.login_side_image_opacity) || 40]}
              onValueChange={([val]) => setConfig(prev => ({ ...prev, login_side_image_opacity: String(val) }))}
              min={5}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Side image size */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Tamanho da Imagem</Label>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {[
                { value: "cover", label: "Preencher" },
                { value: "contain", label: "Conter" },
                { value: "auto", label: "Original" },
              ].map(opt => (
                <Button
                  key={opt.value}
                  variant={(config.login_side_image_size || "cover") === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setConfig(prev => ({ ...prev, login_side_image_size: opt.value }))}
                  className="h-10 w-full rounded-xl text-xs sm:h-9 sm:w-auto sm:rounded-md"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-card p-4 space-y-4 sm:rounded-lg">
        <div className="flex items-center gap-2">
          <Save className="h-4 w-4 text-primary" />
          <Label className="text-foreground font-heading uppercase text-sm">Textos</Label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Título</Label>
            <Input
              value={config.login_title}
              onChange={e => setConfig(prev => ({ ...prev, login_title: e.target.value }))}
              className="bg-secondary border-border text-foreground h-9"
              placeholder="BJJ Manager"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Subtítulo</Label>
            <Input
              value={config.login_subtitle}
              onChange={e => setConfig(prev => ({ ...prev, login_subtitle: e.target.value }))}
              className="bg-secondary border-border text-foreground h-9"
              placeholder="Acesse sua conta"
            />
          </div>
        </div>
      </div>

      {/* Color pickers */}
      <div className="rounded-[24px] border border-border bg-card p-4 space-y-4 sm:rounded-lg">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <Label className="text-foreground font-heading uppercase text-sm">Paleta de Cores</Label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COLOR_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config[key]}
                  onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
                  className="h-9 w-12 rounded-md border border-border cursor-pointer bg-transparent"
                />
                <Input
                  value={config[key]}
                  onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
                  className="bg-secondary border-border text-foreground font-mono text-xs h-9 flex-1"
                  placeholder="#000000"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-[24px] border border-border bg-card p-4 space-y-3 sm:rounded-lg">
        <Label className="text-foreground font-heading uppercase text-sm">Pré-visualização</Label>
        <div
          className="rounded-lg overflow-hidden border border-border"
          style={{
            backgroundColor: config.login_bg_color,
            backgroundImage: config.login_bg_image_url ? `url(${config.login_bg_image_url})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {config.login_banner_url && (
            <img
              src={config.login_banner_url}
              alt="Banner preview"
              className="w-full object-cover"
              style={{
                height: `${Math.round(bannerHeight * 0.3)}px`,
                objectPosition: `center ${config.login_banner_position || 50}%`,
              }}
            />
          )}
          <div className="flex flex-col items-center py-6 px-4">
            <img
              src={config.login_logo_url || logo}
              alt="Logo"
              className="h-10 w-10 mb-2"
            />
            <span className="font-heading text-lg uppercase tracking-wider mb-1" style={{ color: config.login_text_color }}>
              {config.login_title || "BJJ Manager"}
            </span>
            <span className="text-xs mb-4" style={{ color: config.login_text_color, opacity: 0.6 }}>
              {config.login_subtitle || "Acesse sua conta"}
            </span>
            <div
              className="w-full max-w-[260px] rounded-lg p-4 space-y-3"
              style={{
                backgroundColor: config.login_card_bg_color,
                border: `1px solid ${config.login_accent_color}`,
              }}
            >
              <div className="h-8 rounded-md" style={{ backgroundColor: config.login_accent_color }} />
              <div className="h-8 rounded-md" style={{ backgroundColor: config.login_accent_color }} />
              <div
                className="h-8 rounded-md flex items-center justify-center text-xs font-medium"
                style={{ backgroundColor: config.login_primary_color, color: "#fff" }}
              >
                Entrar
              </div>
            </div>
          </div>
          {config.login_footer_image_url && (
            <img src={config.login_footer_image_url} alt="Rodapé preview" className="w-full h-12 object-cover" />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button className="w-full sm:w-auto" variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" /> Restaurar Padrão
        </Button>
      </div>
    </div>
  );
};

/** Draggable banner positioner */
const BannerPositioner = ({
  src, position, onPositionChange, onRemove,
}: {
  src: string; position: number; onPositionChange: (pos: number) => void; onRemove: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    onPositionChange(Math.round(y));
  };

  const handlePointerUp = () => setDragging(false);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative rounded-md overflow-hidden border border-border cursor-grab active:cursor-grabbing select-none"
        style={{ height: 96 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img
          src={src}
          alt="Banner"
          className="w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: `center ${position}%` }}
          draggable={false}
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
          <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <GripVertical className="h-3.5 w-3.5" />
            Arraste para reposicionar
          </div>
        </div>
        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Posição vertical: {position}%</p>
    </div>
  );
};

export default LoginConfigSection;
