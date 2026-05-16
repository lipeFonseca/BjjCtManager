CREATE TABLE public.avaliacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL,
  avaliador_id UUID NOT NULL,
  ct_id UUID REFERENCES public.centros_treinamento(id),
  nota_tecnica SMALLINT NOT NULL CHECK (nota_tecnica BETWEEN 1 AND 10),
  nota_frequencia SMALLINT NOT NULL CHECK (nota_frequencia BETWEEN 1 AND 10),
  nota_disciplina SMALLINT NOT NULL CHECK (nota_disciplina BETWEEN 1 AND 10),
  observacoes TEXT,
  recomendacoes_ia TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access avaliacoes" ON public.avaliacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Mestre can manage CT avaliacoes" ON public.avaliacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Aluno can read own avaliacoes" ON public.avaliacoes FOR SELECT TO authenticated
  USING (aluno_id = auth.uid());
