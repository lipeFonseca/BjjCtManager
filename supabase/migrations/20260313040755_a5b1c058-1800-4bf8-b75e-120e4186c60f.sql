ALTER TABLE public.centros_treinamento
  ADD COLUMN IF NOT EXISTS endereco_font_size text DEFAULT '14',
  ADD COLUMN IF NOT EXISTS subtitulo_font_size text DEFAULT '14',
  ADD COLUMN IF NOT EXISTS nome_font_family text DEFAULT 'heading',
  ADD COLUMN IF NOT EXISTS endereco_font_family text DEFAULT 'sans',
  ADD COLUMN IF NOT EXISTS subtitulo_font_family text DEFAULT 'sans',
  ADD COLUMN IF NOT EXISTS nome_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS endereco_color text DEFAULT '#a1a1aa',
  ADD COLUMN IF NOT EXISTS subtitulo_color text DEFAULT '#a1a1aa';
