CREATE POLICY "Mestre can manage layout config"
ON public.layout_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'mestre'::app_role))
WITH CHECK (has_role(auth.uid(), 'mestre'::app_role));
