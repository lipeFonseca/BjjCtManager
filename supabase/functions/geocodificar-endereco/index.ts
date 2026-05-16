import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getContentHeaders, getOptionsHeaders, isOriginAllowed } from "../_shared/cors.ts";

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
      throw new Error("Não autenticado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Não autenticado");
    }

    const roles = await getUserRoles(supabaseAdmin, user.id);
    const highestRole = getHighestRole(roles);

    if (!highestRole || (highestRole !== "admin" && highestRole !== "mestre")) {
      throw new Error("Sem permissão");
    }

    const { endereco, nome_ct } = await req.json();
    const normalizedAddress = String(endereco || "").trim();
    const normalizedCtName = String(nome_ct || "").trim();

    if (!normalizedAddress) {
      throw new Error("Endereço é obrigatório para geocodificação");
    }

    const query = normalizedCtName
      ? `${normalizedCtName}, ${normalizedAddress}`
      : normalizedAddress;

    const searchParams = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      addressdetails: "1",
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${searchParams.toString()}`, {
      headers: {
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "User-Agent": "BJJManager/1.0 (manual CT geocoding)",
      },
    });

    if (!response.ok) {
      throw new Error("Falha ao consultar o serviço de geocodificação");
    }

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        not_found: true,
        query,
      }), {
        headers: getContentHeaders(req.headers),
      });
    }

    const bestMatch = results[0];

    return new Response(JSON.stringify({
      success: true,
      query,
      latitude: bestMatch.lat,
      longitude: bestMatch.lon,
      display_name: bestMatch.display_name,
    }), {
      headers: getContentHeaders(req.headers),
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: getContentHeaders(req.headers),
    });
  }
});
