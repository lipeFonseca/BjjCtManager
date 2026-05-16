import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

/**
 * Enviar credenciais de novo usuário (mestre) após pagamento confirmado
 */
export const sendMasterCredentialsEmail = async (
  masterEmail: string,
  masterName: string,
  masterUsername: string,
  masterPassword: string,
  ctName: string,
  loginUrl: string = "https://bjjmanager.com/login"
) => {
  try {
    console.log(`[notifications] Enviando credenciais do novo mestre ${masterUsername} para ${masterEmail}`);

    // Corpo do email em HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; }
            .header { background-color: #1a1a1a; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .credentials { background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .credential-item { margin: 10px 0; }
            .label { font-weight: bold; color: #333; }
            .value { color: #666; font-family: monospace; font-size: 14px; }
            .button { display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; margin-top: 20px; }
            .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Bem-vindo ao BjjManager! 🥋</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${masterName}</strong>,</p>
              <p>Seu pagamento foi confirmado com sucesso! Sua conta no BjjManager está pronta para uso.</p>
              
              <p><strong>Centro de Treinamento:</strong> ${ctName}</p>
              
              <div class="credentials">
                <p style="margin-top: 0; color: #333;"><strong>Suas Credenciais de Acesso:</strong></p>
                
                <div class="credential-item">
                  <span class="label">👤 Usuário:</span><br>
                  <span class="value">${masterUsername}</span>
                </div>
                
                <div class="credential-item">
                  <span class="label">🔒 Senha:</span><br>
                  <span class="value">${masterPassword}</span>
                </div>
              </div>
              
              <p><strong>⚠️ Importante:</strong></p>
              <ul>
                <li>Guarde suas credenciais em local seguro</li>
                <li>Altere sua senha assim que efetuar o primeiro acesso</li>
                <li>Nunca compartilhe suas credenciais com outros usuários</li>
              </ul>
              
              <p>Para acessar sua conta:</p>
              <a href="${loginUrl}" class="button">Acessar BjjManager</a>
              
              <p style="margin-top: 30px;">Qualquer dúvida, entre em contato com nosso suporte.</p>
            </div>
            <div class="footer">
              <p>© 2026 BjjManager. Todos os direitos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enviar via send-message function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "send",
        channel: "email",
        titulo: "Bem-vindo ao BjjManager! 🥋",
        email_html: emailHtml,
        recipients: [
          {
            nome: masterName,
            email: masterEmail,
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[notifications] Erro ao enviar email: ${response.status} - ${errorText}`);
      return false;
    }

    console.log(`[notifications] Email de credenciais enviado com sucesso para ${masterEmail}`);
    return true;
  } catch (error) {
    console.error("[notifications] Erro ao enviar email de credenciais:", error);
    return false;
  }
};

/**
 * Notificar administradores sobre novo contratenista criado
 */
export const notifyAdminsNewCt = async (
  supabase: ReturnType<typeof createClient>,
  masterName: string,
  ctName: string,
  masterUsername: string,
  userName: string,
  planName: string,
  ctId: string,
  expiresAt: string
) => {
  try {
    console.log(`[notifications] Notificando admins sobre novo CT: ${ctName}`);

    // Buscar todos os admins do sistema
    const { data: adminRoles, error: adminRolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRolesError || !adminRoles || adminRoles.length === 0) {
      console.warn("[notifications] Nenhum admin encontrado no sistema");
      return false;
    }

    // Buscar emails dos admins
    const adminEmails: Array<{ email: string; nome: string }> = [];
    
    for (const adminRole of adminRoles) {
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("email, nome")
        .eq("user_id", adminRole.user_id)
        .maybeSingle();

      if (adminProfile?.email) {
        adminEmails.push({
          email: adminProfile.email,
          nome: adminProfile.nome || "Admin",
        });
      }
    }

    if (adminEmails.length === 0) {
      console.warn("[notifications] Nenhum email de admin encontrado");
      return false;
    }

    // Montar notificação
    const expirationDate = new Date(expiresAt).toLocaleDateString("pt-BR");
    const notificationHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; }
            .header { background-color: #2196F3; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .info { background-color: #e3f2fd; border: 1px solid #2196F3; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .info-item { margin: 8px 0; }
            .label { font-weight: bold; color: #333; }
            .value { color: #666; }
            .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Novo Centro de Treinamento Criado</h1>
            </div>
            <div class="content">
              <p>Uma nova assinatura foi confirmada e o centro foi ativado:</p>
              
              <div class="info">
                <div class="info-item">
                  <span class="label">🏢 Centro de Treinamento:</span>
                  <span class="value">${ctName}</span>
                </div>
                
                <div class="info-item">
                  <span class="label">👨‍🏫 Mestre Responsável:</span>
                  <span class="value">${masterName}</span>
                </div>
                
                <div class="info-item">
                  <span class="label">👤 Usuário de Login:</span>
                  <span class="value">${masterUsername}</span>
                </div>
                
                <div class="info-item">
                  <span class="label">📋 Plano Contratado:</span>
                  <span class="value">${planName}</span>
                </div>
                
                <div class="info-item">
                  <span class="label">📅 Válido Até:</span>
                  <span class="value">${expirationDate}</span>
                </div>
                
                <div class="info-item">
                  <span class="label">🆔 ID do Centro:</span>
                  <span class="value">${ctId}</span>
                </div>
              </div>
              
              <p>O mestre recebeu um email com suas credenciais de acesso e pode conectar agora.</p>
            </div>
            <div class="footer">
              <p>© 2026 BjjManager. Todos os direitos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enviar notificação para cada admin
    const results: boolean[] = [];
    for (const admin of adminEmails) {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: "send",
            channel: "email",
            titulo: `✅ Novo CT: ${ctName}`,
            email_html: notificationHtml,
            recipients: [
              {
                nome: admin.nome,
                email: admin.email,
              }
            ],
          }),
        });

        if (response.ok) {
          console.log(`[notifications] Notificação enviada para admin ${admin.email}`);
          results.push(true);
        } else {
          console.warn(`[notifications] Erro ao enviar notificação para admin ${admin.email}`);
          results.push(false);
        }
      } catch (error) {
        console.error(`[notifications] Erro ao notificar admin ${admin.email}:`, error);
        results.push(false);
      }
    }

    const successCount = results.filter(r => r).length;
    console.log(`[notifications] Notificações de novo CT enviadas: ${successCount}/${results.length}`);
    
    return successCount > 0;
  } catch (error) {
    console.error("[notifications] Erro ao notificar admins:", error);
    return false;
  }
};
