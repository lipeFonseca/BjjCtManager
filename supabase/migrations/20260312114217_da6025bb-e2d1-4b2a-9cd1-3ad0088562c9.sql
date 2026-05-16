ALTER TABLE public.centros_treinamento
  ADD COLUMN IF NOT EXISTS logo_bg_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS logo_bg_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS subtitulo text DEFAULT 'Centro de Treinamento de Jiu-Jitsu',
  ADD COLUMN IF NOT EXISTS nome_font_size text DEFAULT '28';
