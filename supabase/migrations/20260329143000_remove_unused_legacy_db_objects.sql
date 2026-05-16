delete from public.webhook_config
where config_key = 'gmail_html_template';
drop index if exists public.idx_mensagem_destinatarios_destinatario_id;
drop table if exists public.users;
