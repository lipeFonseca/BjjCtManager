delete from public.webhook_config
where config_key in ('ai_provider', 'ai_api_key', 'ai_model');
