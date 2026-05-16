-- Replace legacy WhatsApp provider keys with the new Uazapi / wa.me setup.

INSERT INTO public.webhook_config (config_key, config_value, ct_id)
SELECT seed.config_key, seed.config_value, NULL
FROM (
  VALUES
    ('whatsapp_send_mode', 'wa_me'),
    ('uazapi_base_url', ''),
    ('uazapi_instance_name', ''),
    ('uazapi_instance_apikey', '')
) AS seed(config_key, config_value)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.webhook_config wc
  WHERE wc.config_key = seed.config_key
    AND wc.ct_id IS NULL
);
DELETE FROM public.webhook_config
WHERE config_key IN ('zapi_instance_id', 'zapi_token', 'zapi_client_token');
