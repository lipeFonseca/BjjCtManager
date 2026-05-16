import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getContentHeaders, getOptionsHeaders, isOriginAllowed } from "../_shared/cors.ts";

const isMissingTableError = (message: string | undefined) =>
  Boolean(message && message.includes("Could not find the table 'public."));

const deleteByCtId = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  ctId: string,
) => {
  const { error } = await supabaseAdmin.from(table).delete().eq("ct_id", ctId);
  if (error) {
    if (isMissingTableError(error.message)) {
      console.warn(`[delete-ct-users] tabela opcional ausente, ignorando: ${table}`);
      return;
    }
    throw new Error(`Erro ao limpar ${table}: ${error.message}`);
  }
};

const deleteByUserIds = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  column: string,
  userIds: string[],
) => {
  if (!userIds.length) return;

  const { error } = await supabaseAdmin.from(table).delete().in(column, userIds);
  if (error) {
    if (isMissingTableError(error.message)) {
      console.warn(`[delete-ct-users] tabela opcional ausente, ignorando: ${table}`);
      return;
    }
    throw new Error(`Erro ao limpar ${table} por ${column}: ${error.message}`);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getOptionsHeaders(req.headers) });
  }

  try {
    if (req.headers.get("origin") && !isOriginAllowed(req.headers)) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: getContentHeaders(req.headers),
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Nao autenticado");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !caller) {
      throw new Error("Nao autenticado");
    }

    const roles = await getUserRoles(supabaseAdmin, caller.id);
    const highestRole = getHighestRole(roles);
    if (highestRole !== "admin") {
      throw new Error("Sem permissao");
    }

    const { ct_id: ctId } = await req.json();
    if (!ctId) {
      throw new Error("ct_id e obrigatorio");
    }

    const { data: ct, error: ctError } = await supabaseAdmin
      .from("centros_treinamento")
      .select("id, mestre_lider_id")
      .eq("id", ctId)
      .maybeSingle();

    if (ctError) {
      throw ctError;
    }

    if (!ct) {
      throw new Error("CT nao encontrado");
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("ct_id", ctId);

    if (profilesError) {
      throw profilesError;
    }

    const ctUserIds = Array.from(
      new Set([
        ...((profiles || []).map((profile) => String(profile.user_id)).filter(Boolean)),
        ...(ct.mestre_lider_id ? [String(ct.mestre_lider_id)] : []),
      ]),
    );

    const nonCtTables = [
      "alertas_graduacao",
      "aluno_documentos",
      "aluno_planos",
      "avaliacoes",
      "aula_chamadas",
      "chat",
      "cobrancas",
      "config_pagamento",
      "ct_layout_change_log",
      "edge_function_diagnostics",
      "financeiro",
      "horarios_aulas",
      "mensagem_grupos",
      "mensagens",
      "metricas_graduacao",
      "pagamentos",
      "planos_mensalidade",
      "presencas",
      "progresso_metricas",
      "secure_config_entries",
      "tempo_graduacao",
      "webhook_config",
    ];

    for (const table of nonCtTables) {
      await deleteByCtId(supabaseAdmin, table, ctId);
    }

    await deleteByCtId(supabaseAdmin, "billing_subscriptions", ctId);

    await deleteByUserIds(supabaseAdmin, "billing_subscriptions", "user_id", ctUserIds);
    await deleteByUserIds(supabaseAdmin, "pagamentos", "aluno_id", ctUserIds);
    await deleteByUserIds(supabaseAdmin, "mensagens_enviadas", "aluno_id", ctUserIds);
    await deleteByUserIds(supabaseAdmin, "mensagens_enviadas", "enviado_por", ctUserIds);
    await deleteByUserIds(supabaseAdmin, "mensagem_destinatarios", "destinatario_id", ctUserIds);
    await deleteByUserIds(supabaseAdmin, "mensagem_grupo_membros", "destinatario_id", ctUserIds);

    if (ctUserIds.length) {
      const { error: profileMentorCleanupError } = await supabaseAdmin
        .from("profiles")
        .update({ mestre_id: null })
        .in("mestre_id", ctUserIds);

      if (profileMentorCleanupError) {
        throw new Error(`Erro ao limpar referencias de mestre_id: ${profileMentorCleanupError.message}`);
      }

      const { error: rolesDeleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .in("user_id", ctUserIds);

      if (rolesDeleteError) {
        throw new Error(`Erro ao remover papeis dos usuarios: ${rolesDeleteError.message}`);
      }

      const { error: profilesDeleteError } = await supabaseAdmin
        .from("profiles")
        .delete()
        .in("user_id", ctUserIds);

      if (profilesDeleteError) {
        throw new Error(`Erro ao remover perfis dos usuarios: ${profilesDeleteError.message}`);
      }
    }

    const { error: deleteCtError } = await supabaseAdmin
      .from("centros_treinamento")
      .delete()
      .eq("id", ctId);

    if (deleteCtError) {
      throw deleteCtError;
    }

    for (const userId of ctUserIds) {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        throw new Error(`Erro ao remover usuario ${userId}: ${deleteUserError.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, deleted_users: ctUserIds.length }), {
      headers: getContentHeaders(req.headers),
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado" }), {
      status: 400,
      headers: getContentHeaders(req.headers),
    });
  }
});
