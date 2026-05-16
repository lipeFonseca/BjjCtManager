-- Drop existing restrictive policies on presencas
DROP POLICY IF EXISTS "Admins full access presencas" ON public.presencas;
DROP POLICY IF EXISTS "Mestre can manage CT presencas" ON public.presencas;
DROP POLICY IF EXISTS "Users can read own presencas" ON public.presencas;
-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins full access presencas"
ON public.presencas
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Mestre can manage CT presencas"
ON public.presencas
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Users can read own presencas"
ON public.presencas
FOR SELECT
TO authenticated
USING (aluno_id = auth.uid());
