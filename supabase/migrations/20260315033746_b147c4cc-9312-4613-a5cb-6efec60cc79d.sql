CREATE TABLE public.webhook_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.webhook_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access webhook_config"
ON public.webhook_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Mestre can read webhook_config"
ON public.webhook_config
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'mestre'::app_role));
-- Insert default config rows
INSERT INTO public.webhook_config (config_key, config_value) VALUES
  ('resend_api_key', ''),
  ('evolution_api_url', ''),
  ('evolution_api_key', ''),
  ('evolution_instance', ''),
  ('email_from', 'noreply@seudominio.com'),
  ('email_from_name', 'Sistema BJJ');
