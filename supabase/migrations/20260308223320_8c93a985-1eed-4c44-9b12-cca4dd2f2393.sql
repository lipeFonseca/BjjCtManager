CREATE TABLE public.layout_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE public.layout_config ENABLE ROW LEVEL SECURITY;
-- Everyone can read layout config (it's applied globally)
CREATE POLICY "Anyone can read layout config"
  ON public.layout_config FOR SELECT
  TO authenticated
  USING (true);
-- Only admins can modify layout config
CREATE POLICY "Admins can manage layout config"
  ON public.layout_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Insert default configs
INSERT INTO public.layout_config (config_key, config_value) VALUES
  ('sidebar_mestre', '["dashboard","mestres","alunos","horarios","mensagens"]'::jsonb),
  ('sidebar_aluno', '["dashboard","horarios","faixa","mensagens","chat"]'::jsonb),
  ('widgets_admin', '["centros","mestres","alunos","faixasPretas","faixaChart"]'::jsonb),
  ('widgets_mestre', '["mestresCT","alunosCT","mensagens","presencasHoje","attendanceChart","schedule"]'::jsonb),
  ('widgets_aluno', '["faixaAtual","presencas","mensagens","schedule"]'::jsonb);
