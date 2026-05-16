ALTER TABLE public.centros_treinamento
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS raio_presenca_metros integer NOT NULL DEFAULT 100;
CREATE TABLE IF NOT EXISTS public.aula_chamadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ct_id uuid NOT NULL REFERENCES public.centros_treinamento(id) ON DELETE CASCADE,
  horario_aula_id uuid REFERENCES public.horarios_aulas(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  mensagem text,
  status text NOT NULL DEFAULT 'ativa',
  iniciada_por uuid NOT NULL,
  iniciada_em timestamp with time zone NOT NULL DEFAULT now(),
  expira_em timestamp with time zone NOT NULL DEFAULT (now() + interval '15 minutes'),
  encerrada_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aula_chamadas_ct_status
  ON public.aula_chamadas (ct_id, status, expira_em DESC);
ALTER TABLE public.aula_chamadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access aula_chamadas"
ON public.aula_chamadas
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Mestre manage own CT aula_chamadas"
ON public.aula_chamadas
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Aluno can read own CT aula_chamadas"
ON public.aula_chamadas
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'aluno') AND ct_id = get_user_ct(auth.uid()));
ALTER TABLE public.presencas
  ADD COLUMN IF NOT EXISTS chamada_id uuid REFERENCES public.aula_chamadas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS horario_aula_id uuid REFERENCES public.horarios_aulas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS distancia_metros numeric,
  ADD COLUMN IF NOT EXISTS validada_geolocalizacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registrada_por uuid,
  ADD COLUMN IF NOT EXISTS observacao_validacao text;
CREATE INDEX IF NOT EXISTS idx_presencas_chamada_id
  ON public.presencas (chamada_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.aula_chamadas;
