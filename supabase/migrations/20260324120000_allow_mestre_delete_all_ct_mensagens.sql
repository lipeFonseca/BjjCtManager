create policy "Mestre can delete CT mensagens"
on public.mensagens
for delete
to authenticated
using (
  has_role(auth.uid(), 'mestre')
  and ct_id = get_user_ct(auth.uid())
);
