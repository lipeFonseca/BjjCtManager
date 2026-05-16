import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { loadScopedConfigMap } from "../_shared/secure-config.ts";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getProfileByUserId } from "../_shared/profiles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Recipient {
  user_id?: string;
  nome: string;
  sobrenome?: string;
  email?: string;
  telefone?: string;
}

interface RequestBody {
  action?: "send" | "verify_config";
  channel?: "email" | "whatsapp" | "telegram";
  ct_id?: string;
  titulo?: string;
  conteudo?: string;
  conteudo_texto?: string;
  email_body_html?: string;
  email_html?: string;
  telegram_text?: string;
  whatsapp_text?: string;
  channels?: string[];
  recipients?: Recipient[];
  gmail_email?: string;
  gmail_app_password?: string;
  whatsapp_send_mode?: "wa_me" | "uazapi";
  uazapi_base_url?: string;
  uazapi_instance_name?: string;
  uazapi_instance_apikey?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
}

type DiagnosticContext = {
  requestId: string;
  phase: string;
  userId?: string | null;
  ctId?: string | null;
  role?: string | null;
  details?: Record<string, unknown>;
};

const normalizePlainText = (conteudoTexto: string) =>
  conteudoTexto
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeWhatsappTokenText = (value: string) =>
  value.replace(/\*/g, "-").replace(/_/g, "-").replace(/~/g, "-").replace(/`/g, "'");

const normalizeUazapiBaseUrl = (value: string) => value.replace(/\/+$/, "");

const safeErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
};

const buildErrorResponse = (
  message: string,
  status: number,
  context: DiagnosticContext,
) =>
  new Response(
    JSON.stringify({
      error: message,
      request_id: context.requestId,
      phase: context.phase,
      details: context.details || {},
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );

const persistDiagnostic = async (
  adminClient: ReturnType<typeof createClient> | null,
  functionName: string,
  context: DiagnosticContext,
  error: unknown,
) => {
  if (!adminClient) return;

  try {
    await adminClient.from("edge_function_diagnostics").insert({
      request_id: context.requestId,
      function_name: functionName,
      phase: context.phase,
      error_message: safeErrorMessage(error),
      user_id: context.userId || null,
      ct_id: context.ctId || null,
      role: context.role || null,
      details: context.details || {},
    });
  } catch (diagnosticError) {
    console.error("Error persisting edge function diagnostic:", diagnosticError);
  }
};

const stripEmailPreviewChrome = (html: string) => {
  if (!html) return "";

  const markedContent = html.match(/<div[^>]*data-bjj-email-preview-content="true"[^>]*>([\s\S]*?)<\/div>/i);
  if (markedContent?.[1]) {
    return markedContent[1].trim();
  }

  return html
    .replace(/<div[^>]*data-bjj-email-preview="true"[\s\S]*?<\/div>/gi, "")
    .replace(/Caixa de entrada/gi, "")
    .replace(/para mim/gi, "")
    .replace(/BJJ Manager\s*<[^>]+>/gi, "")
    .trim();
};

const buildEmailDeliveryHtml = (titulo: string, bodyHtml: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escapeHtml(titulo || "Mensagem")}</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      color-scheme: light;
      supported-color-schemes: light;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      color: #202124;
    }
    .shell {
      width: 100%;
      background: #ffffff;
    }
    .body {
      width: 100%;
      background: #ffffff;
      border: 0;
    }
    .header {
      padding: 28px 40px 14px;
      border-bottom: 1px solid #eef2f6;
      background: #ffffff;
    }
    .title {
      margin: 0;
      font-size: 32px;
      line-height: 1.2;
      font-weight: 700;
      color: #202124;
      letter-spacing: -0.03em;
      text-align: left;
    }
    .content {
      padding: 28px 40px 34px;
      background: #ffffff;
      color: #2f3640;
      font-size: 18px;
      line-height: 1.65;
    }
    .content p {
      margin: 0 0 16px;
      line-height: 1.7;
      color: #2f3640;
    }
    .content h1 {
      margin: 0 0 16px;
      line-height: 1.2;
      color: #202124;
    }
    .content h2 {
      margin: 0 0 14px;
      line-height: 1.25;
      color: #202124;
    }
    .content ul, .content ol {
      margin: 0 0 16px;
      padding-left: 22px;
      line-height: 1.7;
      color: #2f3640;
    }
    .content blockquote {
      margin: 0 0 16px;
      padding-left: 16px;
      border-left: 4px solid #d7dee8;
      line-height: 1.7;
      color: #44515f;
    }
    .content img {
      max-width: none !important;
      height: auto !important;
    }
    [data-bjj-auto-notice="true"] {
      display: inline-block !important;
      margin: 0 0 18px !important;
      padding: 8px 14px !important;
      border: 1px solid #d7dde6 !important;
      border-radius: 999px !important;
      background: #f7f8fa !important;
      color: #5b6472 !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      line-height: 1.4 !important;
    }
    [data-bjj-auto-notice="true"] p {
      margin: 0 !important;
      color: #5b6472 !important;
      font-size: 12px !important;
      line-height: 1.4 !important;
    }
    @media (max-width: 640px) {
      .header {
        padding: 18px 18px 12px !important;
      }
      .title {
        font-size: 24px !important;
      }
      .content {
        padding: 18px 18px 22px !important;
        font-size: 16px !important;
      }
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" class="shell" style="width:100%; border-collapse:collapse; background:#ffffff;">
    <tr>
      <td style="padding:0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" class="body" style="width:100%; border-collapse:separate; background:#ffffff;">
          <tr>
            <td bgcolor="#ffffff" class="header" style="padding:28px 40px 14px; border-bottom:1px solid #eef2f6; background:#ffffff;">
              <h1 class="title" style="margin:0; font-size:32px; line-height:1.2; font-weight:700; color:#202124; letter-spacing:-0.03em; text-align:left;">${escapeHtml(titulo || "Mensagem")}</h1>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" class="content" style="padding:28px 40px 34px; background:#ffffff; color:#2f3640; font-size:18px; line-height:1.65;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const buildChannelTextMessage = (titulo: string, conteudoTexto: string) => {
  const normalizedBody = normalizePlainText(conteudoTexto);

  return [`${titulo}`, normalizedBody].filter(Boolean).join("\n\n");
};

const buildTelegramHtmlMessage = (titulo: string, conteudoTexto: string) => {
  const normalizedBody = normalizePlainText(conteudoTexto);

  return [
    "<b>BJJ Manager</b>",
    `<b>${escapeHtml(titulo)}</b>`,
    escapeHtml(normalizedBody),
    "<i>Enviado pela mensageria do CT</i>",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const buildWhatsappTextMessage = (titulo: string, conteudoTexto: string) => {
  const normalizedBody = sanitizeWhatsappTokenText(normalizePlainText(conteudoTexto));
  const normalizedTitle = sanitizeWhatsappTokenText(titulo);

  return ["*BJJ Manager*", `*${normalizedTitle}*`, normalizedBody, "_Enviado pela mensageria do CT_"].filter(Boolean).join("\n\n");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  let phase = "boot";
  let userId: string | null = null;
  let targetCtId: string | null = null;
  let highestRole: string | null = null;
  let adminClient: ReturnType<typeof createClient> | null = null;
  let diagnosticDetails: Record<string, unknown> = {};

  try {
    phase = "auth_header";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return buildErrorResponse("Unauthorized", 401, {
        requestId,
        phase,
        details: { has_authorization_header: Boolean(authHeader) },
      });
    }

    phase = "clients";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    adminClient = createClient(supabaseUrl, serviceRoleKey);

    phase = "auth_user";
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return buildErrorResponse("Unauthorized", 401, {
        requestId,
        phase,
        details: { auth_error: userError?.message || null },
      });
    }

    userId = user.id;

    phase = "load_roles";
    const roles = await getUserRoles(adminClient, userId);
    highestRole = getHighestRole(roles);

    if (!highestRole || (highestRole !== "admin" && highestRole !== "mestre")) {
      return buildErrorResponse("Forbidden", 403, {
        requestId,
        phase,
        userId,
        role: highestRole,
        details: { roles },
      });
    }

    phase = "parse_body";
    const body: RequestBody = await req.json();

    phase = "resolve_ct";
    const profileData = await getProfileByUserId(adminClient, userId, "ct_id");
    const ownCtId = profileData?.ct_id || null;
    const requestedCtId = body.ct_id || null;
    targetCtId = highestRole === "admin" ? requestedCtId ?? ownCtId : ownCtId;
    diagnosticDetails = {
      action: body.action || "send",
      channel: body.channel || null,
      requested_ct_id: requestedCtId,
      own_ct_id: ownCtId,
      target_ct_id: targetCtId,
    };

    if (!targetCtId) {
      return new Response(JSON.stringify({ error: "Usuário sem CT vinculado para mensageria" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    phase = "load_config";
    const configMap = await loadScopedConfigMap(adminClient, "messaging", targetCtId);
    diagnosticDetails = {
      ...diagnosticDetails,
      has_gmail_email: Boolean(configMap["gmail_email"]),
      has_gmail_password: Boolean(configMap["gmail_app_password"]),
      has_telegram_chat_id: Boolean(configMap["telegram_chat_id"]),
      has_telegram_bot_token: Boolean(configMap["telegram_bot_token"]),
      has_uazapi_base_url: Boolean(configMap["uazapi_base_url"]),
      has_uazapi_instance_name: Boolean(configMap["uazapi_instance_name"]),
      has_uazapi_instance_apikey: Boolean(configMap["uazapi_instance_apikey"]),
    };

    if (body.action === "verify_config") {
      const channel = body.channel;

      if (channel === "email") {
        const gmailEmail = body.gmail_email || configMap["gmail_email"];
        const gmailAppPassword = body.gmail_app_password || configMap["gmail_app_password"];

        if (!gmailEmail || !gmailAppPassword) {
          return new Response(JSON.stringify({ ok: false, error: "Gmail não configurado completamente" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let client: SMTPClient | null = null;
        try {
          client = new SMTPClient({
            connection: {
              hostname: "smtp.gmail.com",
              port: 465,
              tls: true,
              auth: {
                username: gmailEmail,
                password: gmailAppPassword,
              },
            },
          });

          await client.send({
            from: `Validação BJJ Manager <${gmailEmail}>`,
            to: gmailEmail,
            subject: "Teste de configuração do Gmail",
            content: "Sua configuração do Gmail foi validada com sucesso pelo BJJ Manager.",
          });

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Erro ao conectar no SMTP" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } finally {
          try {
            if (client && typeof client.close === "function") {
              await client.close();
            }
          } catch {
            // ignore
          }
        }
      }

      if (channel === "whatsapp") {
        const whatsappMode = body.whatsapp_send_mode || (configMap["whatsapp_send_mode"] as "wa_me" | "uazapi" | undefined) || "wa_me";

        if (whatsappMode === "wa_me") {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const uazapiBaseUrl = body.uazapi_base_url || configMap["uazapi_base_url"];
        const uazapiInstanceName = body.uazapi_instance_name || configMap["uazapi_instance_name"];
        const uazapiInstanceApikey = body.uazapi_instance_apikey || configMap["uazapi_instance_apikey"];

        if (!uazapiBaseUrl || !uazapiInstanceName || !uazapiInstanceApikey) {
          return new Response(JSON.stringify({ ok: false, error: "Uazapi nao configurada completamente" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          const normalizedBaseUrl = normalizeUazapiBaseUrl(uazapiBaseUrl);
          const res = await fetch(`${normalizedBaseUrl}/webhook/find/${uazapiInstanceName}`, {
            method: "GET",
            headers: {
              apikey: uazapiInstanceApikey,
            },
          });
          const payload = await res.text();

          return new Response(
            JSON.stringify({
              ok: res.ok,
              error: res.ok ? null : payload || "Falha ao validar Uazapi",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (err) {
          return new Response(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Erro ao validar Uazapi" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (channel === "telegram") {
        const telegramBotToken = body.telegram_bot_token || configMap["telegram_bot_token"];
        const telegramChatId = body.telegram_chat_id || configMap["telegram_chat_id"];

        if (!telegramBotToken || !telegramChatId) {
          return new Response(JSON.stringify({ ok: false, error: "Telegram não configurado completamente" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          phase = "verify_telegram_request";
          const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: "Teste de conexão do BJJ CT Manager",
            }),
          });
          const payload = await res.json();

          return new Response(
            JSON.stringify({
              ok: Boolean(res.ok && payload.ok),
              error: res.ok && payload.ok ? null : payload.description || "Falha ao validar Telegram",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (err) {
          return new Response(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Erro ao validar Telegram" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(JSON.stringify({ ok: false, error: "Canal inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const titulo = body.titulo?.trim();
    const conteudo = body.conteudo || "";
    const conteudoTexto = body.conteudo_texto || "";
    const rawEmailBodyHtml = body.email_body_html || conteudo || "";
    const emailBodyHtml = stripEmailPreviewChrome(rawEmailBodyHtml);
    const providedEmailHtml = body.email_html?.trim() || "";
    const emailHtml = providedEmailHtml || (emailBodyHtml ? buildEmailDeliveryHtml(titulo || "Mensagem", emailBodyHtml) : conteudo);
    const telegramText = body.telegram_text || buildTelegramHtmlMessage(titulo || "Mensagem", conteudoTexto);
    const whatsappText = body.whatsapp_text || buildWhatsappTextMessage(titulo || "Mensagem", conteudoTexto);
    const channels = body.channels || [];
    const recipients = body.recipients || [];
    const emailTextMessage = buildChannelTextMessage(titulo || "Mensagem", conteudoTexto);

    if (!titulo || !conteudo || !channels.length || !recipients.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { channel: string; success: number; failed: number; errors: string[] }[] = [];
    const logEntries: Array<{
      aluno_id: string | null;
      aluno_nome: string | null;
      assunto: string;
      canal: string;
      email_destinatario: string | null;
      enviado_por: string;
      erro: string | null;
      mensagem: string;
      status: string;
    }> = [];

    if (channels.includes("email")) {
      const gmailEmail = configMap["gmail_email"];
      const gmailAppPassword = configMap["gmail_app_password"];
      const gmailFromName = configMap["gmail_from_name"] || "Sistema BJJ";
      const gmailFormat = configMap["gmail_format"] || "html";
      if (!gmailEmail || !gmailAppPassword) {
        results.push({ channel: "email", success: 0, failed: recipients.length, errors: ["Credenciais do Gmail não configuradas"] });
      } else {
        let success = 0;
        let failed = 0;
        const errors: string[] = [];
        const emailRecipients = recipients.filter((r) => r.email);

        let client: SMTPClient | null = null;
        client = new SMTPClient({
          connection: {
            hostname: "smtp.gmail.com",
            port: 465,
            tls: true,
            auth: {
              username: gmailEmail,
              password: gmailAppPassword,
            },
          },
        });

        for (const recipient of emailRecipients) {
          try {
            const emailContent = emailTextMessage;
            const htmlContent = emailHtml;

            const emailOptions: Record<string, string> & { html?: string; content?: string } = {
              from: `${gmailFromName} <${gmailEmail}>`,
              to: recipient.email!,
              subject: titulo,
            };

            if (gmailFormat === "html") {
              emailOptions.html = htmlContent;
              emailOptions.content = emailContent;
            } else {
              emailOptions.content = emailContent;
            }

            await client.send(emailOptions);
            success++;
            logEntries.push({
              aluno_id: recipient.user_id || null,
              aluno_nome: `${recipient.nome} ${recipient.sobrenome || ""}`.trim(),
              assunto: titulo,
              canal: "email",
              email_destinatario: recipient.email || null,
              enviado_por: userId,
              erro: null,
              mensagem: emailTextMessage,
              status: "enviado",
            });
          } catch (err) {
            failed++;
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            errors.push(`${recipient.nome}: ${errorMessage}`);
            logEntries.push({
              aluno_id: recipient.user_id || null,
              aluno_nome: `${recipient.nome} ${recipient.sobrenome || ""}`.trim(),
              assunto: titulo,
              canal: "email",
              email_destinatario: recipient.email || null,
              enviado_por: userId,
              erro: errorMessage,
              mensagem: emailTextMessage,
              status: "falha",
            });
          }
        }

        try {
          if (client && typeof client.close === "function") {
            await client.close();
          }
        } catch {
          // ignore
        }

        const noEmail = recipients.length - emailRecipients.length;
        if (noEmail > 0) {
          failed += noEmail;
          errors.push(`${noEmail} aluno(s) sem e-mail cadastrado`);
        }
        results.push({ channel: "email", success, failed, errors });
      }
    }

    if (channels.includes("whatsapp")) {
      const whatsappMode = (configMap["whatsapp_send_mode"] as "wa_me" | "uazapi" | undefined) || "wa_me";
      const uazapiBaseUrl = configMap["uazapi_base_url"];
      const uazapiInstanceName = configMap["uazapi_instance_name"];
      const uazapiInstanceApikey = configMap["uazapi_instance_apikey"];

      if (whatsappMode === "wa_me") {
        results.push({
          channel: "whatsapp",
          success: 0,
          failed: recipients.length,
          errors: ["Modo wa.me deve ser disparado pelo painel do usuario, nao pela edge function"],
        });
      } else if (!uazapiBaseUrl || !uazapiInstanceName || !uazapiInstanceApikey) {
        results.push({ channel: "whatsapp", success: 0, failed: recipients.length, errors: ["Uazapi nao configurada completamente"] });
      } else {
        let success = 0;
        let failed = 0;
        const errors: string[] = [];
        const whatsappRecipients = recipients.filter((r) => r.telefone);

        for (const recipient of whatsappRecipients) {
          try {
            let phone = (recipient.telefone || "").replace(/\D/g, "");
            if (phone.startsWith("0")) phone = `55${phone.substring(1)}`;
            if (!phone.startsWith("55")) phone = `55${phone}`;

            const normalizedBaseUrl = normalizeUazapiBaseUrl(uazapiBaseUrl);
            const res = await fetch(`${normalizedBaseUrl}/message/sendText/${uazapiInstanceName}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: uazapiInstanceApikey,
              },
              body: JSON.stringify({
                number: phone,
                textMessage: {
                  text: whatsappText,
                },
                options: {
                  delay: 200,
                },
              }),
            });

            const resBody = await res.text();
            if (res.ok) {
              success++;
            } else {
              failed++;
              errors.push(`${recipient.nome}: ${resBody}`);
            }

            logEntries.push({
              aluno_id: recipient.user_id || null,
              aluno_nome: `${recipient.nome} ${recipient.sobrenome || ""}`.trim(),
              assunto: titulo,
              canal: "whatsapp",
              email_destinatario: recipient.email || null,
              enviado_por: userId,
              erro: res.ok ? null : resBody,
              mensagem: whatsappText,
              status: res.ok ? "enviado" : "falha",
            });
          } catch (err) {
            failed++;
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            errors.push(`${recipient.nome}: ${errorMessage}`);
            logEntries.push({
              aluno_id: recipient.user_id || null,
              aluno_nome: `${recipient.nome} ${recipient.sobrenome || ""}`.trim(),
              assunto: titulo,
              canal: "whatsapp",
              email_destinatario: recipient.email || null,
              enviado_por: userId,
              erro: errorMessage,
              mensagem: whatsappText,
              status: "falha",
            });
          }
        }

        const noPhone = recipients.length - whatsappRecipients.length;
        if (noPhone > 0) {
          failed += noPhone;
          errors.push(`${noPhone} aluno(s) sem telefone cadastrado`);
        }
        results.push({ channel: "whatsapp", success, failed, errors });
      }
    }

    if (channels.includes("telegram")) {
      const telegramBotToken = configMap["telegram_bot_token"];
      const telegramChatId = configMap["telegram_chat_id"];

      if (!telegramBotToken || !telegramChatId) {
        results.push({ channel: "telegram", success: 0, failed: recipients.length, errors: ["Telegram não configurado completamente"] });
      } else {
        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        try {
          const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: telegramText,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
          });

          const resBody = await res.json();
          if (res.ok && resBody.ok) {
            success = recipients.length;
          } else {
            failed = recipients.length;
            errors.push(`Erro na API do Telegram: ${resBody.description || "Unknown error"}`);
          }
        } catch (err) {
          failed = recipients.length;
          errors.push(`Erro ao enviar mensagem: ${err instanceof Error ? err.message : "Unknown error"}`);
        }

        results.push({ channel: "telegram", success, failed, errors });

        for (const recipient of recipients) {
          logEntries.push({
            aluno_id: recipient.user_id || null,
            aluno_nome: `${recipient.nome} ${recipient.sobrenome || ""}`.trim(),
            assunto: titulo,
            canal: "telegram",
            email_destinatario: recipient.email || null,
            enviado_por: userId,
            erro: errors[0] || null,
            mensagem: telegramText,
            status: failed > 0 ? "falha" : "enviado",
          });
        }
      }
    }

    if (logEntries.length > 0) {
      const { error: logError } = await adminClient.from("mensagens_enviadas").insert(logEntries);
      if (logError) {
        console.error("Error logging sent messages:", logError);
      }
    }

    return new Response(JSON.stringify({ results, request_id: requestId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const context: DiagnosticContext = {
      requestId,
      phase,
      userId,
      ctId: targetCtId,
      role: highestRole,
      details: diagnosticDetails,
    };
    await persistDiagnostic(adminClient, "send-message", context, err);
    console.error("Error in send-message:", err);
    return buildErrorResponse(safeErrorMessage(err), 500, context);
  }
});
