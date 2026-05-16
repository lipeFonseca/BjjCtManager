create table if not exists public.mensagens_enviadas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid null,
  aluno_nome text null,
  assunto text not null,
  canal text not null default 'email',
  created_at timestamptz not null default now(),
  email_destinatario text null,
  enviado_por uuid not null,
  erro text null,
  mensagem text not null,
  status text not null default 'enviado'
);
alter table public.mensagens_enviadas
  alter column canal set default 'email';
alter table public.mensagens_enviadas
  alter column status set default 'enviado';
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mensagens_enviadas_canal_check'
      and conrelid = 'public.mensagens_enviadas'::regclass
  ) then
    alter table public.mensagens_enviadas
      add constraint mensagens_enviadas_canal_check
      check (canal in ('email', 'whatsapp', 'telegram'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'mensagens_enviadas_status_check'
      and conrelid = 'public.mensagens_enviadas'::regclass
  ) then
    alter table public.mensagens_enviadas
      add constraint mensagens_enviadas_status_check
      check (status in ('enviado', 'falha'));
  end if;
end $$;
create index if not exists idx_mensagens_enviadas_created_at
  on public.mensagens_enviadas(created_at desc);
create index if not exists idx_mensagens_enviadas_canal_status
  on public.mensagens_enviadas(canal, status);
create index if not exists idx_mensagens_enviadas_enviado_por
  on public.mensagens_enviadas(enviado_por);
alter table public.mensagens_enviadas enable row level security;
