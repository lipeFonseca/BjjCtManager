ALTER TABLE public.progresso_metricas ADD COLUMN mes_referencia date NOT NULL DEFAULT (date_trunc('month', now()))::date;
