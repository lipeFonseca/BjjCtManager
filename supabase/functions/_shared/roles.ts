import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AppRole = "admin" | "mestre" | "aluno";

const rolePriority: AppRole[] = ["admin", "mestre", "aluno"];

export const getUserRoles = async (
  client: ReturnType<typeof createClient>,
  userId: string,
) => {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw error;

  return (data || [])
    .map((row) => String(row.role || "").trim())
    .filter(Boolean) as AppRole[];
};

export const getHighestRole = (roles: string[]): AppRole | null => {
  for (const role of rolePriority) {
    if (roles.includes(role)) {
      return role;
    }
  }

  return null;
};

export const hasAnyRole = (roles: string[], expected: AppRole[]) =>
  expected.some((role) => roles.includes(role));
