create table if not exists public.secure_config_entries (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('payment', 'messaging', 'billing_admin')),
  config_key text not null,
  ct_id uuid references public.centros_treinamento(id) on delete cascade,
  ct_scope uuid generated always as (coalesce(ct_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  secret_value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create unique index if not exists secure_config_entries_scope_key_ct_scope_idx
on public.secure_config_entries (scope, config_key, ct_scope);
alter table public.secure_config_entries enable row level security;
revoke all on public.secure_config_entries from anon, authenticated;
grant select, insert, update, delete on public.secure_config_entries to service_role;
insert into public.secure_config_entries (scope, config_key, ct_id, secret_value, updated_at, updated_by)
select
  'payment',
  cp.config_key,
  cp.ct_id,
  cp.config_value,
  cp.updated_at,
  cp.updated_by
from public.config_pagamento cp
where cp.config_key in ('asaas_api_key', 'asaas_webhook_token')
  and coalesce(cp.config_value, '') <> ''
on conflict (scope, config_key, ct_scope) do update
set
  secret_value = excluded.secret_value,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;
insert into public.secure_config_entries (scope, config_key, ct_id, secret_value, updated_at, updated_by)
select
  'messaging',
  wc.config_key,
  wc.ct_id,
  wc.config_value,
  wc.updated_at,
  wc.updated_by
from public.webhook_config wc
where wc.config_key in ('gmail_app_password', 'uazapi_instance_apikey', 'telegram_bot_token')
  and coalesce(wc.config_value, '') <> ''
on conflict (scope, config_key, ct_scope) do update
set
  secret_value = excluded.secret_value,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;
insert into public.secure_config_entries (scope, config_key, ct_id, secret_value, updated_at, updated_by)
select
  'billing_admin',
  bs.setting_key,
  null,
  bs.setting_value,
  bs.updated_at,
  bs.updated_by
from public.billing_settings bs
where bs.setting_key in ('asaas_api_key', 'asaas_webhook_token')
  and coalesce(bs.setting_value, '') <> ''
on conflict (scope, config_key, ct_scope) do update
set
  secret_value = excluded.secret_value,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;
delete from public.config_pagamento
where config_key in ('asaas_api_key', 'asaas_webhook_token');
delete from public.webhook_config
where config_key in ('gmail_app_password', 'uazapi_instance_apikey', 'telegram_bot_token');
delete from public.billing_settings
where setting_key in ('asaas_api_key', 'asaas_webhook_token');
