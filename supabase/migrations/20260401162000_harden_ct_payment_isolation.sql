create or replace function public.validate_aluno_planos_ct_isolation()
returns trigger
language plpgsql
as $$
declare
  aluno_ct_id uuid;
  plano_ct_id uuid;
begin
  if new.ct_id is null then
    raise exception 'aluno_planos.ct_id is required';
  end if;

  select p.ct_id
    into aluno_ct_id
  from public.profiles p
  where p.user_id = new.aluno_id;

  if aluno_ct_id is null or aluno_ct_id <> new.ct_id then
    raise exception 'Aluno does not belong to the informed CT';
  end if;

  select pm.ct_id
    into plano_ct_id
  from public.planos_mensalidade pm
  where pm.id = new.plano_id;

  if plano_ct_id is null or plano_ct_id <> new.ct_id then
    raise exception 'Plano does not belong to the informed CT';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_validate_aluno_planos_ct_isolation on public.aluno_planos;
create trigger trg_validate_aluno_planos_ct_isolation
before insert or update on public.aluno_planos
for each row
execute function public.validate_aluno_planos_ct_isolation();
create or replace function public.validate_cobrancas_ct_isolation()
returns trigger
language plpgsql
as $$
declare
  aluno_ct_id uuid;
  plano_ct_id uuid;
begin
  if new.ct_id is null then
    raise exception 'cobrancas.ct_id is required';
  end if;

  select p.ct_id
    into aluno_ct_id
  from public.profiles p
  where p.user_id = new.aluno_id;

  if aluno_ct_id is null or aluno_ct_id <> new.ct_id then
    raise exception 'Aluno does not belong to the informed CT';
  end if;

  if new.plano_id is not null then
    select pm.ct_id
      into plano_ct_id
    from public.planos_mensalidade pm
    where pm.id = new.plano_id;

    if plano_ct_id is null or plano_ct_id <> new.ct_id then
      raise exception 'Plano does not belong to the informed CT';
    end if;
  end if;

  return new;
end;
$$;
drop trigger if exists trg_validate_cobrancas_ct_isolation on public.cobrancas;
create trigger trg_validate_cobrancas_ct_isolation
before insert or update on public.cobrancas
for each row
execute function public.validate_cobrancas_ct_isolation();
create or replace function public.validate_pagamentos_ct_isolation()
returns trigger
language plpgsql
as $$
declare
  aluno_ct_id uuid;
begin
  if new.aluno_id is null or new.ct_id is null then
    return new;
  end if;

  select p.ct_id
    into aluno_ct_id
  from public.profiles p
  where p.user_id = new.aluno_id;

  if aluno_ct_id is null or aluno_ct_id <> new.ct_id then
    raise exception 'Pagamento references an aluno outside the informed CT';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_validate_pagamentos_ct_isolation on public.pagamentos;
create trigger trg_validate_pagamentos_ct_isolation
before insert or update on public.pagamentos
for each row
execute function public.validate_pagamentos_ct_isolation();
