create or replace function public.cleanup_ct_related_data()
returns trigger
language plpgsql
security definer
as $$
declare
  ct_user_ids uuid[];
begin
  select coalesce(array_agg(distinct p.user_id), '{}'::uuid[])
  into ct_user_ids
  from public.profiles p
  where p.ct_id = old.id
    and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p.user_id
        and ur.role = 'admin'
    );

  delete from public.alertas_graduacao where ct_id = old.id;
  delete from public.aluno_documentos where ct_id = old.id;
  delete from public.aluno_planos where ct_id = old.id;
  delete from public.avaliacoes where ct_id = old.id;
  delete from public.aula_chamadas where ct_id = old.id;
  delete from public.billing_subscriptions where ct_id = old.id;
  delete from public.chat where ct_id = old.id;
  delete from public.cobrancas where ct_id = old.id;
  delete from public.config_pagamento where ct_id = old.id;
  delete from public.ct_layout_change_log where ct_id = old.id;
  delete from public.edge_function_diagnostics where ct_id = old.id;
  delete from public.financeiro where ct_id = old.id;
  delete from public.horarios_aulas where ct_id = old.id;
  delete from public.mensagem_grupos where ct_id = old.id;
  delete from public.mensagens where ct_id = old.id;
  delete from public.metricas_graduacao where ct_id = old.id;
  delete from public.pagamentos where ct_id = old.id;
  delete from public.planos_mensalidade where ct_id = old.id;
  delete from public.presencas where ct_id = old.id;
  delete from public.progresso_metricas where ct_id = old.id;
  delete from public.secure_config_entries where ct_id = old.id;
  delete from public.tempo_graduacao where ct_id = old.id;
  delete from public.webhook_config where ct_id = old.id;

  if array_length(ct_user_ids, 1) is not null then
    delete from public.billing_subscriptions where user_id = any(ct_user_ids);
    delete from public.pagamentos where aluno_id = any(ct_user_ids);
    delete from public.mensagens_enviadas where aluno_id = any(ct_user_ids) or enviado_por = any(ct_user_ids);
    delete from public.mensagem_destinatarios where destinatario_id = any(ct_user_ids);
    delete from public.mensagem_grupo_membros where destinatario_id = any(ct_user_ids);

    update public.profiles
    set mestre_id = null
    where mestre_id = any(ct_user_ids);

    delete from public.user_roles where user_id = any(ct_user_ids);
    delete from public.profiles where user_id = any(ct_user_ids);
    delete from auth.users where id = any(ct_user_ids);
  end if;

  return old;
end;
$$;
drop trigger if exists trg_cleanup_ct_configs on public.centros_treinamento;
drop trigger if exists trg_cleanup_ct_related_data on public.centros_treinamento;
create trigger trg_cleanup_ct_related_data
before delete on public.centros_treinamento
for each row
execute function public.cleanup_ct_related_data();
comment on function public.cleanup_ct_related_data() is
  'Remove dados publicos e usuarios nao-admin vinculados a um CT antes da exclusao do centro.';
