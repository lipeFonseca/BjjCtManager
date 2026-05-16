CREATE TABLE public.tempo_graduacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ct_id UUID NOT NULL REFERENCES public.centros_treinamento(id) ON DELETE CASCADE,
  classe VARCHAR NOT NULL DEFAULT 'adulto',
  faixa_origem faixa_tipo NOT NULL,
  faixa_destino faixa_tipo NOT NULL,
  meses INTEGER NOT NULL DEFAULT 6,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ct_id, classe, faixa_origem, faixa_destino)
);
ALTER TABLE public.tempo_graduacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access tempo_graduacao" ON public.tempo_graduacao FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Mestre can manage CT tempo_graduacao" ON public.tempo_graduacao FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Aluno can read tempo_graduacao" ON public.tempo_graduacao FOR SELECT TO authenticated
  USING (ct_id = get_user_ct(auth.uid()));
