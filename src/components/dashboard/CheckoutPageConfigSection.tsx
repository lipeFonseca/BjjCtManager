import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Lock, QrCode, Save, ShieldCheck, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_CHECKOUT_PAGE_CONFIG, useCheckoutPageConfig } from "@/hooks/useCheckoutPageConfig";

const CheckoutPageConfigSection = () => {
  const { config: loadedConfig, loading } = useCheckoutPageConfig();
  const [config, setConfig] = useState({ ...DEFAULT_CHECKOUT_PAGE_CONFIG });
  const [original, setOriginal] = useState({ ...DEFAULT_CHECKOUT_PAGE_CONFIG });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfig(loadedConfig);
    setOriginal(loadedConfig);
  }, [loadedConfig]);

  const hasChanges = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(original),
    [config, original],
  );

  const uploadArtwork = async (file: File) => {
    setUploading(true);

    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `checkout-artwork.${ext}`;

      const { error } = await supabase.storage.from("login-assets").upload(path, file, { upsert: true });
      if (error) {
        toast.error("Erro ao enviar imagem do checkout.");
        return;
      }

      const { data } = supabase.storage.from("login-assets").getPublicUrl(path);
      setConfig((prev) => ({ ...prev, checkout_page_artwork_url: `${data.publicUrl}?t=${Date.now()}` }));
      toast.success("Imagem carregada. Salve para publicar.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Usuario nao autenticado.");
        return;
      }

      const results = await Promise.all(
        Object.entries(config).map(([config_key, config_value]) =>
          supabase.from("layout_config").upsert(
            {
              config_key,
              config_value,
              updated_at: new Date().toISOString(),
              updated_by: user.id,
            },
            { onConflict: "config_key" },
          ),
        ),
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) {
        toast.error("Erro ao salvar configuracoes do checkout.");
        return;
      }

      setOriginal(config);
      toast.success("Configuracoes do checkout salvas.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando configuracoes do checkout...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" /> Conteudo do checkout
            </CardTitle>
            <CardDescription>Edite textos, CTA e a arte do modal final de pagamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Selo superior</Label>
                <Input value={config.checkout_page_badge_text} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_badge_text: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Titulo</Label>
                <Input value={config.checkout_page_title} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_title: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Subtitulo</Label>
                <Textarea rows={3} value={config.checkout_page_subtitle} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_subtitle: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Titulo PIX</Label>
                <Input value={config.checkout_page_pix_title} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_pix_title: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Selo de seguranca</Label>
                <Input value={config.checkout_page_security_badge} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_security_badge: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descricao PIX</Label>
                <Textarea rows={3} value={config.checkout_page_pix_description} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_pix_description: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Dica abaixo do QR Code</Label>
                <Textarea rows={2} value={config.checkout_page_pix_hint} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_pix_hint: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Titulo cartao</Label>
                <Input value={config.checkout_page_card_title} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_card_title: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Botao da pagina de pagamento</Label>
                <Input value={config.checkout_page_invoice_button_label} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_invoice_button_label: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descricao cartao</Label>
                <Textarea rows={3} value={config.checkout_page_card_description} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_card_description: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Botao copiar PIX</Label>
                <Input value={config.checkout_page_copy_button_label} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_copy_button_label: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Botao ir para login</Label>
                <Input value={config.checkout_page_login_button_label} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_login_button_label: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Texto de suporte</Label>
                <Textarea rows={3} value={config.checkout_page_support_text} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_support_text: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Botao fechar</Label>
                <Input value={config.checkout_page_close_button_label} onChange={(event) => setConfig((prev) => ({ ...prev, checkout_page_close_button_label: event.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/80 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" /> Arte lateral
              </CardTitle>
              <CardDescription>Use uma imagem para dar mais acabamento ao modal final.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.checkout_page_artwork_url ? (
                <div className="overflow-hidden rounded-3xl border border-border">
                  <img src={config.checkout_page_artwork_url} alt="Arte do checkout" className="h-56 w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center rounded-3xl border border-dashed border-border text-sm text-muted-foreground">
                  Nenhuma arte enviada
                </div>
              )}

              <input
                ref={artworkInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => event.target.files?.[0] && void uploadArtwork(event.target.files[0])}
              />

              <Button type="button" variant="outline" onClick={() => artworkInputRef.current?.click()} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" /> {uploading ? "Enviando..." : "Enviar imagem"}
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-white/10 bg-[#07090d] text-white shadow-[0_30px_90px_-60px_rgba(220,38,38,0.65)]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.24),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(7,9,13,0.96))] p-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" /> {config.checkout_page_badge_text}
              </div>
              <h3 className="mt-4 font-heading text-3xl uppercase leading-none">{config.checkout_page_title}</h3>
              <p className="mt-3 max-w-xl text-sm text-white/72">{config.checkout_page_subtitle}</p>
            </div>

            <div className="grid gap-5 p-6 lg:grid-cols-[1fr_220px]">
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <QrCode className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.3em]">{config.checkout_page_security_badge}</p>
                  </div>
                  <p className="mt-4 text-lg font-semibold">{config.checkout_page_pix_title}</p>
                  <p className="mt-2 text-sm text-white/68">{config.checkout_page_pix_description}</p>

                  <div className="mt-5 rounded-[28px] border border-white/10 bg-black/30 p-4">
                    <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-[24px] bg-white text-slate-950">
                      QR
                    </div>
                    <p className="mt-4 text-center text-xs text-white/52">{config.checkout_page_pix_hint}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 justify-items-stretch">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">{config.checkout_page_copy_button_label}</Button>
                  <Button variant="outline" className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                    {config.checkout_page_invoice_button_label}
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 justify-items-stretch">
                  <Button variant="outline" className="w-full border-white/15 bg-transparent text-white hover:bg-white/5 hover:text-white">
                    {config.checkout_page_close_button_label}
                  </Button>
                  <Button className="w-full bg-white text-slate-950 hover:bg-white/90">{config.checkout_page_login_button_label}</Button>
                </div>
              </div>

              <div
                className="min-h-[220px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] bg-cover bg-center"
                style={{ backgroundImage: config.checkout_page_artwork_url ? `linear-gradient(180deg,rgba(10,10,10,0.15),rgba(10,10,10,0.62)), url(${config.checkout_page_artwork_url})` : undefined }}
              >
                <div className="flex h-full flex-col justify-end p-5">
                  <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">Preview</p>
                  <p className="mt-3 text-sm text-white/70">{config.checkout_page_support_text}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : "Salvar checkout"}
        </Button>
      </div>
    </div>
  );
};

export default CheckoutPageConfigSection;
