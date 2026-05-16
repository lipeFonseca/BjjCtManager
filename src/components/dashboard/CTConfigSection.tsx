import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Settings, Palette, Image, Upload, Trash2, Sparkles, Maximize, MapPin, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface CTConfigSectionProps {
  centroId: string;
  centroNome: string;
  onBack: () => void;
  onSaved: () => void;
  canManageCt?: boolean;
  onEditCt?: () => void;
  onDeleteCt?: () => void;
}

interface CTStyle {
  cor_primaria: string;
  cor_secundaria: string;
  cor_fundo: string;
  cor_texto: string;
  logo_url: string | null;
  banner_url: string | null;
  neve_ativa: boolean;
  logo_size: string;
  banner_position: string;
  logo_bg_color: string;
  logo_bg_enabled: boolean;
  subtitulo: string;
  endereco: string;
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

interface LayoutHistoryEntry {
  id: string;
  changed_by_name: string;
  changed_fields: string[];
  created_at: string;
}

interface MestreOption {
  user_id: string;
  nome: string;
}

const getFontFamily = (family: string) => {
  if (family === "heading") return undefined;
  if (family === "sans") return "'Inter', sans-serif";
  return family;
};

const CTConfigSection = ({
  centroId,
  centroNome,
  onBack,
  onSaved,
  canManageCt = false,
  onEditCt,
  onDeleteCt,
}: CTConfigSectionProps) => {
  const [style, setStyle] = useState<CTStyle>({
    cor_primaria: "#dc2626",
    cor_secundaria: "#171717",
    cor_fundo: "#0a0a0a",
    cor_texto: "#ffffff",
    logo_url: null,
    banner_url: null,
    neve_ativa: false,
    logo_size: "64",
    banner_position: "50",
    logo_bg_color: "#171717",
    logo_bg_enabled: true,
    subtitulo: "Centro de Treinamento de Jiu-Jitsu",
    endereco: "",
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
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const [layoutHistory, setLayoutHistory] = useState<LayoutHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [mestres, setMestres] = useState<MestreOption[]>([]);
  const [responsavelId, setResponsavelId] = useState("__none__");
  const [savingResponsavel, setSavingResponsavel] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const resolvedAssetUrls = useResolvedCtAssetUrls([style.logo_url, style.banner_url]);
  const resolvedLogoUrl = style.logo_url ? resolvedAssetUrls[style.logo_url] || "" : "";
  const resolvedBannerUrl = style.banner_url ? resolvedAssetUrls[style.banner_url] || "" : "";
  const geolocationContextError = getGeolocationContextError();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("centros_treinamento")
        .select("cor_primaria, cor_secundaria, cor_fundo, cor_texto, logo_url, banner_url, neve_ativa, logo_size, banner_position, logo_bg_color, logo_bg_enabled, subtitulo, endereco, nome_font_size, endereco_font_size, subtitulo_font_size, nome_font_family, endereco_font_family, subtitulo_font_family, nome_color, endereco_color, subtitulo_color, latitude, longitude, raio_presenca_metros")
        .eq("id", centroId)
        .single();
      if (data) {
        const d = data as any;
        setStyle({
          cor_primaria: d.cor_primaria || "#dc2626",
          cor_secundaria: d.cor_secundaria || "#171717",
          cor_fundo: d.cor_fundo || "#0a0a0a",
          cor_texto: d.cor_texto || "#ffffff",
          logo_url: d.logo_url || null,
          banner_url: d.banner_url || null,
          neve_ativa: d.neve_ativa || false,
          logo_size: d.logo_size || "64",
          banner_position: d.banner_position || "50",
          logo_bg_color: d.logo_bg_color || "#171717",
          logo_bg_enabled: d.logo_bg_enabled !== false,
          subtitulo: d.subtitulo || "Centro de Treinamento de Jiu-Jitsu",
          endereco: d.endereco || "",
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
        });
      }
    };
    fetch();
  }, [centroId]);

