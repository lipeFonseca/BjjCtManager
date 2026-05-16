-- Ensure all webhook config keys exist with ct_id = NULL (global)
-- This is a fix/seed migration to guarantee initial webhook config state.

INSERT INTO public.webhook_config (config_key, config_value, ct_id)
SELECT seed.config_key, seed.config_value, NULL
FROM (
  VALUES
    ('gmail_email', ''),
    ('gmail_app_password', ''),
    ('gmail_from_name', ''),
    ('zapi_instance_id', ''),
    ('zapi_token', ''),
    ('zapi_client_token', '')
) AS seed(config_key, config_value)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.webhook_config wc
  WHERE wc.config_key = seed.config_key
    AND wc.ct_id IS NULL
);
