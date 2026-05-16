delete from public.webhook_config
where config_key in (
  'gmail_html_template',
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
delete from public.config_pagamento
where config_key in ('asaas_api_key', 'asaas_webhook_token');
delete from public.billing_settings
where setting_key in ('asaas_api_key', 'asaas_webhook_token');
delete from public.secure_config_entries
where (scope = 'messaging' and config_key = 'gmail_html_template')
   or (scope = 'payment' and config_key not in ('asaas_api_key', 'asaas_webhook_token'))
   or (scope = 'billing_admin' and config_key not in ('asaas_api_key', 'asaas_webhook_token'));
