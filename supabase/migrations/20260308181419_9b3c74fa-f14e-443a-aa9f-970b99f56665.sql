CREATE TABLE public.horarios_aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ct_id uuid NOT NULL REFERENCES public.centros_treinamento(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_inicio time NOT NULL,
  horario_fim time NOT NULL,
  descricao text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.horarios_aulas ENABLE ROW LEVEL SECURITY;
-- Admin full access
CREATE POLICY "Admins full access horarios"
ON public.horarios_aulas FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Mestre Lider can manage their CT schedules
CREATE POLICY "MestreLider can manage CT horarios"
ON public.horarios_aulas FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'mestre_lider'::app_role) AND ct_id = get_user_ct(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'mestre_lider'::app_role) AND ct_id = get_user_ct(auth.uid()));
-- Mestre can manage their CT schedules
CREATE POLICY "Mestre can manage CT horarios"
ON public.horarios_aulas FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()));
-- Alunos can only read their CT schedules
CREATE POLICY "Alunos can read CT horarios"
ON public.horarios_aulas FOR SELECT
TO authenticated
USING (ct_id = get_user_ct(auth.uid()));
