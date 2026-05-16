-- Table: metricas_graduacao
CREATE TABLE public.metricas_graduacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ct_id UUID REFERENCES public.centros_treinamento(id) ON DELETE CASCADE NOT NULL,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  faixa_origem faixa_tipo NOT NULL,
  faixa_destino faixa_tipo NOT NULL,
  tipo_metrica VARCHAR(50) NOT NULL,
  valor_meta INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.metricas_graduacao ENABLE ROW LEVEL SECURITY;
-- Admin full access
CREATE POLICY "Admins full access metricas_graduacao" ON public.metricas_graduacao
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
-- Mestre can manage own CT metrics
CREATE POLICY "Mestre can manage CT metricas_graduacao" ON public.metricas_graduacao
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()));
-- Aluno can read own CT metrics
CREATE POLICY "Aluno can read metricas_graduacao" ON public.metricas_graduacao
  FOR SELECT TO authenticated
  USING (ct_id = get_user_ct(auth.uid()));
-- Table: progresso_metricas
CREATE TABLE public.progresso_metricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL,
  metrica_id UUID REFERENCES public.metricas_graduacao(id) ON DELETE CASCADE NOT NULL,
  ct_id UUID REFERENCES public.centros_treinamento(id) ON DELETE CASCADE,
  valor_atual INTEGER NOT NULL DEFAULT 0,
  atingido BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.progresso_metricas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access progresso_metricas" ON public.progresso_metricas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Mestre can manage CT progresso_metricas" ON public.progresso_metricas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Aluno can read own progresso_metricas" ON public.progresso_metricas
  FOR SELECT TO authenticated
  USING (aluno_id = auth.uid());
-- Table: alertas_graduacao
CREATE TABLE public.alertas_graduacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL,
  ct_id UUID REFERENCES public.centros_treinamento(id) ON DELETE CASCADE,
  faixa_origem faixa_tipo NOT NULL,
  faixa_destino faixa_tipo NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'elegivel',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.alertas_graduacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access alertas_graduacao" ON public.alertas_graduacao
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Mestre can manage CT alertas_graduacao" ON public.alertas_graduacao
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Aluno can read own alertas_graduacao" ON public.alertas_graduacao
  FOR SELECT TO authenticated
  USING (aluno_id = auth.uid());
