create table if not exists public.edge_function_diagnostics (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  function_name text not null,
  phase text not null,
  error_message text not null,
  user_id uuid,
  ct_id uuid references public.centros_treinamento(id) on delete set null,
  role text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists edge_function_diagnostics_created_at_idx
on public.edge_function_diagnostics (created_at desc);
create index if not exists edge_function_diagnostics_request_id_idx
on public.edge_function_diagnostics (request_id);
alter table public.edge_function_diagnostics enable row level security;
revoke all on public.edge_function_diagnostics from anon, authenticated;
grant select, insert, delete on public.edge_function_diagnostics to service_role;
