import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserRoles } from "../_shared/roles.ts";
import { getProfileByUserId } from "../_shared/profiles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceMeters = (
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number,
) => {
  const earthRadius = 6371000;
  const latDelta = toRadians(destinationLat - originLat);
  const lngDelta = toRadians(destinationLng - originLng);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2)
    + Math.cos(toRadians(originLat))
      * Math.cos(toRadians(destinationLat))
      * Math.sin(lngDelta / 2)
      * Math.sin(lngDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
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

    if (!roles.includes("aluno")) {
      throw new Error("Apenas alunos podem confirmar presença por geolocalização");
    }

    const { chamada_id, latitude, longitude } = await req.json();
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!chamada_id) {
      throw new Error("chamada_id é obrigatório");
    }

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new Error("Latitude e longitude inválidas");
    }

    const profile = await getProfileByUserId(supabaseAdmin, user.id, "ct_id, nome, sobrenome");

    if (!profile?.ct_id) {
      throw new Error("Aluno não está vinculado a um CT");
    }

    const { data: chamada } = await supabaseAdmin
      .from("aula_chamadas")
      .select("id, ct_id, horario_aula_id, status, expira_em, titulo")
      .eq("id", chamada_id)
      .maybeSingle();

    if (!chamada) {
      throw new Error("Chamada não encontrada");
    }

    if (chamada.ct_id !== profile.ct_id) {
      throw new Error("Esta chamada não pertence ao seu CT");
    }

    if (chamada.status !== "ativa") {
      return new Response(JSON.stringify({
        approved: false,
        reason: "chamada_encerrada",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(chamada.expira_em).getTime() < Date.now()) {
      await supabaseAdmin
        .from("aula_chamadas")
        .update({
          status: "encerrada",
          encerrada_em: new Date().toISOString(),
        })
        .eq("id", chamada.id);

      return new Response(JSON.stringify({
        approved: false,
        reason: "chamada_expirada",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ctData } = await supabaseAdmin
      .from("centros_treinamento")
      .select("latitude, longitude, raio_presenca_metros")
      .eq("id", chamada.ct_id)
      .maybeSingle();

    if (!ctData || ctData.latitude == null || ctData.longitude == null) {
      throw new Error("CT sem localização configurada");
    }

    const distance = haversineDistanceMeters(
      Number(ctData.latitude),
      Number(ctData.longitude),
      lat,
      lng,
    );

    const allowedRadius = Number(ctData.raio_presenca_metros) || 100;

    if (distance > allowedRadius) {
      return new Response(JSON.stringify({
        approved: false,
        reason: "fora_do_perimetro",
        distance_meters: Math.round(distance),
        allowed_radius_meters: allowedRadius,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];

    let presenceQuery = supabaseAdmin
      .from("presencas")
      .select("id")
      .eq("aluno_id", user.id)
      .eq("ct_id", chamada.ct_id)
      .eq("data_treino", today);

    if (chamada.horario_aula_id) {
      presenceQuery = presenceQuery.eq("horario_aula_id", chamada.horario_aula_id);
    }

    const { data: existingPresence } = await presenceQuery.maybeSingle();

    const presencePayload = {
      aluno_id: user.id,
      ct_id: chamada.ct_id,
      data_treino: today,
      chamada_id: chamada.id,
      horario_aula_id: chamada.horario_aula_id || null,
      origem: "gps_notificacao",
      latitude: lat,
      longitude: lng,
      distancia_metros: Math.round(distance),
      validada_geolocalizacao: true,
      registrada_por: user.id,
      observacao_validacao: `Presença validada por geolocalização (${Math.round(distance)} m do CT).`,
    };

    if (existingPresence?.id) {
      await supabaseAdmin
        .from("presencas")
        .update(presencePayload)
        .eq("id", existingPresence.id);
    } else {
      await supabaseAdmin
        .from("presencas")
        .insert(presencePayload);
    }

    return new Response(JSON.stringify({
      approved: true,
      reason: "presenca_registrada",
      distance_meters: Math.round(distance),
      allowed_radius_meters: allowedRadius,
      title: chamada.titulo,
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
