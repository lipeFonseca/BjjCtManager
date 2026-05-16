update public.webhook_config
set config_value = 'html'
where config_key = 'gmail_format'
  and coalesce(trim(config_value), '') not in ('text', 'html');
update public.webhook_config
set config_value = 'wa_me'
where config_key = 'whatsapp_send_mode'
  and coalesce(trim(config_value), '') not in ('wa_me', 'uazapi');
update public.webhook_config
set config_value = 'true'
where config_key = 'mensageria_auto_notice_enabled'
  and coalesce(trim(config_value), '') not in ('true', 'false');
