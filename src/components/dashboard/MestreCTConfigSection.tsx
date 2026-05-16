import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, ImageIcon, Trash2, Save, Building2, Type, MapPin, Loader2 } from "lucide-react";
import { buildCtPrivateAssetPath, removeCtPrivateAsset } from "@/services/ctPrivateAssets";
import { useResolvedCtAssetUrls } from "@/hooks/useResolvedCtAssetUrls";
import { getGeolocationContextError } from "@/lib/geolocation";

const FONT_OPTIONS = [
  { value: "heading", label: "Padrão (Heading)" },
  { value: "'Oswald', sans-serif", label: "Oswald" },
  { value: "'Bebas Neue', sans-serif", label: "Bebas Neue" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Montserrat', sans-serif", label: "Montserrat" },
  { value: "'Poppins', sans-serif", label: "Poppins" },
  { value: "'Lato', sans-serif", label: "Lato" },
  { value: "'Open Sans', sans-serif", label: "Open Sans" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
];

export interface CTConfig {
  nome: string;
  subtitulo: string;
  endereco: string;
  logo_url: string;
  logo_size: string;
  banner_url: string;
  banner_position: string;
  nome_font_size: string;
  endereco_font_size: string;
  subtitulo_font_size: string;
  nome_font_family: string;
  endereco_font_family: string;
  subtitulo_font_family: string;
  nome_color: string;
  endereco_color: string;
  subtitulo_color: string;
  latitude: string;
  longitude: string;
  raio_presenca_metros: string;
}

const DEFAULT_CT_CONFIG: CTConfig = {
  nome: "",
  subtitulo: "",
  endereco: "",
  logo_url: "",
  logo_size: "64",
  banner_url: "",
  banner_position: "50",
  nome_font_size: "28",
  endereco_font_size: "14",
  subtitulo_font_size: "14",
  nome_font_family: "heading",
  endereco_font_family: "sans",
  subtitulo_font_family: "sans",
  nome_color: "#ffffff",
  endereco_color: "#a1a1aa",
  subtitulo_color: "#a1a1aa",
  latitude: "",
  longitude: "",
  raio_presenca_metros: "100",
};

interface MestreCTConfigSectionProps {
  onSaved?: (config: CTConfig) => void;
}

const MestreCTConfigSection = ({ onSaved }: MestreCTConfigSectionProps = {}) => {
  const [config, setConfig] = useState<CTConfig>({ ...DEFAULT_CT_CONFIG });
  const [original, setOriginal] = useState<CTConfig | null>(null);
  const [ctId, setCtId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const resolvedAssetUrls = useResolvedCtAssetUrls([config.logo_url, config.banner_url]);
  const resolvedLogoUrl = config.logo_url ? resolvedAssetUrls[config.logo_url] || "" : "";
  const resolvedBannerUrl = config.banner_url ? resolvedAssetUrls[config.banner_url] || "" : "";
  const geolocationContextError = getGeolocationContextError();

  useEffect(() => {
    const fetchCT = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("ct_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.ct_id) {
        setLoading(false);
        return;
      }

      setCtId(profile.ct_id);

      const { data: ct } = await supabase
        .from("centros_treinamento")
        .select("nome, subtitulo, endereco, logo_url, logo_size, banner_url, banner_position, nome_font_size, endereco_font_size, subtitulo_font_size, nome_font_family, endereco_font_family, subtitulo_font_family, nome_color, endereco_color, subtitulo_color, latitude, longitude, raio_presenca_metros")
        .eq("id", profile.ct_id)
        .single();

      if (ct) {
        const d = ct as any;
        const loaded: CTConfig = {
          nome: d.nome || "",
          subtitulo: d.subtitulo || "",
          endereco: d.endereco || "",
          logo_url: d.logo_url || "",
          logo_size: d.logo_size || "64",
          banner_url: d.banner_url || "",
          banner_position: d.banner_position || "50",
          nome_font_size: d.nome_font_size || "28",
          endereco_font_size: d.endereco_font_size || "14",
          subtitulo_font_size: d.subtitulo_font_size || "14",
          nome_font_family: d.nome_font_family || "heading",
          endereco_font_family: d.endereco_font_family || "sans",
          subtitulo_font_family: d.subtitulo_font_family || "sans",
          nome_color: d.nome_color || "#ffffff",
          endereco_color: d.endereco_color || "#a1a1aa",
          subtitulo_color: d.subtitulo_color || "#a1a1aa",
          latitude: d.latitude != null ? String(d.latitude) : "",
          longitude: d.longitude != null ? String(d.longitude) : "",
          raio_presenca_metros: d.raio_presenca_metros != null ? String(d.raio_presenca_metros) : "100",
        };
        setConfig(loaded);
        setOriginal(loaded);
      }
      setLoading(false);
    };
    fetchCT();
  }, []);

  const handleUpload = async (
    file: File,
    type: "logo" | "banner",
    setUploading: (v: boolean) => void
  ) => {
    setUploading(true);
    const path = buildCtPrivateAssetPath(ctId || "", type, file.name);
    const { error } = await supabase.storage.from("ct-private-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error(`Erro ao enviar ${type}`);
    } else {
      setConfig(prev => ({
        ...prev,
        [type === "logo" ? "logo_url" : "banner_url"]: path,
      }));
      toast.success(`${type === "logo" ? "Logo" : "Banner"} enviado!`);
    }
    setUploading(false);
  };

  const handleRemoveImage = async (type: "logo" | "banner") => {
    const currentRef = type === "logo" ? config.logo_url : config.banner_url;
    await removeCtPrivateAsset(currentRef);
    setConfig(prev => ({
      ...prev,
      [type === "logo" ? "logo_url" : "banner_url"]: "",
      ...(type === "logo" ? { logo_size: "64" } : { banner_position: "50" }),
    }));
  };

  const handleSave = async () => {
    if (!ctId) return;
    setSaving(true);

    try {
      let latitude = config.latitude.trim() ? Number(config.latitude) : null;
      let longitude = config.longitude.trim() ? Number(config.longitude) : null;

      if (
        (latitude == null || Number.isNaN(latitude) || longitude == null || Number.isNaN(longitude)) &&
        config.endereco.trim()
      ) {
        setGeocodingAddress(true);
        const { data, error } = await supabase.functions.invoke("geocodificar-endereco", {
          body: {
            endereco: config.endereco,
            nome_ct: config.nome,
          },
        });

        if (error || data?.error) {
          throw new Error(data?.error || error?.message || "Erro ao localizar endereço");
        }

        if (!data?.success || !data?.latitude || !data?.longitude) {
          throw new Error("Endereço não encontrado");
        }

        latitude = Number(data.latitude);
        longitude = Number(data.longitude);

        setConfig(prev => ({
          ...prev,
          latitude: String(data.latitude),
          longitude: String(data.longitude),
        }));
      }

      if ((latitude != null && Number.isNaN(latitude)) || (longitude != null && Number.isNaN(longitude))) {
        throw new Error("Latitude e longitude precisam ser números válidos");
      }

      const { error } = await supabase
        .from("centros_treinamento")
        .update({
          nome: config.nome,
          subtitulo: config.subtitulo,
          endereco: config.endereco,
          logo_url: config.logo_url || null,
          logo_size: config.logo_size,
          banner_url: config.banner_url || null,
          banner_position: config.banner_position,
          nome_font_size: config.nome_font_size,
          endereco_font_size: config.endereco_font_size,
          subtitulo_font_size: config.subtitulo_font_size,
          nome_font_family: config.nome_font_family,
          endereco_font_family: config.endereco_font_family,
          subtitulo_font_family: config.subtitulo_font_family,
          nome_color: config.nome_color,
          endereco_color: config.endereco_color,
          subtitulo_color: config.subtitulo_color,
          latitude,
          longitude,
          raio_presenca_metros: Math.max(Number(config.raio_presenca_metros) || 100, 1),
        } as any)
        .eq("id", ctId);

      if (error) {
        throw error;
      }

      toast.success("Configurações do CT salvas!");
      const nextConfig = {
        ...config,
        latitude: latitude != null ? String(latitude) : "",
        longitude: longitude != null ? String(longitude) : "",
      };
      setConfig(nextConfig);
      setOriginal(nextConfig);
      onSaved?.(nextConfig);
    } catch (error: any) {
      const message = error?.message || "Erro ao salvar configurações do CT";
      if (message.includes("latitude") || message.includes("longitude") || message.includes("raio_presenca_metros")) {
        toast.error("O banco ainda não tem as novas colunas de geolocalização. Aplique a migration no Supabase e tente novamente.");
      } else {
        toast.error(message);
      }
    } finally {
      setGeocodingAddress(false);
      setSaving(false);
    }
  };

  const hasChanges = original && JSON.stringify(config) !== JSON.stringify(original);

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada neste dispositivo");
      return;
    }

    setCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setConfig(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setCapturingLocation(false);
        toast.success("Localização do CT preenchida com sua posição atual.");
      },
      (error) => {
        setCapturingLocation(false);
        toast.error(error.message || "Não foi possível obter sua localização");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const geocodeFromAddress = async () => {
    if (!config.endereco.trim()) {
      toast.error("Preencha o endereço antes de buscar a localização");
      return;
    }

    setGeocodingAddress(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocodificar-endereco", {
        body: {
          endereco: config.endereco,
          nome_ct: config.nome,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao localizar endereço");
      }

      if (!data?.success || !data?.latitude || !data?.longitude) {
        throw new Error("Endereço não encontrado");
      }

      setConfig(prev => ({
        ...prev,
        latitude: String(data.latitude),
        longitude: String(data.longitude),
      }));
      toast.success("Coordenadas preenchidas a partir do endereço.");
    } catch (error: any) {
      toast.error(error.message || "Não foi possível localizar o endereço");
    } finally {
      setGeocodingAddress(false);
    }
  };

  const getFontFamily = (family: string) => {
    if (family === "heading") return undefined; // uses the default font-heading class
    if (family === "sans") return "'Inter', sans-serif";
    return family;
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm animate-pulse">Carregando configurações do CT...</p>;
  }

  if (!ctId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Você não está vinculado a nenhum Centro de Treinamento.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-3 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Label className="text-foreground font-medium">Localização oficial do CT</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Essa localização é usada para validar presença por geolocalização. O raio padrão recomendado é de 100 m.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Latitude</Label>
            <Input
              value={config.latitude}
              onChange={(e) => setConfig(prev => ({ ...prev, latitude: e.target.value }))}
              placeholder="-3.731862"
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Longitude</Label>
            <Input
              value={config.longitude}
              onChange={(e) => setConfig(prev => ({ ...prev, longitude: e.target.value }))}
              placeholder="-38.526670"
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Raio permitido (m)</Label>
            <Input
              value={config.raio_presenca_metros}
              onChange={(e) => setConfig(prev => ({ ...prev, raio_presenca_metros: e.target.value }))}
              placeholder="100"
              className="bg-secondary border-border text-foreground"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={geocodeFromAddress} disabled={geocodingAddress} className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md">
            {geocodingAddress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
            {geocodingAddress ? "Localizando endereço..." : "Buscar coordenadas pelo endereço"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={captureCurrentLocation} disabled={capturingLocation || !!geolocationContextError} className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md">
            {capturingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
            {capturingLocation ? "Obtendo localização..." : "Usar minha localização atual como referência"}
          </Button>
          {geolocationContextError && (
            <p className="text-xs text-destructive">
              {geolocationContextError}
            </p>
          )}
        </div>
      </div>
      {/* Nome do CT */}
      <TextFieldConfig
        label="Nome do Centro de Treinamento"
        value={config.nome}
        onChange={(v) => setConfig(prev => ({ ...prev, nome: v }))}
        placeholder="Nome do CT"
        fontSize={config.nome_font_size}
        onFontSizeChange={(v) => setConfig(prev => ({ ...prev, nome_font_size: v }))}
        fontSizeMin={16} fontSizeMax={48}
        fontFamily={config.nome_font_family}
        onFontFamilyChange={(v) => setConfig(prev => ({ ...prev, nome_font_family: v }))}
        color={config.nome_color}
        onColorChange={(v) => setConfig(prev => ({ ...prev, nome_color: v }))}
      />

      {/* Endereço */}
      <TextFieldConfig
        label="Endereço"
        value={config.endereco}
        onChange={(v) => setConfig(prev => ({ ...prev, endereco: v }))}
        placeholder="Ex: Rua das Flores, 123 - São Paulo/SP"
        fontSize={config.endereco_font_size}
        onFontSizeChange={(v) => setConfig(prev => ({ ...prev, endereco_font_size: v }))}
        fontSizeMin={10} fontSizeMax={24}
        fontFamily={config.endereco_font_family}
        onFontFamilyChange={(v) => setConfig(prev => ({ ...prev, endereco_font_family: v }))}
        color={config.endereco_color}
        onColorChange={(v) => setConfig(prev => ({ ...prev, endereco_color: v }))}
      />

      {/* Subtítulo */}
      <TextFieldConfig
        label="Frase / Subtítulo"
        value={config.subtitulo}
        onChange={(v) => setConfig(prev => ({ ...prev, subtitulo: v }))}
        placeholder="Ex: Centro de Treinamento de Jiu-Jitsu"
        fontSize={config.subtitulo_font_size}
        onFontSizeChange={(v) => setConfig(prev => ({ ...prev, subtitulo_font_size: v }))}
        fontSizeMin={10} fontSizeMax={24}
        fontFamily={config.subtitulo_font_family}
        onFontFamilyChange={(v) => setConfig(prev => ({ ...prev, subtitulo_font_family: v }))}
        color={config.subtitulo_color}
        onColorChange={(v) => setConfig(prev => ({ ...prev, subtitulo_color: v }))}
      />

      {/* Logo */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <Label className="text-foreground font-medium">Logo do CT</Label>
        </div>

        {resolvedLogoUrl ? (
          <div className="space-y-3">
            <div className="relative rounded-md overflow-hidden border border-border bg-secondary/30 flex items-center justify-center" style={{ height: 100 }}>
              <img
                src={resolvedLogoUrl}
                alt="Logo CT"
                className="max-h-full max-w-full object-contain"
                style={{ height: `${Math.min(Number(config.logo_size) || 64, 100)}px` }}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Label className="text-muted-foreground text-xs sm:min-w-[100px]">Tamanho: {config.logo_size}px</Label>
              <Slider
                min={24}
                max={128}
                step={4}
                value={[Number(config.logo_size) || 64]}
                onValueChange={([v]) => setConfig(prev => ({ ...prev, logo_size: String(v) }))}
                className="flex-1"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Trocar
              </Button>
              <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => void handleRemoveImage("logo")}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
            <Upload className="h-3.5 w-3.5 mr-1" /> {uploadingLogo ? "Enviando..." : "Enviar Logo"}
          </Button>
        )}

        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await handleUpload(file, "logo", setUploadingLogo);
            e.target.value = "";
          }}
        />
      </div>

      {/* Banner */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <Label className="text-foreground font-medium">Banner do CT</Label>
        </div>

        {resolvedBannerUrl ? (
          <div className="space-y-3">
            <div className="relative rounded-md overflow-hidden border border-border bg-secondary/30" style={{ height: 120 }}>
              <img
                src={resolvedBannerUrl}
                alt="Banner CT"
                className="w-full h-full object-cover"
                style={{ objectPosition: `center ${config.banner_position}%` }}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Label className="text-muted-foreground text-xs sm:min-w-[100px]">Posição: {config.banner_position}%</Label>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[Number(config.banner_position) || 50]}
                onValueChange={([v]) => setConfig(prev => ({ ...prev, banner_position: String(v) }))}
                className="flex-1"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Trocar
              </Button>
              <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => void handleRemoveImage("banner")}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}>
            <Upload className="h-3.5 w-3.5 mr-1" /> {uploadingBanner ? "Enviando..." : "Enviar Banner"}
          </Button>
        )}

        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await handleUpload(file, "banner", setUploadingBanner);
            e.target.value = "";
          }}
        />
      </div>

      {/* Preview */}
      <div className="rounded-[24px] border-2 border-dashed border-border p-4 space-y-2 sm:rounded-lg">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-heading">Pré-visualização</p>
        <div className="flex flex-col items-center gap-1 py-4">
          {resolvedBannerUrl && (
            <div className="w-full h-16 rounded overflow-hidden mb-2">
              <img src={resolvedBannerUrl} alt="Banner" className="w-full h-full object-cover" style={{ objectPosition: `center ${config.banner_position}%` }} />
            </div>
          )}
          {resolvedLogoUrl && (
            <img src={resolvedLogoUrl} alt="Logo" style={{ height: `${Number(config.logo_size) || 64}px` }} className="object-contain mb-1" />
          )}
          <span
            className={config.nome_font_family === "heading" ? "font-heading uppercase tracking-wider text-center" : "uppercase tracking-wider text-center"}
            style={{
              fontSize: `${Number(config.nome_font_size) || 28}px`,
              color: config.nome_color,
              fontFamily: getFontFamily(config.nome_font_family),
            }}
          >
            {config.nome || "Nome do CT"}
          </span>
          {config.endereco && (
            <span
              className="text-center"
              style={{
                fontSize: `${Number(config.endereco_font_size) || 14}px`,
                color: config.endereco_color,
                fontFamily: getFontFamily(config.endereco_font_family),
              }}
            >
              {config.endereco}
            </span>
          )}
          {config.subtitulo && (
            <span
              className="text-center"
              style={{
                fontSize: `${Number(config.subtitulo_font_size) || 14}px`,
                color: config.subtitulo_color,
                fontFamily: getFontFamily(config.subtitulo_font_family),
              }}
            >
              {config.subtitulo}
            </span>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-center sm:justify-end">
        <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Configurações do CT"}
        </Button>
      </div>
    </div>
  );
};

/** Reusable text field config with font size, family, and color */
const TextFieldConfig = ({
  label, value, onChange, placeholder,
  fontSize, onFontSizeChange, fontSizeMin, fontSizeMax,
  fontFamily, onFontFamilyChange,
  color, onColorChange,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  fontSize: string; onFontSizeChange: (v: string) => void; fontSizeMin: number; fontSizeMax: number;
  fontFamily: string; onFontFamilyChange: (v: string) => void;
  color: string; onColorChange: (v: string) => void;
}) => (
  <div className="space-y-3 border-b border-border pb-4">
    <Label className="text-foreground font-medium">{label}</Label>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-secondary border-border text-foreground"
    />
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Font Size */}
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">Tamanho: {fontSize}px</Label>
        <Slider
          min={fontSizeMin}
          max={fontSizeMax}
          step={1}
          value={[Number(fontSize) || fontSizeMin]}
          onValueChange={([v]) => onFontSizeChange(String(v))}
        />
      </div>
      {/* Font Family */}
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">Fonte</Label>
        <Select value={fontFamily} onValueChange={onFontFamilyChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map(f => (
              <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Color */}
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">Cor</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="h-8 w-10 rounded border border-border cursor-pointer bg-transparent"
          />
          <Input
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="bg-secondary border-border text-foreground font-mono text-xs h-8 w-24"
          />
        </div>
      </div>
    </div>
  </div>
);

export default MestreCTConfigSection;
