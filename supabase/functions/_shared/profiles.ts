import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const loadRows = async (
  client: ReturnType<typeof createClient>,
  column: "user_id" | "id",
  value: string,
  selectClause: string,
) => {
  const { data, error } = await client
    .from("profiles")
    .select(selectClause)
    .eq(column, value)
    .limit(2);

  if (error) throw error;

  if (!data?.length) {
    return null;
  }

  if (data.length > 1) {
    throw new Error("Perfil duplicado encontrado para este usuario.");
  }

  return data[0] as Record<string, unknown>;
};

export const getProfileByUserId = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  selectClause = "id, user_id, ct_id, username, nome, sobrenome, email, telefone, mestre_id",
) => loadRows(client, "user_id", userId, selectClause);

export const getProfileById = async (
  client: ReturnType<typeof createClient>,
  profileId: string,
  selectClause = "id, user_id, ct_id, username, nome, sobrenome, email, telefone, mestre_id",
) => loadRows(client, "id", profileId, selectClause);