  const fetchLayoutHistory = async () => {
    setHistoryLoading(true);

    const { data, error } = await supabase
      .from("ct_layout_change_log" as any)
      .select("id, changed_by_name, changed_fields, created_at")
      .eq("ct_id", centroId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      toast.error("Nao foi possivel carregar o historico do layout.");
      setLayoutHistory([]);
    } else {
      setLayoutHistory(((data as any[]) || []).map((entry) => ({
        id: String(entry.id),
        changed_by_name: String(entry.changed_by_name || "Usuario"),
        changed_fields: Array.isArray(entry.changed_fields) ? entry.changed_fields.map(String) : [],
        created_at: String(entry.created_at),
      })));
    }

    setHistoryLoading(false);
  };

  const fetchResponsibleMaster = async () => {
    const { data: ctData, error: ctError } = await supabase
      .from("centros_treinamento")
      .select("mestre_lider_id")
      .eq("id", centroId)
      .maybeSingle();

    if (ctError) {
      toast.error("Nao foi possivel carregar o responsavel do CT.");
      setResponsavelId("__none__");
      setMestres([]);
      return;
    }

    setResponsavelId(ctData?.mestre_lider_id || "__none__");

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, nome, sobrenome")
      .eq("ct_id", centroId);

    if (profilesError) {
      toast.error("Nao foi possivel carregar os mestres do CT.");
      setMestres([]);
      return;
    }

    const userIds = (profiles || []).map((profile: any) => profile.user_id).filter(Boolean);
    if (!userIds.length) {
      setMestres([]);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    if (rolesError) {
      toast.error("Nao foi possivel validar os mestres do CT.");
      setMestres([]);
      return;
    }

    const mestreUserIds = new Set(
      (roles || [])
        .filter((role: any) => role.role === "mestre")
        .map((role: any) => role.user_id),
    );

    setMestres(
      (profiles || [])
        .filter((profile: any) => mestreUserIds.has(profile.user_id))
        .map((profile: any) => ({
          user_id: String(profile.user_id),
          nome: [profile.nome, profile.sobrenome].filter(Boolean).join(" ").trim(),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    );
  };

  const refreshControlPanel = async () => {
    await Promise.all([fetchLayoutHistory(), fetchResponsibleMaster()]);
  };

  useEffect(() => {
    void refreshControlPanel();
  }, [centroId]);

  const formatHistoryDate = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));

  const handleUpdateSuccess = async (message: string) => {
    toast.success(message);
    await refreshControlPanel();
    onSaved();
  };

  const handleSaveResponsibleMaster = async () => {
    setSavingResponsavel(true);

    const { error } = await supabase
      .from("centros_treinamento")
      .update({ mestre_lider_id: responsavelId === "__none__" ? null : responsavelId } as any)
      .eq("id", centroId);

    if (error) {
      toast.error("Nao foi possivel salvar o responsavel do CT.");
    } else {
      await handleUpdateSuccess(
        responsavelId === "__none__"
          ? "Responsavel do CT removido com sucesso!"
          : "Responsavel do CT atualizado com sucesso!",
      );
    }

    setSavingResponsavel(false);
  };

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada neste dispositivo");
      return;
    }

    setCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStyle(prev => ({
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
    if (!style.endereco.trim()) {
      toast.error("Preencha o endereço antes de buscar a localização");
      return;
    }

    setGeocodingAddress(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocodificar-endereco", {
        body: {
          endereco: style.endereco,
          nome_ct: centroNome,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao localizar endereço");
      }

      if (!data?.success || !data?.latitude || !data?.longitude) {
        throw new Error("Endereço não encontrado");
      }

      setStyle(prev => ({
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

  const resolveCoordinatesFromAddress = async () => {
    if (!style.endereco.trim()) {
      throw new Error("Preencha o endereço do CT antes de salvar a localização");
    }

    const { data, error } = await supabase.functions.invoke("geocodificar-endereco", {
      body: {
        endereco: style.endereco,
        nome_ct: centroNome,
      },
    });

    if (error || data?.error) {
      throw new Error(data?.error || error?.message || "Erro ao localizar endereço");
    }

    if (!data?.success || !data?.latitude || !data?.longitude) {
      throw new Error("Endereço não encontrado");
    }

    const latitude = String(data.latitude);
    const longitude = String(data.longitude);

    setStyle(prev => ({
      ...prev,
      latitude,
      longitude,
    }));

    return {
      latitude: Number(latitude),
      longitude: Number(longitude),
    };
  };

  const handleSaveLocation = async () => {
    try {
      let latitude = style.latitude.trim() ? Number(style.latitude) : null;
      let longitude = style.longitude.trim() ? Number(style.longitude) : null;

      if (
        (latitude == null || Number.isNaN(latitude) || longitude == null || Number.isNaN(longitude)) &&
        style.endereco.trim()
      ) {
        setGeocodingAddress(true);
        const resolved = await resolveCoordinatesFromAddress();
        latitude = resolved.latitude;
        longitude = resolved.longitude;
      }

      if ((latitude != null && Number.isNaN(latitude)) || (longitude != null && Number.isNaN(longitude))) {
        throw new Error("Latitude e longitude precisam ser números válidos");
      }

      const { error } = await supabase
        .from("centros_treinamento")
        .update({
          endereco: style.endereco.trim() || null,
          latitude,
          longitude,
          raio_presenca_metros: Math.max(Number(style.raio_presenca_metros) || 100, 1),
        } as any)
        .eq("id", centroId);

      if (error) {
        throw error;
      }

      await handleUpdateSuccess("Localizacao do CT salva!");
    } catch (error: any) {
      const message = error?.message || "Erro ao salvar localização";
      if (message.includes("latitude") || message.includes("longitude") || message.includes("raio_presenca_metros")) {
        toast.error("O banco ainda não tem as novas colunas de geolocalização. Aplique a migration no Supabase e tente novamente.");
        return;
      }
      toast.error(message);
    } finally {
      setGeocodingAddress(false);
    }
  };

  const handleSaveColors = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("centros_treinamento")
      .update({
        cor_primaria: style.cor_primaria,
        cor_secundaria: style.cor_secundaria,
        cor_fundo: style.cor_fundo,
        cor_texto: style.cor_texto,
      } as any)
      .eq("id", centroId);
    if (error) toast.error("Erro ao salvar cores");
    else { await handleUpdateSuccess("Cores salvas!"); }
    setSaving(false);
  };

  const handleUpload = async (file: File, type: "logo" | "banner") => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 5MB)");
      return;
    }

    setUploading(type);
    const path = buildCtPrivateAssetPath(centroId, type, file.name);

    const { error: uploadError } = await supabase.storage.from("ct-private-assets").upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      setUploading(null);
      return;
    }

    const updateField = type === "logo" ? { logo_url: path } : { banner_url: path };
    const { error } = await supabase.from("centros_treinamento").update(updateField as any).eq("id", centroId);
    if (error) toast.error("Erro ao salvar URL");
    else {
      setStyle(prev => ({ ...prev, [`${type}_url`]: path }));
      const labels = { logo: "Logo", banner: "Banner" };
      await handleUpdateSuccess(`${labels[type]} atualizado!`);
    }
    setUploading(null);
  };

  const handleRemoveImage = async (type: "logo" | "banner") => {
    await removeCtPrivateAsset(type === "logo" ? style.logo_url : style.banner_url);
    const updateField = type === "logo" ? { logo_url: null } : { banner_url: null };
    const { error } = await supabase.from("centros_treinamento").update(updateField as any).eq("id", centroId);
    if (error) toast.error("Erro ao remover");
    else {
      setStyle(prev => ({ ...prev, [`${type}_url`]: null }));
      const labels = { logo: "Logo", banner: "Banner" };
      await handleUpdateSuccess(`${labels[type]} removido!`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Button variant="ghost" size="sm" className="mb-4 h-11 w-full justify-center rounded-xl text-muted-foreground sm:h-9 sm:w-auto sm:justify-start sm:rounded-md" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para {centroNome}
      </Button>

      <div className="mb-8 flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-3xl uppercase text-foreground">Configurações do CT</h1>
      </div>

      <Tabs defaultValue="ajustes" className="w-full">
        <div className="glass-card mb-6 rounded-[24px] p-4 sm:rounded-lg sm:p-5">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-2">
            <TabsTrigger value="ajustes" className="w-full justify-center rounded-xl sm:rounded-md">
              Ajustes do Layout
            </TabsTrigger>
            <TabsTrigger value="historico" className="w-full justify-center rounded-xl sm:rounded-md">
              Historico e Responsavel
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ajustes" className="space-y-0">
      {/* Preview */}
      <div className="glass-card rounded-[24px] p-5 mb-8 sm:rounded-lg sm:p-6">
        <h2 className="font-heading text-lg uppercase text-foreground mb-4">Pré-visualização</h2>
        <div className="rounded-lg overflow-hidden border border-border" style={{ backgroundColor: style.cor_fundo }}>
           {resolvedBannerUrl && (
            <div className="w-full h-32 overflow-hidden">
              <img src={resolvedBannerUrl} alt="Banner" className="w-full h-full object-cover" style={{ objectPosition: `center ${style.banner_position}%` }} />
            </div>
          )}
          <div className="p-6" style={{ color: style.cor_texto }}>
            <div className="mb-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              {resolvedLogoUrl && (
                <img src={resolvedLogoUrl} alt="Logo" className="rounded-lg object-contain" style={{ height: `${style.logo_size}px`, width: `${style.logo_size}px`, backgroundColor: style.logo_bg_enabled ? style.logo_bg_color : "transparent" }} />
              )}
              <div className="flex flex-col">
                <span
                  className={`${style.nome_font_family === "heading" ? "font-heading" : ""} uppercase tracking-wider`}
                  style={{
                    fontSize: `${style.nome_font_size}px`,
                    color: style.nome_color,
                    fontFamily: getFontFamily(style.nome_font_family),
                  }}
                >
                  {centroNome}
                </span>
                {style.endereco && (
                  <span style={{
                    fontSize: `${style.endereco_font_size}px`,
                    color: style.endereco_color,
                    fontFamily: getFontFamily(style.endereco_font_family),
                  }}>
                    {style.endereco}
                  </span>
                )}
                {style.subtitulo && (
                  <span style={{
                    fontSize: `${style.subtitulo_font_size}px`,
                    color: style.subtitulo_color,
                    fontFamily: getFontFamily(style.subtitulo_font_family),
                  }}>
                    {style.subtitulo}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <span className="px-4 py-1.5 rounded text-sm font-bold" style={{ backgroundColor: style.cor_primaria, color: style.cor_texto }}>
                Botão Primário
              </span>
              <span className="px-4 py-1.5 rounded text-sm font-bold" style={{ backgroundColor: style.cor_secundaria, color: style.cor_texto }}>
                Botão Secundário
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[24px] p-5 mb-8 sm:rounded-lg sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg uppercase text-foreground">Geolocalização do CT</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Esses dados definem o perímetro usado para presença por geolocalização. O valor padrão recomendado é de 100 m.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-foreground">Latitude</Label>
            <Input value={style.latitude} onChange={(e) => setStyle(prev => ({ ...prev, latitude: e.target.value }))} placeholder="-3.731862" className="bg-secondary border-border text-foreground" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Longitude</Label>
            <Input value={style.longitude} onChange={(e) => setStyle(prev => ({ ...prev, longitude: e.target.value }))} placeholder="-38.526670" className="bg-secondary border-border text-foreground" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Raio permitido (m)</Label>
            <Input value={style.raio_presenca_metros} onChange={(e) => setStyle(prev => ({ ...prev, raio_presenca_metros: e.target.value }))} placeholder="100" className="bg-secondary border-border text-foreground" />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={geocodeFromAddress} disabled={geocodingAddress}>
            {geocodingAddress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
            {geocodingAddress ? "Localizando endereço..." : "Buscar coordenadas pelo endereço"}
          </Button>
          <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={captureCurrentLocation} disabled={capturingLocation || !!geolocationContextError}>
            {capturingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
            {capturingLocation ? "Obtendo localização..." : "Usar minha localização atual"}
          </Button>
          {geolocationContextError && (
            <p className="text-xs text-destructive">
              {geolocationContextError}
            </p>
          )}
          <Button size="sm" variant="outline" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={handleSaveLocation}>
            Salvar Localização
          </Button>
        </div>
      </div>

      {/* Colors */}
      <div className="glass-card rounded-[24px] p-5 mb-8 sm:rounded-lg sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg uppercase text-foreground">Cores</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {([
            { key: "cor_primaria", label: "Cor Primária" },
            { key: "cor_secundaria", label: "Cor Secundária" },
            { key: "cor_fundo", label: "Cor de Fundo" },
            { key: "cor_texto", label: "Cor do Texto" },
          ] as const).map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label className="text-foreground">{label}</Label>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <input
                  type="color"
                  value={style[key]}
                  onChange={(e) => setStyle(prev => ({ ...prev, [key]: e.target.value }))}
                  className="h-10 w-14 rounded border border-border cursor-pointer bg-transparent"
                />
                <Input
                  value={style[key]}
                  onChange={(e) => setStyle(prev => ({ ...prev, [key]: e.target.value }))}
                  className="bg-secondary border-border text-foreground font-mono text-sm w-full sm:w-32"
                />
              </div>
            </div>
          ))}
        </div>
        <Button onClick={handleSaveColors} disabled={saving} className="mt-6 h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:rounded-md">
          {saving ? "Salvando..." : "Salvar Cores"}
        </Button>
      </div>

      {/* Logo */}
      <div className="glass-card rounded-[24px] p-5 mb-8 sm:rounded-lg sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Image className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg uppercase text-foreground">Logo</h2>
        </div>
        {resolvedLogoUrl ? (
          <div className="mb-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
            <img src={resolvedLogoUrl} alt="Logo atual" className="h-20 w-20 rounded-lg object-contain bg-secondary border border-border" />
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => logoInputRef.current?.click()} disabled={uploading === "logo"}>
                <Upload className="mr-2 h-4 w-4" /> {uploading === "logo" ? "Enviando..." : "Alterar Logo"}
              </Button>
              <Button variant="ghost" size="sm" className="h-11 w-full rounded-xl text-destructive hover:text-destructive sm:h-9 sm:w-auto sm:rounded-md" onClick={() => handleRemoveImage("logo")}>
                <Trash2 className="mr-2 h-4 w-4" /> Remover
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:rounded-md" onClick={() => logoInputRef.current?.click()} disabled={uploading === "logo"}>
            <Upload className="mr-2 h-4 w-4" /> {uploading === "logo" ? "Enviando..." : "Adicionar Logo"}
          </Button>
        )}
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0], "logo"); e.target.value = ""; }} />
        <p className="text-muted-foreground text-xs mt-2">Formatos: PNG, JPG, SVG, WebP. Máximo 5MB.</p>
        
        {/* Logo Size Slider */}
        <div className="mt-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label className="text-foreground flex items-center gap-2"><Maximize className="h-4 w-4" /> Tamanho da Logo</Label>
            <span className="text-muted-foreground text-sm">{style.logo_size}px</span>
          </div>
          <Slider
            value={[Number(style.logo_size)]}
            onValueChange={([v]) => setStyle(prev => ({ ...prev, logo_size: String(v) }))}
            min={32}
            max={200}
            step={4}
            className="w-full"
          />
          <Button size="sm" className="w-full sm:w-fit" variant="outline" onClick={async () => {
            const { error } = await supabase.from("centros_treinamento").update({ logo_size: style.logo_size } as any).eq("id", centroId);
            if (error) toast.error("Erro ao salvar"); else { await handleUpdateSuccess("Tamanho da logo salvo!"); }
          }}>Salvar Tamanho</Button>
        </div>

        {/* Logo Background */}
        <div className="mt-6 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Label className="text-foreground">Fundo da Logo</Label>
            <Switch
              checked={style.logo_bg_enabled}
              onCheckedChange={async (checked) => {
                setStyle(prev => ({ ...prev, logo_bg_enabled: checked }));
                const { error } = await supabase.from("centros_treinamento").update({ logo_bg_enabled: checked } as any).eq("id", centroId);
                if (error) toast.error("Erro ao salvar"); else { await handleUpdateSuccess(checked ? "Fundo ativado!" : "Fundo removido!"); }
              }}
            />
          </div>
          <p className="text-muted-foreground text-xs">Desative para que a logo apareça sem fundo (transparente sobre o banner)</p>
          {style.logo_bg_enabled && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Label className="text-foreground text-sm sm:min-w-[88px]">Cor do fundo</Label>
              <input
                type="color"
                value={style.logo_bg_color}
                onChange={(e) => setStyle(prev => ({ ...prev, logo_bg_color: e.target.value }))}
                className="h-8 w-12 rounded border border-border cursor-pointer bg-transparent"
              />
              <Input
                value={style.logo_bg_color}
                onChange={(e) => setStyle(prev => ({ ...prev, logo_bg_color: e.target.value }))}
                className="bg-secondary border-border text-foreground font-mono text-sm w-full sm:w-28"
              />
              <Button size="sm" className="w-full sm:w-fit" variant="outline" onClick={async () => {
                const { error } = await supabase.from("centros_treinamento").update({ logo_bg_color: style.logo_bg_color } as any).eq("id", centroId);
                if (error) toast.error("Erro ao salvar"); else { await handleUpdateSuccess("Cor do fundo salva!"); }
              }}>Salvar</Button>
            </div>
          )}
        </div>
      </div>

