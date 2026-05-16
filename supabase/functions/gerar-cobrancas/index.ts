import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadScopedConfigMap } from "../_shared/secure-config.ts";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getProfileByUserId } from "../_shared/profiles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AlunoPlano {
  id: string;
  aluno_id: string;
  plano_id: string;
  ct_id: string;
  dia_vencimento: number;
  ativo: boolean;
  payment_status?: string;
  valor_override?: number | null;
}

interface Plano {
  id: string;
  nome: string;
  valor: number;
}

interface Profile {
  user_id: string;
  nome: string;
  sobrenome: string | null;
  email: string | null;
  telefone: string | null;
}

const getMonthBounds = (referenceDate: Date) => {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const next = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1));

  return {
    currentMonth: start.toISOString().slice(0, 7),
    monthStart: start.toISOString().slice(0, 10),
    nextMonthStart: next.toISOString().slice(0, 10),
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role
    const roles = await getUserRoles(adminClient, user.id);
    const highestRole = getHighestRole(roles);

    if (!highestRole || (highestRole !== "admin" && highestRole !== "mestre")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { ct_id: requestedCtId, mode } = body; // mode: "generate" (create charges) or "notify" (send messages only)

    const callerProfile = await getProfileByUserId(adminClient, user.id, "ct_id");
    const ownCtId = callerProfile?.ct_id || null;
    const effectiveCtId = highestRole === "admin" ? requestedCtId : ownCtId;

    if (!effectiveCtId) {
      return new Response(JSON.stringify({ error: "ct_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (highestRole === "mestre" && requestedCtId && requestedCtId !== ownCtId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch config for this CT
    const configMap = await loadScopedConfigMap(adminClient, "payment", effectiveCtId);

    // Fetch active aluno_planos for this CT
    const { data: alunoPlanos } = await adminClient
      .from("aluno_planos")
      .select("*")
      .eq("ct_id", effectiveCtId)
      .eq("ativo", true);

    if (!alunoPlanos?.length) {
      return new Response(JSON.stringify({ message: "Nenhum aluno com plano ativo", generated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch planos
    const planoIds = [...new Set(alunoPlanos.map((ap: any) => ap.plano_id))];
    const { data: planos } = await adminClient
      .from("planos_mensalidade")
      .select("id, nome, valor")
      .in("id", planoIds);

    const planoMap: Record<string, Plano> = {};
    (planos || []).forEach((p: any) => { planoMap[p.id] = p; });

    // Fetch profiles
    const alunoIds = [...new Set(alunoPlanos.map((ap: any) => ap.aluno_id))];
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, nome, sobrenome, email, telefone")
      .in("user_id", alunoIds);

    const profileMap: Record<string, Profile> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

    const templateTitulo = configMap["template_titulo"] || "Cobrança de Mensalidade";
    const templateMensagem = configMap["template_mensagem"] ||
      "Olá {nome}, sua mensalidade de R$ {valor} vence em {data_vencimento}.\n\nPIX: {chave_pix}";

    const now = new Date();
    const { currentMonth, monthStart, nextMonthStart } = getMonthBounds(now);

    const results: any[] = [];

    for (const ap of alunoPlanos as AlunoPlano[]) {
      if (ap.payment_status && ap.payment_status !== "active") {
        results.push({
          aluno_id: ap.aluno_id,
          status: "ignorada",
          reason: `payment_status=${ap.payment_status}`,
        });
        continue;
      }

      const plano = planoMap[ap.plano_id];
      const profile = profileMap[ap.aluno_id];
      if (!plano || !profile) continue;

      const dueDay = Math.min(ap.dia_vencimento, 28);
      const dueDate = `${currentMonth}-${String(dueDay).padStart(2, "0")}`;
      const chargeValue = Number(ap.valor_override ?? plano.valor);

      if (!Number.isFinite(chargeValue) || chargeValue <= 0) {
        results.push({
          aluno: profile.nome,
          status: "ignorada",
          reason: "valor_invalido",
        });
        continue;
      }

      // Check if charge already exists for this month
      const { data: existing } = await adminClient
        .from("cobrancas")
        .select("id")
        .eq("aluno_id", ap.aluno_id)
        .eq("ct_id", effectiveCtId)
        .gte("data_vencimento", monthStart)
        .lt("data_vencimento", nextMonthStart)
        .limit(1);

      if (existing && existing.length > 0) {
        results.push({ aluno: profile.nome, status: "já existe cobrança neste mês" });
        continue;
      }

      // Insert cobrança
      const { error: insertError } = await adminClient.from("cobrancas").insert({
        aluno_id: ap.aluno_id,
        plano_id: ap.plano_id,
        ct_id: effectiveCtId,
        valor: chargeValue,
        data_vencimento: dueDate,
        status: "pendente",
        payment_method: "pix",
      });

      if (insertError) {
        results.push({ aluno: profile.nome, status: "erro", error: insertError.message });
        continue;
      }

      // Build notification message
      const chavePix = configMap["pix_chave"] || "";
      const msg = templateMensagem
        .replace(/{nome}/g, profile.nome)
        .replace(/{valor}/g, chargeValue.toFixed(2).replace(".", ","))
        .replace(/{data_vencimento}/g, new Date(dueDate).toLocaleDateString("pt-BR"))
        .replace(/{chave_pix}/g, chavePix)
        .replace(/{link_boleto}/g, "");

      results.push({
        aluno: profile.nome,
        status: "gerada",
        metodo: "pix_manual",
        valor: chargeValue,
      });

      // Send notification via existing send-message function
      if (profile.email || profile.telefone) {
        try {
          const channels: string[] = [];
          if (profile.email) channels.push("email");
          if (profile.telefone) channels.push("whatsapp");

          await fetch(`${supabaseUrl}/functions/v1/send-message`, {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ct_id: effectiveCtId,
              titulo: templateTitulo,
              conteudo: `<p>${msg.replace(/\n/g, "<br>")}</p>`,
              conteudo_texto: msg,
              channels,
              recipients: [{
                nome: profile.nome,
                sobrenome: profile.sobrenome || "",
                email: profile.email || undefined,
                telefone: profile.telefone || undefined,
              }],
            }),
          });
        } catch (err) {
          console.error("[gerar-cobrancas] Erro ao enviar notificação");
        }
      }
    }

    return new Response(JSON.stringify({ results, total: results.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[gerar-cobrancas] Erro na geração de cobrança");
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
