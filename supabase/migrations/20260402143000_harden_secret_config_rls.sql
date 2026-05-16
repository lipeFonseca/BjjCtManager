drop policy if exists "Admins full access config_pagamento" on public.config_pagamento;
drop policy if exists "Mestre can manage CT config_pagamento" on public.config_pagamento;
create policy "Admins manage non-secret config_pagamento"
on public.config_pagamento
for all
to authenticated
using (
  has_role(auth.uid(), 'admin'::app_role)
  and config_key not in ('asaas_api_key', 'asaas_webhook_token')
)
with check (
  has_role(auth.uid(), 'admin'::app_role)
  and config_key not in ('asaas_api_key', 'asaas_webhook_token')
);
create policy "Mestre manage non-secret CT config_pagamento"
on public.config_pagamento
for all
to authenticated
using (
  has_role(auth.uid(), 'mestre'::app_role)
  and ct_id = get_user_ct(auth.uid())
  and config_key not in ('asaas_api_key', 'asaas_webhook_token')
)
with check (
  has_role(auth.uid(), 'mestre'::app_role)
  and ct_id = get_user_ct(auth.uid())
  and config_key not in ('asaas_api_key', 'asaas_webhook_token')
);
drop policy if exists "Admins full access webhook_config" on public.webhook_config;
drop policy if exists "Mestre can read own webhook_config" on public.webhook_config;
drop policy if exists "Mestre can insert own webhook_config" on public.webhook_config;
drop policy if exists "Mestre can update own webhook_config" on public.webhook_config;
drop policy if exists "Admins manage non-secret webhook_config" on public.webhook_config;
drop policy if exists "Mestre manage non-secret own webhook_config" on public.webhook_config;
create policy "Admins manage non-secret webhook_config"
on public.webhook_config
for all
to authenticated
using (
  has_role(auth.uid(), 'admin'::app_role)
  and config_key not in ('gmail_app_password', 'uazapi_instance_apikey', 'telegram_bot_token')
)
with check (
  has_role(auth.uid(), 'admin'::app_role)
  and config_key not in ('gmail_app_password', 'uazapi_instance_apikey', 'telegram_bot_token')
);
create policy "Mestre manage non-secret own webhook_config"
on public.webhook_config
for all
to authenticated
using (
  has_role(auth.uid(), 'mestre'::app_role)
  and ct_id = get_user_ct(auth.uid())
  and config_key not in ('gmail_app_password', 'uazapi_instance_apikey', 'telegram_bot_token')
)
with check (
  has_role(auth.uid(), 'mestre'::app_role)
  and ct_id = get_user_ct(auth.uid())
  and config_key not in ('gmail_app_password', 'uazapi_instance_apikey', 'telegram_bot_token')
);
drop policy if exists "Admins manage billing_settings" on public.billing_settings;
create policy "Admins manage non-secret billing_settings"
on public.billing_settings
for all
to authenticated
using (
  has_role(auth.uid(), 'admin'::app_role)
  and setting_key not in ('asaas_api_key', 'asaas_webhook_token')
)
with check (
  has_role(auth.uid(), 'admin'::app_role)
  and setting_key not in ('asaas_api_key', 'asaas_webhook_token')
);
