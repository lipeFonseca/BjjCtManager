alter table public.mensagens
add column if not exists tipo text not null default 'comunicado';
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mensagens_tipo_check'
      and conrelid = 'public.mensagens'::regclass
  ) then
    alter table public.mensagens
      add constraint mensagens_tipo_check
      check (tipo in ('comunicado', 'disparo'));
  end if;
end $$;
create table if not exists public.mensagem_destinatarios (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid not null references public.mensagens(id) on delete cascade,
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mensagem_id, destinatario_id)
);
alter table public.mensagem_destinatarios enable row level security;
create index if not exists idx_mensagem_destinatarios_destinatario_id
  on public.mensagem_destinatarios(destinatario_id);
create index if not exists idx_mensagem_destinatarios_mensagem_id
  on public.mensagem_destinatarios(mensagem_id);
drop policy if exists "CT members can read mensagens" on public.mensagens;
drop policy if exists "CT members can read comunicados" on public.mensagens;
drop policy if exists "Users can read relevant disparos" on public.mensagens;
create policy "CT members can read comunicados"
on public.mensagens
for select
to authenticated
using (
  tipo = 'comunicado'
  and ct_id = get_user_ct(auth.uid())
);
create policy "Users can read relevant disparos"
on public.mensagens
for select
to authenticated
using (
  tipo = 'disparo'
  and (
    remetente_id = auth.uid()
    or exists (
      select 1
      from public.mensagem_destinatarios md
      where md.mensagem_id = mensagens.id
        and md.destinatario_id = auth.uid()
    )
  )
);
drop policy if exists "Admins full access mensagem destinatarios" on public.mensagem_destinatarios;
drop policy if exists "Users can read own mensagem destinatarios" on public.mensagem_destinatarios;
drop policy if exists "Mestres can create destinatarios for own mensagens" on public.mensagem_destinatarios;
create policy "Admins full access mensagem destinatarios"
on public.mensagem_destinatarios
for all
to authenticated
using (has_role(auth.uid(), 'admin'))
with check (has_role(auth.uid(), 'admin'));
create policy "Users can read own mensagem destinatarios"
on public.mensagem_destinatarios
for select
to authenticated
using (
  destinatario_id = auth.uid()
  or exists (
    select 1
    from public.mensagens m
    where m.id = mensagem_destinatarios.mensagem_id
      and m.remetente_id = auth.uid()
  )
);
create policy "Mestres can create destinatarios for own mensagens"
on public.mensagem_destinatarios
for insert
to authenticated
with check (
  has_role(auth.uid(), 'mestre')
  and exists (
    select 1
    from public.mensagens m
    where m.id = mensagem_destinatarios.mensagem_id
      and m.remetente_id = auth.uid()
      and m.ct_id = get_user_ct(auth.uid())
  )
);
