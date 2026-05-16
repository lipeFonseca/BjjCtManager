-- Hardening pre-publicacao:
-- 1. remove listagem ampla do bucket publico login-assets
-- 2. define search_path explicito para funcoes do schema public
-- 3. revoga EXECUTE de funcoes internas que nao devem ser expostas por RPC

drop policy if exists "Public read login-assets" on storage.objects;

do $$
declare
  fn record;
begin
  -- Normaliza o search_path de todas as funcoes em public para reduzir risco de
  -- object shadowing e atender ao advisor do Supabase.
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, auth, extensions',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end
$$;

do $$
declare
  fn record;
begin
  -- Funcoes internas de trigger/setup nao precisam ser invocaveis por usuarios.
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'cleanup_ct_configs',
        'cleanup_ct_related_data',
        'handle_new_user',
        'log_ct_layout_change',
        'rls_auto_enable',
        'set_aluno_planos_updated_at',
        'set_ct_store_updated_at',
        'set_payment_receipts_updated_at',
        'sync_ct_store_product_ct_id',
        'validate_aluno_planos_ct_isolation',
        'validate_cobrancas_ct_isolation',
        'validate_pagamentos_ct_isolation',
        'validate_payment_receipts_ct_isolation'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;

  -- Helpers de RLS ainda sao necessarios para usuarios autenticados, mas nao
  -- devem ficar expostos para anon.
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_user_ct',
        'has_role',
        'is_ct_owner'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from anon',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;

  -- Nao ha uso funcional conhecido para RPC direta desta helper no app.
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_user_role'
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end
$$;
