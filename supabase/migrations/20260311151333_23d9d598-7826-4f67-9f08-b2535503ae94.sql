CREATE TABLE IF NOT EXISTS public.faixa_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  ct_id uuid REFERENCES public.centros_treinamento(id) ON DELETE SET NULL,
  data_graduacao date NOT NULL DEFAULT CURRENT_DATE,
  faixa_anterior public.faixa_tipo,
  faixa_nova public.faixa_tipo NOT NULL,
  observacoes text,
  registrado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS grau smallint NOT NULL DEFAULT 0;
ALTER TABLE public.faixa_historico ADD COLUMN IF NOT EXISTS grau_novo smallint NOT NULL DEFAULT 0;
ALTER TABLE public.faixa_historico ADD COLUMN IF NOT EXISTS grau_anterior smallint DEFAULT NULL;
