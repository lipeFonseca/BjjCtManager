DELETE FROM public.webhook_config WHERE config_key IN ('evolution_api_url', 'evolution_api_key', 'evolution_instance');
INSERT INTO public.webhook_config (config_key, config_value) VALUES
  ('zapi_instance_id', ''),
  ('zapi_token', ''),
  ('zapi_client_token', '')
ON CONFLICT (config_key) DO NOTHING;
