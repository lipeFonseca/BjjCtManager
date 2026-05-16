import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getProfileByUserId } from "../_shared/profiles.ts";
import { buildSyntheticLoginEmail, normalizeUsername } from "../_shared/auth.ts";
import { getContentHeaders, getOptionsHeaders, isOriginAllowed } from "../_shared/cors.ts";
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Não autenticado");
    }
    const token = authHeader.replace("Bearer ", "");

    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !caller) {
      console.error("Auth error:", userError?.message);
      throw new Error("Não autenticado");
    }

    const callerId = caller.id;

    const callerRoles = await getUserRoles(supabaseAdmin, callerId);
    const callerRoleValue = getHighestRole(callerRoles);
    if (!callerRoleValue || (callerRoleValue !== "admin" && callerRoleValue !== "mestre")) {
      throw new Error("Sem permissão");
    }

    const { password, nome, sobrenome, telefone, faixa, grau, sexo, ct_id, role, username, contact_email } = await req.json();

    // Determine effective role and CT
    let effectiveCtId = ct_id;
    let effectiveRole = role;

    // SECURITY: Only 1 admin allowed in entire system
    if (effectiveRole === "admin") {
      const { data: existingAdmins } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("role", "admin");
      
      if (existingAdmins && existingAdmins.length > 0) {
        throw new Error("Sistema possui apenas 1 dono (admin). Nenhum novo admin pode ser criado.");
      }
    }

    if (callerRoleValue === "mestre") {
      // Only admins may create new privileged operator accounts.
      if (effectiveRole && effectiveRole !== "aluno") {
        throw new Error("Sem permissão para criar este tipo de usuário");
      }
      effectiveRole = "aluno";
      // Force CT to mestre's own CT
      const callerProfile = await getProfileByUserId(supabaseAdmin, callerId, "ct_id");
      effectiveCtId = callerProfile?.ct_id || ct_id;
    }

    if (!effectiveCtId) {
      throw new Error("CT inválido ou não selecionado. Selecione o centro correto.");
    }

    const normalizedUsername = normalizeUsername(username);

    if (!password || !nome || !normalizedUsername) {
      throw new Error("Nome de usuário, senha e nome são obrigatórios");
    }
    if (!USERNAME_REGEX.test(normalizedUsername)) {
      throw new Error("Nome de usuário inválido. Use 3 a 30 caracteres com letras, números, ponto, underline ou hífen");
    }
    if (password.length < 8) {
      throw new Error("A senha deve ter no mínimo 8 caracteres");
    }

    // Check if username already exists in the same CT
    const { data: existingUser, error: usernameCheckError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", normalizedUsername)
      .eq("ct_id", effectiveCtId)
      .maybeSingle();

    if (usernameCheckError) {
      throw usernameCheckError;
    }

    if (existingUser) {
      throw new Error(`Nome de usuário "${normalizedUsername}" já está em uso neste CT. Escolha outro.`);
    }

    const generatedEmail = buildSyntheticLoginEmail(normalizedUsername, effectiveCtId);

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: generatedEmail,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (createError) throw createError;

    const userId = newUser.user.id;

    // Create or update profile (trigger may have already created it)
    const upsertResult = await supabaseAdmin.from("profiles").upsert({
      user_id: userId,
      nome,
      sobrenome: sobrenome || null,
      telefone: telefone || null,
      faixa: faixa || "branca",
      grau: grau ?? 0,
      sexo: sexo || null,
      ct_id: effectiveCtId || null,
      email: contact_email || null,
      username: normalizedUsername,
    }, { onConflict: "user_id" });

    if (upsertResult.error) {
      // Handle unique constraint error from DB
      if (upsertResult.error.message && upsertResult.error.message.includes("username")) {
        throw new Error(`Nome de usuário "${normalizedUsername}" já está em uso neste CT. Escolha outro.`);
      }
      throw upsertResult.error;
    }

    // Delete any existing roles (trigger may have created one) then insert the correct role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: effectiveRole || "aluno",
    });

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: getContentHeaders(req.headers),
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: getContentHeaders(req.headers),
    });
  }
});
