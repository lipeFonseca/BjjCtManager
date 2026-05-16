const baseUrl = "https://eouwdgnbpovlihbrawmm.supabase.co/functions/v1";
const publishableKey = "sb_publishable_giw_roSco13nnvyyx6_CTQ_dVcfXCMx";
const origin = "https://413f5c96.bjjctmanager.pages.dev";
const tfteamCtId = "88cf8b02-0a95-42e1-8448-1a70be6a8404";

const loginResponse = await fetch(`${baseUrl}/login-by-username`, {
  method: "POST",
  headers: {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    "Content-Type": "application/json",
    Origin: origin,
  },
  body: JSON.stringify({
    username: "admin",
    password: "QAAdmin123!",
    ct: "",
  }),
});

const loginData = await loginResponse.json();
if (!loginResponse.ok || !loginData?.session?.access_token) {
  throw new Error(`Admin login failed: ${loginData?.error || loginResponse.status}`);
}

const accessToken = loginData.session.access_token;

const users = [
  {
    password: "QAMestre123!",
    nome: "QA",
    sobrenome: "Mestre",
    telefone: "",
    faixa: "preta",
    grau: 1,
    sexo: "Masculino",
    ct_id: tfteamCtId,
    role: "mestre",
    username: "qa.mestre",
    contact_email: null,
  },
  {
    password: "QAAluno123!",
    nome: "QA",
    sobrenome: "Aluno",
    telefone: "",
    faixa: "azul",
    grau: 2,
    sexo: "Masculino",
    ct_id: tfteamCtId,
    role: "aluno",
    username: "qa.aluno",
    contact_email: null,
  },
];

const results = [];

for (const user of users) {
  const response = await fetch(`${baseUrl}/create-user`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(user),
  });

  const data = await response.json().catch(() => ({}));
  results.push({
    username: user.username,
    status: response.status,
    ok: response.ok,
    body: data,
  });
}

console.log(JSON.stringify({ results }, null, 2));
