drop policy if exists "Users can read own mensagem destinatarios" on public.mensagem_destinatarios;
create policy "Users can read own mensagem destinatarios"
on public.mensagem_destinatarios
for select
to authenticated
using (destinatario_id = auth.uid());