      {/* Texto do CT */}
      <div className="glass-card rounded-[24px] p-5 mb-8 sm:rounded-lg sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg uppercase text-foreground">Textos do Cabeçalho</h2>
        </div>
        <div className="space-y-6">
          {/* Nome */}
          <CTTextFieldConfig
            label="Nome do CT"
            value={centroNome}
            disabled
            fontSize={style.nome_font_size}
            onFontSizeChange={(v) => setStyle(prev => ({ ...prev, nome_font_size: v }))}
            fontSizeMin={18} fontSizeMax={48}
            fontFamily={style.nome_font_family}
            onFontFamilyChange={(v) => setStyle(prev => ({ ...prev, nome_font_family: v }))}
            color={style.nome_color}
            onColorChange={(v) => setStyle(prev => ({ ...prev, nome_color: v }))}
          />

          {/* Endereço */}
          <CTTextFieldConfig
            label="Endereço"
            value={style.endereco}
            onChange={(v) => setStyle(prev => ({ ...prev, endereco: v }))}
            placeholder="Ex: Rua das Flores, 123 - São Paulo/SP"
            fontSize={style.endereco_font_size}
            onFontSizeChange={(v) => setStyle(prev => ({ ...prev, endereco_font_size: v }))}
            fontSizeMin={10} fontSizeMax={24}
            fontFamily={style.endereco_font_family}
            onFontFamilyChange={(v) => setStyle(prev => ({ ...prev, endereco_font_family: v }))}
            color={style.endereco_color}
            onColorChange={(v) => setStyle(prev => ({ ...prev, endereco_color: v }))}
          />

