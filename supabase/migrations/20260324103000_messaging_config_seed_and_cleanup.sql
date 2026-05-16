-- Ensure all messaging-related config keys exist once in global scope.
-- This migration is additive and safe for existing installations.

INSERT INTO public.webhook_config (config_key, config_value, ct_id)
SELECT seed.config_key, seed.config_value, NULL
FROM (
  VALUES
    ('gmail_email', ''),
    ('gmail_app_password', ''),
    ('gmail_from_name', 'Sistema BJJ'),
    ('gmail_format', 'html'),
    ('gmail_html_template', ''),
    ('zapi_instance_id', ''),
    ('zapi_token', ''),
    ('zapi_client_token', ''),
    ('telegram_bot_token', ''),
    ('telegram_chat_id', '')
) AS seed(config_key, config_value)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.webhook_config wc
  WHERE wc.config_key = seed.config_key
    AND wc.ct_id IS NULL
);
