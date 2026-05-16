create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_monthly numeric(10, 2) not null default 0,
  price_yearly numeric(10, 2),
  user_limit integer not null default 1,
  launch_limit integer not null default 0,
  features jsonb not null default '[]'::jsonb,
  highlight_label text,
  is_active boolean not null default true,
  is_popular boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.billing_plans enable row level security;
create policy "Admins manage billing_plans"
on public.billing_plans
for all
to authenticated
using (has_role(auth.uid(), 'admin'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Public read active billing_plans"
on public.billing_plans
for select
using (is_active = true);
create table public.billing_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.billing_settings enable row level security;
create policy "Admins manage billing_settings"
on public.billing_settings
for all
to authenticated
using (has_role(auth.uid(), 'admin'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role));
create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  ct_id uuid references public.centros_treinamento(id) on delete set null,
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  status text not null default 'pending',
  billing_cycle text not null default 'monthly',
  payment_method text not null default 'pix',
  amount numeric(10, 2) not null default 0,
  trial_ends_at timestamptz,
  started_at timestamptz,
  expires_at timestamptz,
  paid_at timestamptz,
  canceled_at timestamptz,
  asaas_customer_id text,
  asaas_payment_id text unique,
  asaas_invoice_url text,
  asaas_pix_qrcode text,
  asaas_pix_copia_cola text,
  customer_name text not null,
  customer_email text not null,
  master_name text not null,
  ct_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billing_subscriptions_ct_id_idx on public.billing_subscriptions(ct_id);
create index billing_subscriptions_user_id_idx on public.billing_subscriptions(user_id);
create index billing_subscriptions_status_idx on public.billing_subscriptions(status);
alter table public.billing_subscriptions enable row level security;
create policy "Admins manage billing_subscriptions"
on public.billing_subscriptions
for all
to authenticated
using (has_role(auth.uid(), 'admin'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Members read own CT billing_subscriptions"
on public.billing_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
  or (ct_id is not null and ct_id = get_user_ct(auth.uid()))
);
insert into public.billing_plans (
  name,
  description,
  price_monthly,
  price_yearly,
  user_limit,
  launch_limit,
  features,
  highlight_label,
  is_active,
  is_popular,
  sort_order
)
values
  (
    'Personal',
    'Para um CT em crescimento com operacao enxuta.',
    97.00,
    970.00,
    3,
    500,
    '["1 CT","Painel operacional","Cadastro de alunos","Mensagens basicas","Relatorios essenciais"]'::jsonb,
    null,
    true,
    false,
    1
  ),
  (
    'Business',
    'Para operacoes com equipe e rotina mais intensa.',
    197.00,
    1970.00,
    10,
    3000,
    '["Tudo do Personal","Multiusuarios","Financeiro interno","Metricas avancadas","Automacoes com Asaas"]'::jsonb,
    'Mais popular',
    true,
    true,
    2
  ),
  (
    'Enterprise',
    'Para redes e operacoes com alto volume.',
    397.00,
    3970.00,
    999,
    99999,
    '["Tudo do Business","Suporte prioritario","Escalabilidade para multiplos CTs","Acompanhamento dedicado"]'::jsonb,
    null,
    true,
    false,
    3
  );