          {/* Subtítulo */}
          <CTTextFieldConfig
            label="Subtítulo / Frase"
            value={style.subtitulo}
            onChange={(v) => setStyle(prev => ({ ...prev, subtitulo: v }))}
            placeholder="Ex: Centro de Treinamento de Jiu-Jitsu"
            fontSize={style.subtitulo_font_size}
            onFontSizeChange={(v) => setStyle(prev => ({ ...prev, subtitulo_font_size: v }))}
            fontSizeMin={10} fontSizeMax={24}
            fontFamily={style.subtitulo_font_family}
            onFontFamilyChange={(v) => setStyle(prev => ({ ...prev, subtitulo_font_family: v }))}
            color={style.subtitulo_color}
            onColorChange={(v) => setStyle(prev => ({ ...prev, subtitulo_color: v }))}
          />

          <Button size="sm" variant="outline" onClick={async () => {
            const { error } = await supabase.from("centros_treinamento").update({
              nome_font_size: style.nome_font_size, subtitulo: style.subtitulo, endereco: style.endereco,
              endereco_font_size: style.endereco_font_size, subtitulo_font_size: style.subtitulo_font_size,
              nome_font_family: style.nome_font_family, endereco_font_family: style.endereco_font_family, subtitulo_font_family: style.subtitulo_font_family,
              nome_color: style.nome_color, endereco_color: style.endereco_color, subtitulo_color: style.subtitulo_color,
            } as any).eq("id", centroId);
            if (error) toast.error("Erro ao salvar"); else { await handleUpdateSuccess("Textos salvos!"); }
          }}>Salvar Textos</Button>
        </div>
      </div>



