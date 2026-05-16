create table if not exists public.mensagem_grupos (
  id uuid primary key default gen_random_uuid(),
  ct_id uuid not null references public.centros_treinamento(id) on delete cascade,
  nome text not null,
  descricao text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.mensagem_grupo_membros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.mensagem_grupos(id) on delete cascade,
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (grupo_id, destinatario_id)
);
create index if not exists idx_mensagem_grupos_ct_id on public.mensagem_grupos(ct_id);
create index if not exists idx_mensagem_grupo_membros_grupo_id on public.mensagem_grupo_membros(grupo_id);
create index if not exists idx_mensagem_grupo_membros_destinatario_id on public.mensagem_grupo_membros(destinatario_id);
alter table public.mensagem_grupos enable row level security;
alter table public.mensagem_grupo_membros enable row level security;
drop policy if exists "Admins full access mensagem_grupos" on public.mensagem_grupos;
drop policy if exists "Mestre can manage CT mensagem_grupos" on public.mensagem_grupos;
drop policy if exists "Admins full access mensagem_grupo_membros" on public.mensagem_grupo_membros;
drop policy if exists "Mestre can manage CT mensagem_grupo_membros" on public.mensagem_grupo_membros;
create policy "Admins full access mensagem_grupos"
on public.mensagem_grupos
for all
to authenticated
using (has_role(auth.uid(), 'admin'))
with check (has_role(auth.uid(), 'admin'));
create policy "Mestre can manage CT mensagem_grupos"
on public.mensagem_grupos
for all
to authenticated
using (
  has_role(auth.uid(), 'mestre')
  and ct_id = get_user_ct(auth.uid())
)
with check (
  has_role(auth.uid(), 'mestre')
  and ct_id = get_user_ct(auth.uid())
);
create policy "Admins full access mensagem_grupo_membros"
on public.mensagem_grupo_membros
for all
to authenticated
using (has_role(auth.uid(), 'admin'))
with check (has_role(auth.uid(), 'admin'));
create policy "Mestre can manage CT mensagem_grupo_membros"
on public.mensagem_grupo_membros
for all
to authenticated
using (
  has_role(auth.uid(), 'mestre')
  and exists (
    select 1
    from public.mensagem_grupos g
    where g.id = mensagem_grupo_membros.grupo_id
      and g.ct_id = get_user_ct(auth.uid())
  )
)
with check (
  has_role(auth.uid(), 'mestre')
  and exists (
    select 1
    from public.mensagem_grupos g
    where g.id = mensagem_grupo_membros.grupo_id
      and g.ct_id = get_user_ct(auth.uid())
  )
);
