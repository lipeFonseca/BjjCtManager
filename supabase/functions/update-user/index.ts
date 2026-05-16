import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getProfileById } from "../_shared/profiles.ts";
import { buildSyntheticLoginEmail, normalizeUsername } from "../_shared/auth.ts";
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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("Nao autenticado");

    const callerRoles = await getUserRoles(supabaseAdmin, caller.id);
    const role = getHighestRole(callerRoles) || "aluno";

    const { profile_id, username, password, self } = await req.json();

    if (self === true) {
      if (!password) throw new Error("Senha e obrigatoria");
      if (password.length < 8) throw new Error("Senha deve ter no minimo 8 caracteres");

      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(caller.id, { password });
      if (pwError) throw new Error(`Erro ao atualizar senha: ${pwError.message}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: getContentHeaders(req.headers),
      });
    }

    if (!profile_id) throw new Error("ID do perfil e obrigatorio");

    const profile = await getProfileById(supabaseAdmin, profile_id, "user_id, username, mestre_id, ct_id");
    if (!profile) throw new Error("Perfil nao encontrado");

    const targetUserId = String(profile.user_id || "");
    if (!targetUserId) throw new Error("Perfil sem usuario vinculado");

    const targetRoles = await getUserRoles(supabaseAdmin, targetUserId);
    const targetRole = getHighestRole(targetRoles) || "aluno";

    if (role === "admin") {
      // admin can edit anyone
    } else if (role === "mestre") {
      const isSelf = targetUserId === caller.id;
      const isOwnStudent = profile.mestre_id === caller.id;
      const isPrivilegedTarget = targetRole === "admin" || targetRole === "mestre";

      if (!isSelf && (!isOwnStudent || isPrivilegedTarget)) {
        throw new Error("Sem permissao para editar este usuario");
      }
    } else if (targetUserId !== caller.id) {
      throw new Error("Sem permissao");
    }

    if (username) {
      const normalizedUsername = normalizeUsername(username);

      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("username", normalizedUsername)
        .eq("ct_id", profile.ct_id)
        .neq("id", profile_id)
        .maybeSingle();

      if (existing) throw new Error("Nome de usuario ja esta em uso");

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ username: normalizedUsername })
        .eq("id", profile_id);

      if (updateError) throw updateError;

      const newEmail = buildSyntheticLoginEmail(normalizedUsername, profile.ct_id);
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        email: newEmail,
      });

      if (authUpdateError && !authUpdateError.message.includes("not found")) {
        throw authUpdateError;
      }
    }

    if (password) {
      if (password.length < 8) throw new Error("Senha deve ter no minimo 8 caracteres");

      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password });
      if (pwError) throw new Error(`Erro ao atualizar senha: ${pwError.message}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: getContentHeaders(req.headers),
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: getContentHeaders(req.headers),
    });
  }
});
