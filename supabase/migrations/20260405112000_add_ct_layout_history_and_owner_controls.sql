create or replace function public.is_ct_owner(_user_id uuid, _ct_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.centros_treinamento
    where id = _ct_id
      and mestre_lider_id = _user_id
  );
$$;
create table if not exists public.ct_layout_change_log (
  id uuid primary key default gen_random_uuid(),
  ct_id uuid not null references public.centros_treinamento(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text not null default 'Sistema',
  changed_fields text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);
create index if not exists ct_layout_change_log_ct_id_created_at_idx
on public.ct_layout_change_log (ct_id, created_at desc);
alter table public.ct_layout_change_log enable row level security;
drop policy if exists "Admins read ct layout change log" on public.ct_layout_change_log;
create policy "Admins read ct layout change log"
on public.ct_layout_change_log
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "Mestres read own ct layout change log" on public.ct_layout_change_log;
create policy "Mestres read own ct layout change log"
on public.ct_layout_change_log
for select
to authenticated
using (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and ct_id = public.get_user_ct(auth.uid())
);
create or replace function public.log_ct_layout_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_fields text[] := '{}'::text[];
  actor_id uuid := auth.uid();
  actor_name text := 'Sistema';
begin
  if
    old.cor_primaria is distinct from new.cor_primaria
    or old.cor_secundaria is distinct from new.cor_secundaria
    or old.cor_fundo is distinct from new.cor_fundo
    or old.cor_texto is distinct from new.cor_texto
  then
    changed_fields := array_append(changed_fields, 'Cores');
  end if;

  if
    old.logo_url is distinct from new.logo_url
    or old.logo_size is distinct from new.logo_size
    or old.logo_bg_color is distinct from new.logo_bg_color
    or old.logo_bg_enabled is distinct from new.logo_bg_enabled
  then
    changed_fields := array_append(changed_fields, 'Logo');
  end if;

  if
    old.banner_url is distinct from new.banner_url
    or old.banner_position is distinct from new.banner_position
  then
    changed_fields := array_append(changed_fields, 'Banner');
  end if;

  if
    old.nome is distinct from new.nome
    or old.subtitulo is distinct from new.subtitulo
    or old.endereco is distinct from new.endereco
    or old.nome_font_size is distinct from new.nome_font_size
    or old.endereco_font_size is distinct from new.endereco_font_size
    or old.subtitulo_font_size is distinct from new.subtitulo_font_size
    or old.nome_font_family is distinct from new.nome_font_family
    or old.endereco_font_family is distinct from new.endereco_font_family
    or old.subtitulo_font_family is distinct from new.subtitulo_font_family
    or old.nome_color is distinct from new.nome_color
    or old.endereco_color is distinct from new.endereco_color
    or old.subtitulo_color is distinct from new.subtitulo_color
  then
    changed_fields := array_append(changed_fields, 'Textos');
  end if;

  if
    old.latitude is distinct from new.latitude
    or old.longitude is distinct from new.longitude
    or old.raio_presenca_metros is distinct from new.raio_presenca_metros
  then
    changed_fields := array_append(changed_fields, 'Geolocalizacao');
  end if;

  if old.neve_ativa is distinct from new.neve_ativa then
    changed_fields := array_append(changed_fields, 'Efeito visual');
  end if;

  if coalesce(array_length(changed_fields, 1), 0) = 0 then
    return new;
  end if;

  if actor_id is not null then
    select nullif(trim(concat_ws(' ', nome, sobrenome)), '')
    into actor_name
    from public.profiles
    where user_id = actor_id
    limit 1;

    actor_name := coalesce(actor_name, 'Usuario');
  end if;

  insert into public.ct_layout_change_log (ct_id, changed_by, changed_by_name, changed_fields)
  values (new.id, actor_id, actor_name, changed_fields);

  delete from public.ct_layout_change_log
  where ct_id = new.id
    and id not in (
      select id
      from public.ct_layout_change_log
      where ct_id = new.id
      order by created_at desc, id desc
      limit 5
    );

  return new;
end;
$$;
drop trigger if exists trg_log_ct_layout_change on public.centros_treinamento;
create trigger trg_log_ct_layout_change
after update of
  nome,
  cor_primaria,
  cor_secundaria,
  cor_fundo,
  cor_texto,
  logo_url,
  banner_url,
  neve_ativa,
  logo_size,
  banner_position,
  logo_bg_color,
  logo_bg_enabled,
  subtitulo,
  endereco,
  nome_font_size,
  endereco_font_size,
  subtitulo_font_size,
  nome_font_family,
  endereco_font_family,
  subtitulo_font_family,
  nome_color,
  endereco_color,
  subtitulo_color,
  latitude,
  longitude,
  raio_presenca_metros
on public.centros_treinamento
for each row
execute function public.log_ct_layout_change();
drop policy if exists "Mestre can manage CT planos_mensalidade" on public.planos_mensalidade;
create policy "Responsavel do CT gerencia planos_mensalidade"
on public.planos_mensalidade
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
drop policy if exists "Mestre can manage CT aluno_planos" on public.aluno_planos;
create policy "Responsavel do CT gerencia aluno_planos"
on public.aluno_planos
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
drop policy if exists "Mestre can manage CT cobrancas" on public.cobrancas;
create policy "Responsavel do CT gerencia cobrancas"
on public.cobrancas
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
drop policy if exists "Mestre manage non-secret CT config_pagamento" on public.config_pagamento;
create policy "Responsavel do CT gerencia config_pagamento"
on public.config_pagamento
for all
to authenticated
using (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
  and config_key not in ('asaas_api_key', 'asaas_webhook_token')
)
with check (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
  and config_key not in ('asaas_api_key', 'asaas_webhook_token')
);
drop policy if exists "Mestre can read own webhook_config" on public.webhook_config;
drop policy if exists "Mestre manage non-secret own webhook_config" on public.webhook_config;
create policy "Responsavel do CT gerencia webhook_config"
on public.webhook_config
for all
to authenticated
using (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
  and config_key not in ('gmail_app_password', 'uazapi_instance_apikey', 'telegram_bot_token')
)
with check (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
  and config_key not in ('gmail_app_password', 'uazapi_instance_apikey', 'telegram_bot_token')
);
