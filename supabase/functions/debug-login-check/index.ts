import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const buildSyntheticLoginEmail = (username: string) => `${username}@bjjmanager.local`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { username, password } = await req.json();
    const normalizedUsername = String(username || "").trim().toLowerCase();

    if (!normalizedUsername) {
      throw new Error("username is required");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, username, nome, email, telefone, ct_id")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (profileError) throw profileError;

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("billing_subscriptions")
      .select("id, status, user_id, ct_id, paid_at, created_at, metadata, customer_email, master_name, ct_name")
      .contains("metadata", { master_username: normalizedUsername })
      .order("created_at", { ascending: false })
      .limit(5);

    if (subscriptionError) throw subscriptionError;

    const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authUsersError) throw authUsersError;

    const syntheticEmail = buildSyntheticLoginEmail(normalizedUsername);
    const authUser = authUsers.users.find((user) => user.email === syntheticEmail);

    let syntheticLogin: { ok: boolean; error: string | null } | null = null;
    if (password) {
      const attempt = await supabaseAuth.auth.signInWithPassword({
        email: syntheticEmail,
        password: String(password),
      });

      syntheticLogin = {
        ok: !attempt.error,
        error: attempt.error?.message || null,
      };
    }

    return new Response(
      JSON.stringify({
        username: normalizedUsername,
        synthetic_email: syntheticEmail,
        profile,
        auth_user: authUser
          ? {
              id: authUser.id,
              email: authUser.email,
              created_at: authUser.created_at,
              last_sign_in_at: authUser.last_sign_in_at,
              email_confirmed_at: authUser.email_confirmed_at,
            }
          : null,
        subscriptions,
        synthetic_login: syntheticLogin,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
