drop policy if exists "Mestre can read webhook_config" on public.webhook_config;
create policy "Mestre can read own webhook_config"
on public.webhook_config
for select
to authenticated
using (
  has_role(auth.uid(), 'mestre'::app_role)
  and ct_id = get_user_ct(auth.uid())
);
delete from public.webhook_config
where ct_id is null;
