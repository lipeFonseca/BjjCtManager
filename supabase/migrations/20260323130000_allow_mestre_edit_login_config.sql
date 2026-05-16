-- Update policy to allow admins and mestres to edit login config
DROP POLICY IF EXISTS "Admins can manage layout config" ON public.layout_config;
-- Admins can do everything with layout_config
CREATE POLICY "Admins can manage layout config"
  ON public.layout_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Mestres can manage login-related config (anything starting with login_)
CREATE POLICY "Mestres can manage login config"
  ON public.layout_config FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'mestre'::app_role) AND 
    config_key LIKE 'login_%'
  )
  WITH CHECK (
    has_role(auth.uid(), 'mestre'::app_role) AND 
    config_key LIKE 'login_%'
  );
