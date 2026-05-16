CREATE POLICY "Mestre can update own CT"
ON public.centros_treinamento
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'mestre'::app_role) AND id = get_user_ct(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND id = get_user_ct(auth.uid()));
