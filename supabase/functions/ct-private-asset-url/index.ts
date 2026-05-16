import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getProfileByUserId } from "../_shared/profiles.ts";
import { getContentHeaders, getOptionsHeaders, isOriginAllowed } from "../_shared/cors.ts";

type RequestBody = {
  paths?: string[];
  expires_in?: number;
};

const buildJsonResponse = (requestHeaders: Headers, payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: getContentHeaders(requestHeaders),
  });

const normalizePath = (value: string) =>
  String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");

const isSafePath = (value: string) => {
  const normalized = normalizePath(value);
  return Boolean(normalized) && !normalized.split("/").some((segment) => segment === "." || segment === "..");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getOptionsHeaders(req.headers) });
  }

  try {
    if (req.headers.get("origin") && !isOriginAllowed(req.headers)) {
      return buildJsonResponse(req.headers, { error: "Origin not allowed" }, 403);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return buildJsonResponse(req.headers, { error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return buildJsonResponse(req.headers, { error: "Unauthorized" }, 401);
    }

    const roles = await getUserRoles(adminClient, user.id);
    const highestRole = getHighestRole(roles);
    const profile = await getProfileByUserId(adminClient, user.id, "ct_id");
    const ownCtId = profile?.ct_id || null;

    if (!highestRole || !["admin", "mestre", "aluno"].includes(highestRole)) {
      return buildJsonResponse(req.headers, { error: "Forbidden" }, 403);
    }

    const body = (await req.json()) as RequestBody;
    const expiresIn = Math.min(Math.max(Number(body.expires_in) || 3600, 60), 86400);
    const requestedPaths = Array.from(
      new Set((body.paths || []).map(normalizePath).filter(isSafePath)),
    ).slice(0, 20);

    if (requestedPaths.length === 0) {
      return buildJsonResponse(req.headers, { urls: {} });
    }

    if (highestRole !== "admin") {
      if (!ownCtId) {
        return buildJsonResponse(req.headers, { error: "Usuario sem CT vinculado" }, 400);
      }

      const invalidPath = requestedPaths.find((path) => path.split("/")[0] !== ownCtId);
      if (invalidPath) {
        return buildJsonResponse(req.headers, { error: "Forbidden", path: invalidPath }, 403);
      }
    }

    const { data, error } = await adminClient.storage
      .from("ct-private-assets")
      .createSignedUrls(requestedPaths, expiresIn);

    if (error) {
      console.error("Erro ao gerar signed URLs:", error);
      return buildJsonResponse(req.headers, { error: error.message || "Erro ao gerar URLs" }, 500);
    }

    const urls = Object.fromEntries(
      (data || [])
        .filter((item) => item.path && item.signedUrl)
        .map((item) => [item.path, item.signedUrl]),
    );

    return buildJsonResponse(req.headers, { urls });
  } catch (error) {
    console.error("Erro em ct-private-asset-url:", error);
    return buildJsonResponse(
      req.headers,
      { error: error instanceof Error ? error.message : "Erro interno ao resolver asset" },
      500,
    );
  }
});
