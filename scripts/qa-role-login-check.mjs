const endpoint = "https://eouwdgnbpovlihbrawmm.supabase.co/functions/v1/login-by-username";
const publishableKey = "sb_publishable_giw_roSco13nnvyyx6_CTQ_dVcfXCMx";
const origin = "https://413f5c96.bjjctmanager.pages.dev";

const payloads = [
  { role: "admin", username: "admin", password: "QAAdmin123!", ct: "" },
  { role: "mestre", username: "qa.mestre", password: "QAMestre123!", ct: "TFTeam" },
  { role: "aluno", username: "qa.aluno", password: "QAAluno123!", ct: "TFTeam" },
];

const results = [];

for (const payload of payloads) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    results.push({
      role: payload.role,
      username: payload.username,
      ok: response.ok && Boolean(data?.session?.access_token),
      status: response.status,
      userId: data?.user?.id || null,
      error: data?.error || null,
    });
  } catch (error) {
    results.push({
      role: payload.role,
      username: payload.username,
      ok: false,
      status: null,
      userId: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

console.log(JSON.stringify({ results }, null, 2));