      <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Image className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg uppercase text-foreground">Banner</h2>
        </div>
        {resolvedBannerUrl ? (
          <div className="space-y-4">
            <img src={resolvedBannerUrl} alt="Banner atual" className="w-full h-32 rounded-lg object-cover border border-border" />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="sm" className="h-11 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md" onClick={() => bannerInputRef.current?.click()} disabled={uploading === "banner"}>
                <Upload className="mr-2 h-4 w-4" /> {uploading === "banner" ? "Enviando..." : "Alterar Banner"}
              </Button>
              <Button variant="ghost" size="sm" className="h-11 w-full rounded-xl text-destructive hover:text-destructive sm:h-9 sm:w-auto sm:rounded-md" onClick={() => handleRemoveImage("banner")}>
                <Trash2 className="mr-2 h-4 w-4" /> Remover
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:rounded-md" onClick={() => bannerInputRef.current?.click()} disabled={uploading === "banner"}>
            <Upload className="mr-2 h-4 w-4" /> {uploading === "banner" ? "Enviando..." : "Adicionar Banner"}
          </Button>
        )}
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0], "banner"); e.target.value = ""; }} />
        <p className="text-muted-foreground text-xs mt-2">Recomendado: 1200x300px. Máximo 5MB.</p>
        
        {/* Banner Position Slider */}
        <div className="mt-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label className="text-foreground flex items-center gap-2"><Maximize className="h-4 w-4" /> Posição Vertical do Banner</Label>
            <span className="text-muted-foreground text-sm">{style.banner_position}%</span>
          </div>
          <Slider
            value={[Number(style.banner_position)]}
            onValueChange={([v]) => setStyle(prev => ({ ...prev, banner_position: String(v) }))}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <Button size="sm" variant="outline" onClick={async () => {
            const { error } = await supabase.from("centros_treinamento").update({ banner_position: style.banner_position } as any).eq("id", centroId);
            if (error) toast.error("Erro ao salvar"); else { await handleUpdateSuccess("Posicao do banner salva!"); }
          }}>Salvar Posição</Button>
        </div>
      </div>

      {/* Estilização */}
      <div className="glass-card rounded-[24px] p-5 mt-8 sm:rounded-lg sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg uppercase text-foreground">Estilização</h2>
        </div>
        <div className="flex flex-col gap-4 rounded-[20px] border border-border bg-secondary/50 p-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left sm:rounded-lg">
          <div>
            <p className="text-foreground font-medium">❄️ Flocos de Neve</p>
            <p className="text-muted-foreground text-sm">Ativa efeito de neve caindo na tela dos membros deste CT</p>
          </div>
          <Switch
            checked={style.neve_ativa}
            onCheckedChange={async (checked) => {
              setStyle(prev => ({ ...prev, neve_ativa: checked }));
              const { error } = await supabase
                .from("centros_treinamento")
                .update({ neve_ativa: checked } as any)
                .eq("id", centroId);
              if (error) {
                toast.error("Erro ao salvar");
                setStyle(prev => ({ ...prev, neve_ativa: !checked }));
              } else {
                await handleUpdateSuccess(checked ? "Neve ativada!" : "Neve desativada!");
              }
            }}
          />
        </div>
      </div>
        </TabsContent>

        <TabsContent value="historico" className="space-y-8">
          {canManageCt && (
            <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <Settings className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-lg uppercase text-foreground">Acoes do CT</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Edite os dados principais do centro ou exclua o CT a partir daqui.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={onEditCt}
                  className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:rounded-md"
                >
                  Editar CT
                </Button>
                <Button
                  variant="destructive"
                  onClick={onDeleteCt}
                  className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:rounded-md"
                >
                  Apagar CT
                </Button>
              </div>
            </div>
          )}

          <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-lg uppercase text-foreground">Responsavel do CT</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Defina qual mestre sera o responsavel operacional do CT para configuracoes restritas.
            </p>
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label className="text-foreground">Mestre responsavel</Label>
                <Select value={responsavelId} onValueChange={setResponsavelId}>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Selecione um mestre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum mestre definido</SelectItem>
                    {mestres.map((mestre) => (
                      <SelectItem key={mestre.user_id} value={mestre.user_id}>
                        {mestre.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleSaveResponsibleMaster}
                disabled={savingResponsavel || !mestres.length}
                className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:rounded-md"
              >
                {savingResponsavel ? "Salvando..." : "Salvar Responsavel"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Somente o mestre responsavel acessa configuracoes restritas e o financeiro manual do proprio CT. Integracoes externas como Asaas ficam restritas ao financeiro SaaS do admin.
            </p>
          </div>

          <div className="glass-card rounded-[24px] p-5 sm:rounded-lg sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-lg uppercase text-foreground">Ultimas alteracoes do layout</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              O sistema mantem apenas as 5 alteracoes mais recentes para evitar acumulo desnecessario no banco.
            </p>

            {historyLoading ? (
              <div className="rounded-2xl border border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                Carregando historico...
              </div>
            ) : layoutHistory.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                Nenhuma alteracao de layout foi registrada para este CT ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {layoutHistory.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-foreground">{entry.changed_by_name}</p>
                      <p className="text-xs text-muted-foreground">{formatHistoryDate(entry.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.changed_fields.map((field) => (
                        <span
                          key={`${entry.id}-${field}`}
                          className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

/** Reusable text field config for CT admin */
const CTTextFieldConfig = ({
  label, value, onChange, placeholder, disabled,
  fontSize, onFontSizeChange, fontSizeMin, fontSizeMax,
  fontFamily, onFontFamilyChange,
  color, onColorChange,
}: {
  label: string; value: string; onChange?: (v: string) => void; placeholder?: string; disabled?: boolean;
  fontSize: string; onFontSizeChange: (v: string) => void; fontSizeMin: number; fontSizeMax: number;
  fontFamily: string; onFontFamilyChange: (v: string) => void;
  color: string; onColorChange: (v: string) => void;
}) => (
  <div className="space-y-3 border-b border-border pb-4">
    <Label className="text-foreground font-medium">{label}</Label>
    {!disabled && onChange && (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-secondary border-border text-foreground"
      />
    )}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

export default CTConfigSection;
