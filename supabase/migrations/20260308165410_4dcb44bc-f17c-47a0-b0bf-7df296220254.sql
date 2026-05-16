-- Add visual customization columns to centros_treinamento
ALTER TABLE public.centros_treinamento
  ADD COLUMN IF NOT EXISTS cor_primaria text DEFAULT '#dc2626',
  ADD COLUMN IF NOT EXISTS cor_secundaria text DEFAULT '#171717',
  ADD COLUMN IF NOT EXISTS cor_fundo text DEFAULT '#0a0a0a',
  ADD COLUMN IF NOT EXISTS cor_texto text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS banner_url text DEFAULT NULL;
-- Create storage bucket for CT assets (logos, banners)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ct-assets', 'ct-assets', true)
ON CONFLICT (id) DO NOTHING;
-- RLS: Admins can upload/delete files
CREATE POLICY "Admins can manage ct-assets"
ON storage.objects FOR ALL
USING (bucket_id = 'ct-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'ct-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));
-- RLS: Anyone authenticated can read ct-assets
CREATE POLICY "Authenticated users can read ct-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'ct-assets' AND auth.role() = 'authenticated');
