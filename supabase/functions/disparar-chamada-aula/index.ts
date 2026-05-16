import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getProfileByUserId } from "../_shared/profiles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Não autenticado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Não autenticado");
    }

    const roles = await getUserRoles(supabaseAdmin, user.id);
    const role = getHighestRole(roles);
    if (role !== "admin" && role !== "mestre") {
      throw new Error("Sem permissão");
    }

    const {
      ct_id: requestedCtId,
      horario_aula_id,
      titulo,
      mensagem,
      duracao_minutos,
    } = await req.json();

    let effectiveCtId = requestedCtId as string | undefined;

    if (role === "mestre") {
      const profile = await getProfileByUserId(supabaseAdmin, user.id, "ct_id");
      effectiveCtId = profile?.ct_id || requestedCtId;
    }

    if (!effectiveCtId) {
      throw new Error("CT não identificado");
    }

    const { data: ctData } = await supabaseAdmin
      .from("centros_treinamento")
      .select("nome, latitude, longitude, raio_presenca_metros")
      .eq("id", effectiveCtId)
      .maybeSingle();

    if (!ctData) {
      throw new Error("Centro de treinamento não encontrado");
    }

    if (ctData.latitude == null || ctData.longitude == null) {
      throw new Error("O CT ainda não possui localização configurada");
    }

    let horarioLabel = "Aula";
    if (horario_aula_id) {
      const { data: horario } = await supabaseAdmin
        .from("horarios_aulas")
        .select("descricao, horario_inicio, horario_fim, ct_id")
        .eq("id", horario_aula_id)
        .maybeSingle();

      if (!horario) {
        throw new Error("Horário de aula não encontrado");
      }

      if (horario.ct_id !== effectiveCtId) {
        throw new Error("O horário informado não pertence a este CT");
      }

      horarioLabel = horario.descricao?.trim()
        ? `${horario.descricao} (${horario.horario_inicio.slice(0, 5)} - ${horario.horario_fim.slice(0, 5)})`
        : `Aula ${horario.horario_inicio.slice(0, 5)} - ${horario.horario_fim.slice(0, 5)}`;
    }

    await supabaseAdmin
      .from("aula_chamadas")
      .update({
        status: "encerrada",
        encerrada_em: new Date().toISOString(),
      })
      .eq("ct_id", effectiveCtId)
      .eq("status", "ativa");

    const ttlMinutes = Math.min(Math.max(Number(duracao_minutos) || 15, 5), 60);
    const expiraEm = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

    const finalTitle = titulo?.trim() || `Chamada liberada: ${horarioLabel}`;
    const finalMessage = mensagem?.trim()
      || `A aula vai começar. Confirme sua presença dentro do raio de ${ctData.raio_presenca_metros || 100} m do CT.`;

    const { data: chamada, error: insertError } = await supabaseAdmin
      .from("aula_chamadas")
      .insert({
        ct_id: effectiveCtId,
        horario_aula_id: horario_aula_id || null,
        titulo: finalTitle,
        mensagem: finalMessage,
        iniciada_por: user.id,
        expira_em: expiraEm,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(JSON.stringify({
      success: true,
      chamada,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
