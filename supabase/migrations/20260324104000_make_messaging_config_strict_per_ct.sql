-- Transition messaging configs from optional global fallback to strict per-CT ownership.
-- For each CT, copy any existing global messaging config into CT scope only when that CT
-- does not already have its own value for the same config_key.

INSERT INTO public.webhook_config (config_key, config_value, ct_id, updated_at, updated_by)
SELECT
  global_cfg.config_key,
  global_cfg.config_value,
  ct.id,
  now(),
  global_cfg.updated_by
FROM public.centros_treinamento ct
JOIN public.webhook_config global_cfg
  ON global_cfg.ct_id IS NULL
WHERE global_cfg.config_key IN (
  'gmail_email',
  'gmail_app_password',
  'gmail_from_name',
  'gmail_format',
  'gmail_html_template',
  'zapi_instance_id',
  'zapi_token',
  'zapi_client_token',
  'telegram_bot_token',
  'telegram_chat_id'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.webhook_config existing_cfg
  WHERE existing_cfg.ct_id = ct.id
    AND existing_cfg.config_key = global_cfg.config_key
);
