alter table public.aluno_planos
  add column if not exists payment_status text not null default 'active',
  add column if not exists valor_override numeric(10,2),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'aluno_planos_payment_status_check'
  ) then
    alter table public.aluno_planos
      add constraint aluno_planos_payment_status_check
      check (payment_status in ('active', 'paused', 'exempt'));
  end if;
end $$;

create index if not exists idx_aluno_planos_ct_payment_status
  on public.aluno_planos (ct_id, payment_status, ativo);

create or replace function public.set_aluno_planos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_aluno_planos_updated_at on public.aluno_planos;
create trigger trg_set_aluno_planos_updated_at
before update on public.aluno_planos
for each row
execute function public.set_aluno_planos_updated_at();

alter table public.cobrancas
  add column if not exists payment_method text,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cobrancas_status_check'
  ) then
    alter table public.cobrancas
      add constraint cobrancas_status_check
      check (status in ('pendente', 'aguardando_confirmacao', 'pago', 'confirmado', 'atrasado', 'vencido', 'cancelado', 'rejeitado'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cobrancas_payment_method_check'
  ) then
    alter table public.cobrancas
      add constraint cobrancas_payment_method_check
      check (payment_method is null or payment_method in ('pix', 'dinheiro', 'transferencia', 'boleto', 'cartao', 'asaas'));
  end if;
end $$;

create index if not exists idx_cobrancas_ct_status_data_vencimento
  on public.cobrancas (ct_id, status, data_vencimento desc);

create index if not exists idx_cobrancas_aluno_status_data_vencimento
  on public.cobrancas (aluno_id, status, data_vencimento desc);

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  cobranca_id uuid not null references public.cobrancas(id) on delete cascade,
  ct_id uuid not null references public.centros_treinamento(id) on delete cascade,
  aluno_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes integer not null,
  review_status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_receipts_review_status_check'
  ) then
    alter table public.payment_receipts
      add constraint payment_receipts_review_status_check
      check (review_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_receipts_file_size_positive_check'
  ) then
    alter table public.payment_receipts
      add constraint payment_receipts_file_size_positive_check
      check (file_size_bytes > 0 and file_size_bytes <= 2097152);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_receipts_mime_type_check'
  ) then
    alter table public.payment_receipts
      add constraint payment_receipts_mime_type_check
      check (mime_type in ('image/jpeg', 'image/png', 'image/webp'));
  end if;
end $$;

create index if not exists idx_payment_receipts_cobranca_created_at
  on public.payment_receipts (cobranca_id, created_at desc);

create index if not exists idx_payment_receipts_ct_review_status
  on public.payment_receipts (ct_id, review_status, created_at desc);

create index if not exists idx_payment_receipts_aluno_created_at
  on public.payment_receipts (aluno_id, created_at desc);

alter table public.payment_receipts enable row level security;

drop policy if exists "Admins manage payment_receipts" on public.payment_receipts;
create policy "Admins manage payment_receipts"
on public.payment_receipts
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Responsavel do CT gerencia payment_receipts" on public.payment_receipts;
create policy "Responsavel do CT gerencia payment_receipts"
on public.payment_receipts
for all
to authenticated
using (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
)
with check (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
);

drop policy if exists "Aluno le proprios payment_receipts" on public.payment_receipts;
create policy "Aluno le proprios payment_receipts"
on public.payment_receipts
for select
to authenticated
using (aluno_id = auth.uid());

drop policy if exists "Aluno envia proprios payment_receipts" on public.payment_receipts;
create policy "Aluno envia proprios payment_receipts"
on public.payment_receipts
for insert
to authenticated
with check (
  aluno_id = auth.uid()
  and ct_id = public.get_user_ct(auth.uid())
  and review_status = 'pending'
);

drop policy if exists "Aluno atualiza proprios payment_receipts pendentes" on public.payment_receipts;
create policy "Aluno atualiza proprios payment_receipts pendentes"
on public.payment_receipts
for update
to authenticated
using (
  aluno_id = auth.uid()
  and review_status = 'pending'
)
with check (
  aluno_id = auth.uid()
  and review_status = 'pending'
);

create or replace function public.set_payment_receipts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_payment_receipts_updated_at on public.payment_receipts;
create trigger trg_set_payment_receipts_updated_at
before update on public.payment_receipts
for each row
execute function public.set_payment_receipts_updated_at();

create or replace function public.validate_payment_receipts_ct_isolation()
returns trigger
language plpgsql
as $$
declare
  cobranca_ct_id uuid;
  cobranca_aluno_id uuid;
begin
  select c.ct_id, c.aluno_id
    into cobranca_ct_id, cobranca_aluno_id
  from public.cobrancas c
  where c.id = new.cobranca_id;

  if cobranca_ct_id is null then
    raise exception 'Receipt references an unknown cobranca';
  end if;

  if cobranca_ct_id <> new.ct_id then
    raise exception 'Receipt CT does not match cobranca CT';
  end if;

  if cobranca_aluno_id <> new.aluno_id then
    raise exception 'Receipt aluno does not match cobranca aluno';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_payment_receipts_ct_isolation on public.payment_receipts;
create trigger trg_validate_payment_receipts_ct_isolation
before insert or update on public.payment_receipts
for each row
execute function public.validate_payment_receipts_ct_isolation();

alter publication supabase_realtime add table public.payment_receipts;

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update
set public = false;

drop policy if exists "Admins manage payment-receipts bucket" on storage.objects;
drop policy if exists "CT owners read payment-receipts bucket" on storage.objects;
drop policy if exists "Students read own payment-receipts bucket" on storage.objects;
drop policy if exists "Students upload own payment-receipts bucket" on storage.objects;
drop policy if exists "Students update own payment-receipts bucket" on storage.objects;
drop policy if exists "Students delete own payment-receipts bucket" on storage.objects;

create policy "Admins manage payment-receipts bucket"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'payment-receipts'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
)
with check (
  bucket_id = 'payment-receipts'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);

create policy "CT owners read payment-receipts bucket"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-receipts'
  and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or (
      public.has_role(auth.uid(), 'mestre'::public.app_role)
      and public.is_ct_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

create policy "Students read own payment-receipts bucket"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = public.get_user_ct(auth.uid())::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Students upload own payment-receipts bucket"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-receipts'
  and public.has_role(auth.uid(), 'aluno'::public.app_role)
  and (storage.foldername(name))[1] = public.get_user_ct(auth.uid())::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Students update own payment-receipts bucket"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'payment-receipts'
  and public.has_role(auth.uid(), 'aluno'::public.app_role)
  and (storage.foldername(name))[1] = public.get_user_ct(auth.uid())::text
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'payment-receipts'
  and public.has_role(auth.uid(), 'aluno'::public.app_role)
  and (storage.foldername(name))[1] = public.get_user_ct(auth.uid())::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Students delete own payment-receipts bucket"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-receipts'
  and public.has_role(auth.uid(), 'aluno'::public.app_role)
  and (storage.foldername(name))[1] = public.get_user_ct(auth.uid())::text
  and (storage.foldername(name))[2] = auth.uid()::text
);
