const publishableKey = "sb_publishable_giw_roSco13nnvyyx6_CTQ_dVcfXCMx";
const origin = "https://bjjctmanager.pages.dev";
const functionBase = "https://eouwdgnbpovlihbrawmm.supabase.co/functions/v1";

const loginResponse = await fetch(`${functionBase}/login-by-username`, {
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

const loginData = await loginResponse.json().catch(() => ({}));
if (!loginResponse.ok || !loginData?.session?.access_token) {
  console.log(JSON.stringify({ stage: "login", ok: false, status: loginResponse.status, body: loginData }, null, 2));
  process.exit(1);
}

const ctId = process.argv[2];
if (!ctId) {
  console.log(JSON.stringify({ stage: "input", ok: false, error: "ctId missing" }, null, 2));
  process.exit(1);
}

const deleteResponse = await fetch(`${functionBase}/delete-ct-users`, {
  method: "POST",
  headers: {
    apikey: publishableKey,
    Authorization: `Bearer ${loginData.session.access_token}`,
    "Content-Type": "application/json",
    Origin: origin,
  },
  body: JSON.stringify({ ct_id: ctId }),
});

const deleteData = await deleteResponse.json().catch(() => ({}));

console.log(JSON.stringify({
  stage: "delete-ct",
  ok: deleteResponse.ok,
  status: deleteResponse.status,
  body: deleteData,
}, null, 2));
