import { supabase } from "@/integrations/supabase/client";

const rolePriority = ["admin", "mestre", "aluno"] as const;

type UserRolePriority = (typeof rolePriority)[number];

const getHighestRole = (roles: string[]): UserRolePriority | null => {
  for (const role of rolePriority) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return null;
};

export const getUserRole = async (userId: string) => {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;

  const roles = (data || []).map((row) => String((row as any).role || "").trim());
  return getHighestRole(roles) || null;
};

export const getUserCtId = async (userId: string) => {
  const { data } = await supabase.from("profiles").select("ct_id").eq("user_id", userId).maybeSingle();
  return data?.ct_id || null;
};

export const getActiveCtSubscription = async (ctId: string | null) => {
  if (!ctId) return null;

  const today = new Date().toISOString();
  const { data } = await supabase
    .from("billing_subscriptions" as any)
    .select("id, ct_id, status, expires_at")
    .eq("ct_id", ctId)
    .in("status", ["active", "trialing"])
    .gte("expires_at", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
};

export const hasCtBillingHistory = async (ctId: string | null) => {
  if (!ctId) return false;

  const { count } = await supabase
    .from("billing_subscriptions" as any)
    .select("id", { count: "exact", head: true })
    .eq("ct_id", ctId);

  return Number(count || 0) > 0;
};

export const getPublicBillingPlans = async () => {
  const { data, error } = await supabase
    .from("billing_plans" as any)
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data || []) as any[];
};
