-- Normalize and constrain critical messaging config values so invalid states
-- do not silently propagate into the messaging runtime.

UPDATE public.webhook_config
SET config_value = 'wa_me'
WHERE config_key = 'whatsapp_send_mode'
  AND config_value NOT IN ('wa_me', 'uazapi');
UPDATE public.webhook_config
SET config_value = 'html'
WHERE config_key = 'gmail_format'
  AND config_value NOT IN ('text', 'html');
UPDATE public.webhook_config
SET config_value = 'true'
WHERE config_key = 'mensageria_auto_notice_enabled'
  AND config_value NOT IN ('true', 'false');
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'webhook_config_whatsapp_send_mode_check'
      and conrelid = 'public.webhook_config'::regclass
  ) then
    alter table public.webhook_config
      add constraint webhook_config_whatsapp_send_mode_check
      check (
        config_key <> 'whatsapp_send_mode'
        or config_value in ('wa_me', 'uazapi')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'webhook_config_gmail_format_check'
      and conrelid = 'public.webhook_config'::regclass
  ) then
    alter table public.webhook_config
      add constraint webhook_config_gmail_format_check
      check (
        config_key <> 'gmail_format'
        or config_value in ('text', 'html')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'webhook_config_auto_notice_enabled_check'
      and conrelid = 'public.webhook_config'::regclass
  ) then
    alter table public.webhook_config
      add constraint webhook_config_auto_notice_enabled_check
      check (
        config_key <> 'mensageria_auto_notice_enabled'
        or config_value in ('true', 'false')
      );
  end if;
end $$;
