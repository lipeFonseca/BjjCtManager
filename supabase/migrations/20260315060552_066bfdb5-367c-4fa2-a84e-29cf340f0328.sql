CREATE POLICY "Mestre can update own mensagens"
ON public.mensagens
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'mestre'::app_role) AND remetente_id = auth.uid() AND ct_id = get_user_ct(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND remetente_id = auth.uid() AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Admin can update mensagens"
ON public.mensagens
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
