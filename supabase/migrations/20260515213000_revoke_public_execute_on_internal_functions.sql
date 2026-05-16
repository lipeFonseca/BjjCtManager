-- Complemento do hardening:
-- remove EXECUTE herdado de PUBLIC e reabre apenas o minimo necessario para o app

do $$
declare
  fn record;
begin
  -- Funcoes internas de trigger/setup nao devem ficar acessiveis por RPC.
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
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;

  -- Helpers ainda necessarios para policies devem ser invisiveis para anon
  -- e acessiveis apenas para usuarios autenticados.
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
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;

  -- Helper sem uso funcional conhecido fora do banco deve permanecer fechada.
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
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end
$$;
