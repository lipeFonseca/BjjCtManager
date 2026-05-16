DELETE FROM public.webhook_config WHERE config_key IN ('resend_api_key', 'email_from', 'email_from_name');
INSERT INTO public.webhook_config (config_key, config_value)
VALUES 
  ('gmail_email', ''),
  ('gmail_app_password', ''),
  ('gmail_from_name', '')
ON CONFLICT DO NOTHING;
