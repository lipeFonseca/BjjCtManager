delete from public.webhook_config
where config_key in (
  'mensageria_branding_config',
  'mensageria_comunicado_template',
  'mensageria_disparo_template'
);
