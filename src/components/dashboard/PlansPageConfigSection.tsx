import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { DEFAULT_PLANS_PAGE_CONFIG, getSafeComparisonColumns, getSafeFeatureCarouselItems, getSafeProblemColumns, getSafeReviewItems, getSafeTrustItems, parseComparisonColumns, parseFeatureCarouselItems, parsePopupNames, parseProblemColumns, parseReviewItems, parseTrustItems, usePlansPageConfig, type ComparisonColumn, type FeatureCarouselItem, type ProblemColumn, type ReviewItem, type TrustItem } from "@/hooks/usePlansPageConfig";
import { Image, Plus, Save, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react";

type TrustItemEditor = TrustItem & { id: string };
type ReviewItemEditor = ReviewItem & { id: string };
type FeatureCarouselItemEditor = FeatureCarouselItem & { id: string };
type ComparisonColumnEditor = ComparisonColumn & { id: string; itemsText: string };
type ProblemColumnEditor = ProblemColumn & { id: string; itemsText: string };

const createEditorId = () => `editor-${Math.random().toString(36).slice(2, 10)}`;
const createTrustItem = (): TrustItemEditor => ({ id: createEditorId(), label: "", enabled: true });
const createReviewItem = (): ReviewItemEditor => ({ id: createEditorId(), name: "", role: "", text: "", image_url: "", enabled: true });
const createFeatureCarouselItem = (): FeatureCarouselItemEditor => ({ id: createEditorId(), title: "", description: "", image_url: "", enabled: true });
const createComparisonColumn = (): ComparisonColumnEditor => ({ id: createEditorId(), title: "", items: [], itemsText: "", enabled: true });
const createProblemColumn = (): ProblemColumnEditor => ({ id: createEditorId(), title: "", items: [], itemsText: "", enabled: true });
const toTrustEditorItems = (items: TrustItem[]) => items.map((item) => ({ ...item, id: createEditorId() }));
const toReviewEditorItems = (items: ReviewItem[]) => items.map((item) => ({ ...item, id: createEditorId() }));
const toFeatureCarouselEditorItems = (items: FeatureCarouselItem[]) => items.map((item) => ({ ...item, id: createEditorId() }));
const toComparisonColumnEditorItems = (items: ComparisonColumn[]) => items.map((item) => ({ ...item, id: createEditorId(), itemsText: item.items.join("\n") }));
const toProblemColumnEditorItems = (items: ProblemColumn[]) => items.map((item) => ({ ...item, id: createEditorId(), itemsText: item.items.join("\n") }));
const stripTrustEditorItems = (items: TrustItemEditor[]): TrustItem[] => items.map(({ id: _id, ...item }) => item);
const stripReviewEditorItems = (items: ReviewItemEditor[]): ReviewItem[] => items.map(({ id: _id, ...item }) => item);
const stripFeatureCarouselEditorItems = (items: FeatureCarouselItemEditor[]): FeatureCarouselItem[] => items.map(({ id: _id, ...item }) => item);
const stripComparisonColumnEditorItems = (items: ComparisonColumnEditor[]): ComparisonColumn[] =>
  items.map(({ id: _id, itemsText, ...item }) => ({
    ...item,
    items: itemsText.split("\n").map((entry) => entry.trim()).filter(Boolean),
  }));
const stripProblemColumnEditorItems = (items: ProblemColumnEditor[]): ProblemColumn[] =>
  items.map(({ id: _id, itemsText, ...item }) => ({
    ...item,
    items: itemsText.split("\n").map((entry) => entry.trim()).filter(Boolean),
  }));

const PlansPageConfigSection = () => {
  const { config: loadedConfig, loading } = usePlansPageConfig();
  const [config, setConfig] = useState({ ...DEFAULT_PLANS_PAGE_CONFIG });
  const [original, setOriginal] = useState({ ...DEFAULT_PLANS_PAGE_CONFIG });
  const [trustItems, setTrustItems] = useState<TrustItemEditor[]>(toTrustEditorItems(parseTrustItems(DEFAULT_PLANS_PAGE_CONFIG.plans_page_trust_items)));
  const [featureCarouselItems, setFeatureCarouselItems] = useState<FeatureCarouselItemEditor[]>(toFeatureCarouselEditorItems(getSafeFeatureCarouselItems(DEFAULT_PLANS_PAGE_CONFIG.plans_page_feature_carousel_items)));
  const [comparisonColumns, setComparisonColumns] = useState<ComparisonColumnEditor[]>(toComparisonColumnEditorItems(getSafeComparisonColumns(DEFAULT_PLANS_PAGE_CONFIG.plans_page_comparison_columns)));
  const [problemColumns, setProblemColumns] = useState<ProblemColumnEditor[]>(toProblemColumnEditorItems(getSafeProblemColumns(DEFAULT_PLANS_PAGE_CONFIG.plans_page_problems_columns)));
  const [reviews, setReviews] = useState<ReviewItemEditor[]>(toReviewEditorItems(parseReviewItems(DEFAULT_PLANS_PAGE_CONFIG.plans_page_reviews)));
  const [saving, setSaving] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [uploadingFooter, setUploadingFooter] = useState(false);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfig(loadedConfig);
    setOriginal(loadedConfig);
    setTrustItems(toTrustEditorItems(getSafeTrustItems(loadedConfig.plans_page_trust_items)));
    setFeatureCarouselItems(toFeatureCarouselEditorItems(getSafeFeatureCarouselItems(loadedConfig.plans_page_feature_carousel_items)));
    setComparisonColumns(toComparisonColumnEditorItems(getSafeComparisonColumns(loadedConfig.plans_page_comparison_columns)));
    setProblemColumns(toProblemColumnEditorItems(getSafeProblemColumns(loadedConfig.plans_page_problems_columns)));
    setReviews(toReviewEditorItems(getSafeReviewItems(loadedConfig.plans_page_reviews)));
  }, [loadedConfig]);

  const popupPreviewNames = useMemo(
    () => parsePopupNames(config.plans_page_popup_names).slice(0, 3),
    [config.plans_page_popup_names],
  );

  const hasChanges =
    JSON.stringify(config) !== JSON.stringify(original) ||
    JSON.stringify(stripTrustEditorItems(trustItems)) !== JSON.stringify(parseTrustItems(original.plans_page_trust_items)) ||
    JSON.stringify(stripFeatureCarouselEditorItems(featureCarouselItems)) !== JSON.stringify(parseFeatureCarouselItems(original.plans_page_feature_carousel_items)) ||
    JSON.stringify(stripComparisonColumnEditorItems(comparisonColumns)) !== JSON.stringify(parseComparisonColumns(original.plans_page_comparison_columns)) ||
    JSON.stringify(stripProblemColumnEditorItems(problemColumns)) !== JSON.stringify(parseProblemColumns(original.plans_page_problems_columns)) ||
    JSON.stringify(stripReviewEditorItems(reviews)) !== JSON.stringify(parseReviewItems(original.plans_page_reviews));

  const uploadImage = async (file: File, type: "header" | "footer", reviewIndex?: number) => {
    const setUploading = type === "header" ? setUploadingHeader : setUploadingFooter;
    setUploading(true);

    try {
      const ext = file.name.split(".").pop() || "png";
      const suffix = typeof reviewIndex === "number" ? `-review-${reviewIndex}` : "";
      const path = `plans-${type}${suffix}.${ext}`;

      const { error } = await supabase.storage.from("login-assets").upload(path, file, { upsert: true });
      if (error) {
        toast.error("Erro ao enviar imagem.");
        return;
      }

      const { data } = supabase.storage.from("login-assets").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      if (typeof reviewIndex === "number") {
        setReviews((prev) => prev.map((item, index) => (index === reviewIndex ? { ...item, image_url: publicUrl } : item)));
      } else {
        const key = type === "header" ? "plans_page_header_image_url" : "plans_page_footer_image_url";
        setConfig((prev) => ({ ...prev, [key]: publicUrl }));
      }

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

      const payload = {
        ...config,
        plans_page_trust_items: JSON.stringify(stripTrustEditorItems(trustItems).filter((item) => item.label.trim())),
        plans_page_feature_carousel_items: JSON.stringify(stripFeatureCarouselEditorItems(featureCarouselItems).filter((item) => item.title.trim() || item.description.trim() || item.image_url.trim())),
        plans_page_comparison_columns: JSON.stringify(stripComparisonColumnEditorItems(comparisonColumns).filter((item) => item.title.trim() || item.items.length > 0)),
        plans_page_problems_columns: JSON.stringify(stripProblemColumnEditorItems(problemColumns).filter((item) => item.title.trim() || item.items.length > 0)),
        plans_page_reviews: JSON.stringify(stripReviewEditorItems(reviews).filter((item) => item.name.trim() || item.text.trim())),
      };

      const results = await Promise.all(
        Object.entries(payload).map(([config_key, config_value]) =>
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
        toast.error("Erro ao salvar configuracoes da pagina.");
        return;
      }

      setOriginal(payload);
      toast.success("Configuracoes da pagina de planos salvas.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando configuracoes da pagina...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-border/70 bg-background/35 p-4 sm:p-5">
        <Tabs defaultValue="hero" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 lg:grid-cols-7">
            <TabsTrigger value="hero" className="rounded-xl">Hero</TabsTrigger>
            <TabsTrigger value="confianca" className="rounded-xl">Confianca</TabsTrigger>
            <TabsTrigger value="beneficios" className="rounded-xl">Beneficios</TabsTrigger>
            <TabsTrigger value="comparativo" className="rounded-xl">Comparativo</TabsTrigger>
            <TabsTrigger value="problemas" className="rounded-xl">Problemas</TabsTrigger>
            <TabsTrigger value="avaliacoes" className="rounded-xl">Avaliacoes</TabsTrigger>
            <TabsTrigger value="popup" className="rounded-xl">Popup</TabsTrigger>
          </TabsList>

          <TabsContent value="hero" className="mt-6">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-border/80 bg-card/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Conteudo principal
                  </CardTitle>
                  <CardDescription>Defina titulo, subtitulo e frase motivacional em uma area mais limpa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Titulo</Label>
                    <Input
                      value={config.plans_page_title}
                      onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_title: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtitulo</Label>
                    <Textarea
                      rows={4}
                      value={config.plans_page_subtitle}
                      onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_subtitle: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Frase motivacional</Label>
                    <Textarea
                      rows={4}
                      value={config.plans_page_motivational_text}
                      onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_motivational_text: event.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5 text-primary" /> Imagens de destaque
                  </CardTitle>
                  <CardDescription>Gerencie cabecalho e rodape da pagina de forma isolada.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-3">
                    <Label>Imagem de cabecalho</Label>
                    {config.plans_page_header_image_url ? (
                      <div className="relative overflow-hidden rounded-2xl border border-border">
                        <img src={config.plans_page_header_image_url} alt="Cabecalho" className="h-36 w-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute right-3 top-3"
                          onClick={() => setConfig((prev) => ({ ...prev, plans_page_header_image_url: "" }))}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remover
                        </Button>
                      </div>
                    ) : (
                      <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                        Nenhuma imagem enviada
                      </div>
                    )}
                    <input
                      ref={headerInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0], "header")}
                    />
                    <Button type="button" variant="outline" onClick={() => headerInputRef.current?.click()} disabled={uploadingHeader}>
                      <Upload className="mr-2 h-4 w-4" /> {uploadingHeader ? "Enviando..." : "Enviar cabecalho"}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <Label>Imagem de rodape</Label>
                    {config.plans_page_footer_image_url ? (
                      <div className="relative overflow-hidden rounded-2xl border border-border">
                        <img src={config.plans_page_footer_image_url} alt="Rodape" className="h-32 w-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute right-3 top-3"
                          onClick={() => setConfig((prev) => ({ ...prev, plans_page_footer_image_url: "" }))}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remover
                        </Button>
                      </div>
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                        Nenhuma imagem enviada
                      </div>
                    )}
                    <input
                      ref={footerInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0], "footer")}
                    />
                    <Button type="button" variant="outline" onClick={() => footerInputRef.current?.click()} disabled={uploadingFooter}>
                      <Upload className="mr-2 h-4 w-4" /> {uploadingFooter ? "Enviando..." : "Enviar rodape"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="confianca" className="mt-6">
            <Card className="border-border/80 bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Itens de confianca
                </CardTitle>
                <CardDescription>Edite seguranca e credibilidade sem disputar espaco com as outras configuracoes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {trustItems.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-2xl border border-border/70 bg-background/30 p-4 md:grid-cols-[1fr_auto_auto]">
                    <Input
                      value={item.label}
                      onChange={(event) =>
                        setTrustItems((prev) => prev.map((current) => (current.id === item.id ? { ...current, label: event.target.value } : current)))
                      }
                      placeholder="Ex: Pagamento protegido e onboarding assistido"
                    />
                    <div className="flex items-center gap-2 rounded-xl border border-border px-3">
                      <Label className="text-sm text-muted-foreground">Ativo</Label>
                      <Switch
                        checked={item.enabled}
                        onCheckedChange={(checked) =>
                          setTrustItems((prev) => prev.map((current) => (current.id === item.id ? { ...current, enabled: checked } : current)))
                        }
                      />
                    </div>
                    <Button type="button" variant="ghost" onClick={() => setTrustItems((prev) => prev.filter((current) => current.id !== item.id))}>
                      <Trash2 className="mr-2 h-4 w-4" /> Remover
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setTrustItems((prev) => [...prev, createTrustItem()])}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar item
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="beneficios" className="mt-6">
            <Card className="border-border/80 bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Carrossel de beneficios</CardTitle>
                    <CardDescription>Cards com imagem de fundo e texto sobreposto, inspirados nas referencias que voce enviou.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2">
                    <Label className="text-sm text-muted-foreground">Ativo</Label>
                    <Switch
                      checked={config.plans_page_feature_carousel_enabled === "true"}
                      onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, plans_page_feature_carousel_enabled: checked ? "true" : "false" }))}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {featureCarouselItems.map((item, index) => (
                  <div key={item.id} className="space-y-4 rounded-[28px] border border-border/70 bg-background/30 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Titulo</Label>
                        <Input
                          value={item.title}
                          onChange={(event) =>
                            setFeatureCarouselItems((prev) => prev.map((current) => (current.id === item.id ? { ...current, title: event.target.value } : current)))
                          }
                        />
                      </div>
                      <div className="flex items-end justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Item ativo</p>
                          <p className="text-xs text-muted-foreground">Controle individual do card.</p>
                        </div>
                        <Switch
                          checked={item.enabled}
                          onCheckedChange={(checked) =>
                            setFeatureCarouselItems((prev) => prev.map((current) => (current.id === item.id ? { ...current, enabled: checked } : current)))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descricao</Label>
                      <Textarea
                        rows={4}
                        value={item.description}
                        onChange={(event) =>
                          setFeatureCarouselItems((prev) => prev.map((current) => (current.id === item.id ? { ...current, description: event.target.value } : current)))
                        }
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label>Imagem</Label>
                        <Input
                          value={item.image_url}
                          onChange={(event) =>
                            setFeatureCarouselItems((prev) => prev.map((current) => (current.id === item.id ? { ...current, image_url: event.target.value } : current)))
                          }
                          placeholder="URL publica da imagem"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button type="button" variant="ghost" onClick={() => setFeatureCarouselItems((prev) => prev.filter((current) => current.id !== item.id))}>
                          <Trash2 className="mr-2 h-4 w-4" /> Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setFeatureCarouselItems((prev) => [...prev, createFeatureCarouselItem()])}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar card
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comparativo" className="mt-6">
            <Card className="border-border/80 bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Secao comparativa</CardTitle>
                    <CardDescription>Bloco comparando o BJJ Manager com sistemas genericos e gestao manual, com frases totalmente editaveis.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2">
                    <Label className="text-sm text-muted-foreground">Ativo</Label>
                    <Switch
                      checked={config.plans_page_comparison_enabled === "true"}
                      onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, plans_page_comparison_enabled: checked ? "true" : "false" }))}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Frase superior</Label>
                    <Input
                      value={config.plans_page_comparison_eyebrow}
                      onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_comparison_eyebrow: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Frase de apoio</Label>
                    <Input
                      value={config.plans_page_comparison_intro}
                      onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_comparison_intro: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Titulo principal</Label>
                  <Input
                    value={config.plans_page_comparison_title}
                    onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_comparison_title: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frase final</Label>
                  <Textarea
                    rows={3}
                    value={config.plans_page_comparison_footer}
                    onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_comparison_footer: event.target.value }))}
                  />
                </div>

                {comparisonColumns.map((column) => (
                  <div key={column.id} className="space-y-4 rounded-[28px] border border-border/70 bg-background/30 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Titulo da coluna</Label>
                        <Input
                          value={column.title}
                          onChange={(event) =>
                            setComparisonColumns((prev) => prev.map((item) => (item.id === column.id ? { ...item, title: event.target.value } : item)))
                          }
                        />
                      </div>
                      <div className="flex items-end justify-between rounded-xl border border-border/70 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Coluna ativa</p>
                          <p className="text-xs text-muted-foreground">Controle individual do bloco.</p>
                        </div>
                        <Switch
                          checked={column.enabled}
                          onCheckedChange={(checked) =>
                            setComparisonColumns((prev) => prev.map((item) => (item.id === column.id ? { ...item, enabled: checked } : item)))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Itens da coluna</Label>
                      <Textarea
                        rows={6}
                        value={column.itemsText}
                        onChange={(event) =>
                          setComparisonColumns((prev) => prev.map((item) => (item.id === column.id ? { ...item, itemsText: event.target.value } : item)))
                        }
                        placeholder={"Um item por linha\nEx: Criado para Jiu-Jitsu"}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" onClick={() => setComparisonColumns((prev) => prev.filter((item) => item.id !== column.id))}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remover coluna
                      </Button>
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={() => setComparisonColumns((prev) => [...prev, createComparisonColumn()])}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar coluna
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="problemas" className="mt-6">
            <Card className="border-border/80 bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Secao de problemas</CardTitle>
                    <CardDescription>Bloco com dores operacionais e pessoais da academia, totalmente editavel.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2">
                    <Label className="text-sm text-muted-foreground">Ativo</Label>
                    <Switch
                      checked={config.plans_page_problems_enabled === "true"}
                      onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, plans_page_problems_enabled: checked ? "true" : "false" }))}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Titulo principal</Label>
                  <Input
                    value={config.plans_page_problems_title}
                    onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_problems_title: event.target.value }))}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Legenda da coluna esquerda</Label>
                    <Input
                      value={config.plans_page_problems_left_label}
                      onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_problems_left_label: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Legenda da coluna direita</Label>
                    <Input
                      value={config.plans_page_problems_right_label}
                      onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_problems_right_label: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Frase acima do botao</Label>
                  <Textarea
                    rows={3}
                    value={config.plans_page_problems_pre_cta_text}
                    onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_problems_pre_cta_text: event.target.value }))}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <Label>Texto do botao CTA</Label>
                    <Input
                      value={config.plans_page_problems_cta_text}
                      onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_problems_cta_text: event.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2">
                      <Label className="text-sm text-muted-foreground">Botao ativo</Label>
                      <Switch
                        checked={config.plans_page_problems_cta_enabled === "true"}
                        onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, plans_page_problems_cta_enabled: checked ? "true" : "false" }))}
                      />
                    </div>
                  </div>
                </div>

                {problemColumns.map((column) => (
                  <div key={column.id} className="space-y-4 rounded-[28px] border border-border/70 bg-background/30 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Titulo interno da coluna</Label>
                        <Input
                          value={column.title}
                          onChange={(event) =>
                            setProblemColumns((prev) => prev.map((item) => (item.id === column.id ? { ...item, title: event.target.value } : item)))
                          }
                        />
                      </div>
                      <div className="flex items-end justify-between rounded-xl border border-border/70 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Coluna ativa</p>
                          <p className="text-xs text-muted-foreground">Controle individual do bloco.</p>
                        </div>
                        <Switch
                          checked={column.enabled}
                          onCheckedChange={(checked) =>
                            setProblemColumns((prev) => prev.map((item) => (item.id === column.id ? { ...item, enabled: checked } : item)))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Itens da coluna</Label>
                      <Textarea
                        rows={7}
                        value={column.itemsText}
                        onChange={(event) =>
                          setProblemColumns((prev) => prev.map((item) => (item.id === column.id ? { ...item, itemsText: event.target.value } : item)))
                        }
                        placeholder={"Um item por linha\nEx: Processos desorganizados e dependentes de voce"}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" onClick={() => setProblemColumns((prev) => prev.filter((item) => item.id !== column.id))}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remover coluna
                      </Button>
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={() => setProblemColumns((prev) => [...prev, createProblemColumn()])}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar coluna
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="avaliacoes" className="mt-6">
            <Card className="border-border/80 bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Avaliacoes em carrossel</CardTitle>
                    <CardDescription>Depoimentos em uma aba propria para voce editar sem uma tela gigante.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2">
                    <Label className="text-sm text-muted-foreground">Ativo</Label>
                    <Switch
                      checked={config.plans_page_reviews_enabled === "true"}
                      onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, plans_page_reviews_enabled: checked ? "true" : "false" }))}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviews.map((review, index) => (
                  <div key={review.id} className="space-y-4 rounded-[28px] border border-border/70 bg-background/30 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={review.name}
                          onChange={(event) =>
                            setReviews((prev) => prev.map((item) => (item.id === review.id ? { ...item, name: event.target.value } : item)))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo ou cidade</Label>
                        <Input
                          value={review.role}
                          onChange={(event) =>
                            setReviews((prev) => prev.map((item) => (item.id === review.id ? { ...item, role: event.target.value } : item)))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Depoimento ativo</p>
                        <p className="text-xs text-muted-foreground">Se desativar, ele some do carrossel.</p>
                      </div>
                      <Switch
                        checked={review.enabled}
                        onCheckedChange={(checked) =>
                          setReviews((prev) => prev.map((item) => (item.id === review.id ? { ...item, enabled: checked } : item)))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Texto</Label>
                      <Textarea
                        rows={4}
                        value={review.text}
                        onChange={(event) =>
                          setReviews((prev) => prev.map((item) => (item.id === review.id ? { ...item, text: event.target.value } : item)))
                        }
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label>Imagem</Label>
                        <Input
                          value={review.image_url}
                          onChange={(event) =>
                            setReviews((prev) => prev.map((item) => (item.id === review.id ? { ...item, image_url: event.target.value } : item)))
                          }
                          placeholder="URL publica da imagem ou envie abaixo"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <input
                          id={`review-upload-${review.id}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0], "header", index)}
                        />
                        <Button type="button" variant="outline" onClick={() => document.getElementById(`review-upload-${review.id}`)?.click()}>
                          <Upload className="mr-2 h-4 w-4" /> Enviar
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setReviews((prev) => prev.filter((item) => item.id !== review.id))}>
                          <Trash2 className="mr-2 h-4 w-4" /> Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setReviews((prev) => [...prev, createReviewItem()])}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar avaliacao
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="popup" className="mt-6">
            <Card className="border-border/80 bg-card/80">
              <CardHeader>
                <CardTitle>Popup de compras recentes</CardTitle>
                <CardDescription>Ajuste nomes e frequencia em uma area separada e mais rapida de usar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 p-4">
                  <div>
                    <p className="font-medium text-foreground">Ativar popup</p>
                    <p className="text-sm text-muted-foreground">Somente na pagina publica de planos.</p>
                  </div>
                  <Switch
                    checked={config.plans_page_show_popup === "true"}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, plans_page_show_popup: checked ? "true" : "false" }))}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <div className="space-y-2">
                    <Label>Intervalo em ms</Label>
                    <Input
                      value={config.plans_page_popup_interval_ms}
                      onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_popup_interval_ms: event.target.value.replace(/\D/g, "") }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nomes aleatorios</Label>
                    <Textarea
                      rows={6}
                      value={config.plans_page_popup_names}
                      onChange={(event) => setConfig((prev) => ({ ...prev, plans_page_popup_names: event.target.value }))}
                      placeholder={"Ana | Recife\nMestre Diego | Salvador"}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Preview de nomes: {popupPreviewNames.length ? popupPreviewNames.join(" | ") : "Adicione nomes para o popup."}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-[22px] border border-border/70 bg-background/90 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">A configuracao agora esta dividida por contexto. Salve quando terminar.</p>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando..." : "Salvar configuracoes"}
        </Button>
      </div>
    </div>
  );
};

export default PlansPageConfigSection;
