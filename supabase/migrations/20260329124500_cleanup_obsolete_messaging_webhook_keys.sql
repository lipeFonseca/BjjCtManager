-- Remove obsolete messaging/webhook config keys that are no longer used by the runtime.
-- Keep active keys untouched to avoid breaking current integrations.

DELETE FROM public.webhook_config
WHERE config_key IN (
  'zapi_instance_id',
  'zapi_token',
  'zapi_client_token',
  'evolution_api_url',
  'evolution_api_key',
  'evolution_instance',
  'resend_api_key',
  'email_from',
  'email_from_name'
);
INSERT INTO public.webhook_config (config_key, config_value, ct_id)
SELECT seed.config_key, seed.config_value, NULL
FROM (
  VALUES
    ('gmail_email', ''),
    ('gmail_app_password', ''),
    ('gmail_from_name', 'Sistema BJJ'),
    ('gmail_format', 'html'),
    ('gmail_html_template', ''),
    ('whatsapp_send_mode', 'wa_me'),
    ('uazapi_base_url', ''),
    ('uazapi_instance_name', ''),
    ('uazapi_instance_apikey', ''),
    ('telegram_bot_token', ''),
    ('telegram_chat_id', ''),
    ('mensageria_auto_notice_enabled', 'true'),
    ('mensageria_auto_notice_message', 'Mensagem automatica. Nao responda este e-mail.')
) AS seed(config_key, config_value)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.webhook_config wc
  WHERE wc.config_key = seed.config_key
    AND wc.ct_id IS NULL
);
