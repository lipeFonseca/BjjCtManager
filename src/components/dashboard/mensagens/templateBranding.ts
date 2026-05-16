import { sanitizeHtmlFragment } from "@/lib/htmlSecurity";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeBodyHtml = (bodyHtml: string) => sanitizeHtmlFragment(bodyHtml?.trim() || "");

const normalizePlainText = (plainText: string) =>
  plainText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

const preserveTextLineBreaks = (value: string) => escapeHtml(value).replace(/\n/g, "<br />");

const sanitizeRichBodyImages = (bodyHtml: string, maxWidth: number) =>
  bodyHtml
    .replace(/<img\b([^>]*?)style="([^"]*)"([^>]*?)>/gi, (_match, before, style, after) => {
      const mergedStyle = `${style}; max-width:min(100%, ${maxWidth}px); height:auto; box-sizing:border-box;`;
      return `<img${before}style="${mergedStyle}"${after}>`;
    })
    .replace(
      /<img\b((?:(?!style=)[^>])*)>/gi,
      `<img$1 style="max-width:min(100%, ${maxWidth}px); height:auto; box-sizing:border-box;">`
    );

const normalizePreviewBodyHtml = (bodyHtml: string, maxWidth: number, textColor: string, align: "left" | "center") =>
  sanitizeRichBodyImages(bodyHtml, maxWidth)
    .replace(
      /<p\b([^>]*)style="([^"]*)"([^>]*)>/gi,
      (_match, before, style, after) =>
        `<p${before}style="${style}; margin:0 0 12px; line-height:1.6; color:${textColor}; text-align:${align};"${after}>`,
    )
    .replace(
      /<p\b((?:(?!style=)[^>])*)>/gi,
      `<p$1 style="margin:0 0 12px; line-height:1.6; color:${textColor}; text-align:${align};">`,
    )
    .replace(
      /<h1\b([^>]*)style="([^"]*)"([^>]*)>/gi,
      (_match, before, style, after) =>
        `<h1${before}style="${style}; margin:0 0 14px; line-height:1.25; text-align:${align};"${after}>`,
    )
    .replace(
      /<h1\b((?:(?!style=)[^>])*)>/gi,
      `<h1$1 style="margin:0 0 14px; line-height:1.25; text-align:${align};">`,
    )
    .replace(
      /<h2\b([^>]*)style="([^"]*)"([^>]*)>/gi,
      (_match, before, style, after) =>
        `<h2${before}style="${style}; margin:0 0 12px; line-height:1.3; text-align:${align};"${after}>`,
    )
    .replace(
      /<h2\b((?:(?!style=)[^>])*)>/gi,
      `<h2$1 style="margin:0 0 12px; line-height:1.3; text-align:${align};">`,
    )
    .replace(
      /<ul\b([^>]*)style="([^"]*)"([^>]*)>/gi,
      (_match, before, style, after) =>
        `<ul${before}style="${style}; margin:0 0 12px; line-height:1.6; color:${textColor}; text-align:${align}; padding-left:22px;"${after}>`,
    )
    .replace(
      /<ul\b((?:(?!style=)[^>])*)>/gi,
      `<ul$1 style="margin:0 0 12px; line-height:1.6; color:${textColor}; text-align:${align}; padding-left:22px;">`,
    )
    .replace(
      /<ol\b([^>]*)style="([^"]*)"([^>]*?)>/gi,
      (_match, before, style, after) =>
        `<ol${before}style="${style}; margin:0 0 12px; line-height:1.6; color:${textColor}; text-align:${align}; padding-left:22px;"${after}>`,
    )
    .replace(
      /<ol\b((?:(?!style=)[^>])*)>/gi,
      `<ol$1 style="margin:0 0 12px; line-height:1.6; color:${textColor}; text-align:${align}; padding-left:22px;">`,
    )
    .replace(
      /<blockquote\b([^>]*)style="([^"]*)"([^>]*)>/gi,
      (_match, before, style, after) =>
        `<blockquote${before}style="${style}; margin:0 0 12px; line-height:1.6; color:${textColor}; text-align:${align};"${after}>`,
    )
    .replace(
      /<blockquote\b((?:(?!style=)[^>])*)>/gi,
      `<blockquote$1 style="margin:0 0 12px; line-height:1.6; color:${textColor}; text-align:${align};">`,
    );

const normalizeAutoNoticePreviewHtml = (bodyHtml: string, variant: "light" | "dark") => {
  if (!bodyHtml) return "";

  if (variant === "dark") {
    return bodyHtml
      .replace(
        /style="([^"]*)"/i,
        'style="display:inline-block; margin:0 0 14px; padding:8px 12px; border:1px solid rgba(255,255,255,0.12); border-radius:999px; background:rgba(255,255,255,0.07); color:#f2ede2; font-size:12px; font-weight:500; line-height:1.4;"',
      )
      .replace(/<p\b([^>]*)>/gi, '<p$1 style="margin:0; color:#f2ede2;">');
  }

  return bodyHtml
    .replace(
      /style="([^"]*)"/i,
      'style="display:inline-block; margin:0 0 16px; padding:8px 12px; border:1px solid #d7dde6; border-radius:999px; background:#f7f8fa; color:#5b6472; font-size:12px; font-weight:500; line-height:1.4;"',
    )
    .replace(/<p\b([^>]*)>/gi, '<p$1 style="margin:0; color:#5b6472;">');
};

const normalizeEmailSendBodyHtml = (bodyHtml: string) =>
  sanitizeRichBodyImages(bodyHtml, 1200)
    .replace(
      /<p\b([^>]*)style="([^"]*)"([^>]*)>/gi,
      (_match, before, style, after) =>
        `<p${before}style="${style}; margin:0 0 16px; line-height:1.7; color:#2f3640; text-align:left;"${after}>`,
    )
    .replace(
      /<p\b((?:(?!style=)[^>])*)>/gi,
      `<p$1 style="margin:0 0 16px; line-height:1.7; color:#2f3640; text-align:left;">`,
    )
    .replace(
      /<h1\b([^>]*)style="([^"]*)"([^>]*)>/gi,
      (_match, before, style, after) =>
        `<h1${before}style="${style}; margin:0 0 16px; line-height:1.2; color:#202124; text-align:left;"${after}>`,
    )
    .replace(
      /<h1\b((?:(?!style=)[^>])*)>/gi,
      `<h1$1 style="margin:0 0 16px; line-height:1.2; color:#202124; text-align:left;">`,
    )
    .replace(
      /<h2\b([^>]*)style="([^"]*)"([^>]*)>/gi,
      (_match, before, style, after) =>
        `<h2${before}style="${style}; margin:0 0 14px; line-height:1.25; color:#202124; text-align:left;"${after}>`,
    )
    .replace(
      /<h2\b((?:(?!style=)[^>])*)>/gi,
      `<h2$1 style="margin:0 0 14px; line-height:1.25; color:#202124; text-align:left;">`,
    )
    .replace(
      /<ul\b([^>]*)style="([^"]*)"([^>]*)>/gi,
      (_match, before, style, after) =>
        `<ul${before}style="${style}; margin:0 0 16px; line-height:1.7; color:#2f3640; text-align:left; padding-left:22px;"${after}>`,
    )
    .replace(
      /<ul\b((?:(?!style=)[^>])*)>/gi,
      `<ul$1 style="margin:0 0 16px; line-height:1.7; color:#2f3640; text-align:left; padding-left:22px;">`,
    )
    .replace(
      /<ol\b([^>]*)style="([^"]*)"([^>]*?)>/gi,
      (_match, before, style, after) =>
        `<ol${before}style="${style}; margin:0 0 16px; line-height:1.7; color:#2f3640; text-align:left; padding-left:22px;"${after}>`,
    )
    .replace(
      /<ol\b((?:(?!style=)[^>])*)>/gi,
      `<ol$1 style="margin:0 0 16px; line-height:1.7; color:#2f3640; text-align:left; padding-left:22px;">`,
    )
    .replace(
      /<blockquote\b([^>]*)style="([^"]*)"([^>]*)>/gi,
      (_match, before, style, after) =>
        `<blockquote${before}style="${style}; margin:0 0 16px; padding-left:16px; border-left:4px solid #d7dee8; line-height:1.7; color:#44515f; text-align:left;"${after}>`,
    )
    .replace(
      /<blockquote\b((?:(?!style=)[^>])*)>/gi,
      `<blockquote$1 style="margin:0 0 16px; padding-left:16px; border-left:4px solid #d7dee8; line-height:1.7; color:#44515f; text-align:left;">`,
    );

const normalizeEmailSendAutoNoticeHtml = (bodyHtml: string) => {
  if (!bodyHtml) return "";

  return bodyHtml
    .replace(
      /style="([^"]*)"/i,
      'style="display:inline-block; margin:0 0 18px; padding:8px 14px; border:1px solid #d7dde6; border-radius:999px; background:#f7f8fa; color:#5b6472; font-size:12px; font-weight:500; line-height:1.4;"',
    )
    .replace(/<p\b([^>]*)>/gi, '<p$1 style="margin:0; color:#5b6472; font-size:12px; line-height:1.4;">');
};

const extractSections = (safeBody: string) => {
  const extract = (pattern: RegExp) => safeBody.match(pattern)?.[0] || "";

  return {
    autoNoticeSection: extract(/<div[^>]*data-bjj-auto-notice="true"[\s\S]*?<\/div>/i),
    urgencySection: extract(/<div[^>]*data-bjj-urgency="true"[\s\S]*?<\/div>/i),
    confidentialSection: extract(/<div[^>]*data-bjj-confidential="true"[\s\S]*?<\/div>/i),
    attachmentsSection: extract(/<div[^>]*data-bjj-attachments="true"[\s\S]*?<\/div>/i),
    signatureSection: extract(/<div[^>]*data-bjj-signature="true"[\s\S]*?<\/div>/i),
    mainBody: safeBody
      .replace(/<div[^>]*data-bjj-auto-notice="true"[\s\S]*?<\/div>/gi, "")
      .replace(/<div[^>]*data-bjj-urgency="true"[\s\S]*?<\/div>/gi, "")
      .replace(/<div[^>]*data-bjj-confidential="true"[\s\S]*?<\/div>/gi, "")
      .replace(/<div[^>]*data-bjj-attachments="true"[\s\S]*?<\/div>/gi, "")
      .replace(/<div[^>]*data-bjj-signature="true"[\s\S]*?<\/div>/gi, "")
      .trim(),
  };
};

const formatEmailPreviewTimestamp = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

const formatTelegramPreviewDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
  }).format(date);

const formatTelegramPreviewTime = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const formatWhatsAppPreviewDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

const formatWhatsAppPreviewTime = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const buildEditorialCardHtml = ({
  bodyHtml,
  title,
  badge,
  badgeColor,
  footer,
}: {
  bodyHtml: string;
  title: string;
  badge: string;
  badgeColor: string;
  footer: string;
}) => {
  const safeTitle = escapeHtml(title || "Mensagem");
  const safeBody = normalizeBodyHtml(bodyHtml);
  const { autoNoticeSection, urgencySection, confidentialSection, attachmentsSection, signatureSection, mainBody } = extractSections(safeBody);
  const normalizedMainBody = sanitizeRichBodyImages(mainBody, 680);
  const normalizedAutoNotice = normalizeAutoNoticePreviewHtml(autoNoticeSection, "light");

  return `
  <div data-bjj-editorial-card="true" style="max-width:680px; margin:0 auto; background:#ffffff; border:1px solid #d9d9d9; border-radius:16px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="padding:16px 28px 14px; background:#fafbfc; border-bottom:1px solid #efefef; text-align:center;">
      ${normalizedAutoNotice}
      ${badge ? `<div style="font-size:12px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:${badgeColor}; margin:0 auto; opacity:0.9;">${escapeHtml(badge)}</div>` : ""}
      ${urgencySection}
      <h1 style="margin:${badge ? "4px" : "0"} auto 0; font-size:22px; line-height:1.35; font-weight:700; color:#202124; text-align:center; letter-spacing:-0.3px;">${safeTitle}</h1>
    </div>
    <div style="padding:16px 28px; background:#ffffff; color:#3a3f47; font-size:15px; line-height:1.8; min-height:120px;">
      ${confidentialSection}
      ${normalizedMainBody}
      ${attachmentsSection}
      ${signatureSection}
    </div>
    ${footer ? `<div style="padding:10px 28px; background:#f5f6f7; border-top:1px solid #efefef; font-size:11px; line-height:1.4; color:#70777f; text-align:center;">${escapeHtml(footer)}</div>` : ""}
  </div>`;
};

const renderEditorialShell = ({
  cardHtml,
  title,
  background,
}: {
  cardHtml: string;
  title: string;
  background: string;
}) => {
  const safeTitle = escapeHtml(title || "Mensagem");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    @media (max-width: 640px) {
      [data-bjj-editorial-card="true"] {
        max-width: 100% !important;
        border-radius: 12px !important;
      }
      [data-bjj-editorial-card="true"] > div:first-child {
        padding: 12px 16px 10px !important;
      }
      [data-bjj-editorial-card="true"] > div:first-child h1 {
        font-size: 18px !important;
        margin: 2px auto 0 !important;
      }
      [data-bjj-editorial-card="true"] > div:first-child > div:first-child {
        font-size: 10px !important;
      }
      [data-bjj-editorial-card="true"] > div:nth-child(2) {
        padding: 12px 16px !important;
        font-size: 14px !important;
        min-height: 140px !important;
      }
      [data-bjj-editorial-card="true"] > div:last-child {
        padding: 8px 16px !important;
        font-size: 10px !important;
      }
      [data-bjj-urgency="true"] {
        margin: 4px 0 8px !important;
      }
      [data-bjj-urgency="true"] span {
        width: min(100%, 180px) !important;
        min-height: 32px !important;
        font-size: 13px !important;
        padding: 0 14px !important;
      }
    }
  </style>
</head>
<body style="margin:0; padding:16px 8px; background:${background}; font-family:'Segoe UI', Arial, Helvetica, sans-serif; color:#202124; line-height:1.6;">
  ${cardHtml}
</body>
</html>`;
};

export const extractHtmlBodyContent = (html: string) => {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1]?.trim() || html;
};

export const renderComunicadoPreviewHtml = (bodyHtml: string, title: string) => {
  const cardHtml = buildEditorialCardHtml({
    bodyHtml,
    title,
    badge: "Comunicado",
    badgeColor: "#1967d2",
    footer: "Mensageria do BJJ Manager",
  });

  return `
  <div data-bjj-comunicado-preview="true" style="padding:20px 10px; background:#f5f5f5; border-radius:20px;">
    ${extractHtmlBodyContent(
      renderEditorialShell({
        cardHtml,
        title,
        background: "#f5f5f5",
      })
    )}
  </div>`;
};

export const renderComunicadoEmailHtml = (bodyHtml: string, title: string) =>
  renderEditorialShell({
    cardHtml: buildEditorialCardHtml({
      bodyHtml,
      title,
      badge: "Comunicado",
      badgeColor: "#1967d2",
      footer: "Mensageria do BJJ Manager",
    }),
    title,
    background: "#f5f5f5",
  });

export const renderDirectEmailPreviewHtml = (bodyHtml: string, title: string, previewDate: Date) => {
  const safeTitle = escapeHtml(title || "Mensagem");
  const safeBody = normalizeBodyHtml(bodyHtml);
  const { autoNoticeSection, confidentialSection, attachmentsSection, signatureSection, mainBody } = extractSections(safeBody);
  const normalizedMainBody = normalizePreviewBodyHtml(mainBody, 680, "#3a3f47", "left");
  const normalizedAutoNotice = normalizeAutoNoticePreviewHtml(autoNoticeSection, "light");
  const timestamp = formatEmailPreviewTimestamp(previewDate);

  return `
  <div data-bjj-email-preview="true" style="margin:0 auto; max-width:1120px; border-radius:24px; background:#ffffff; border:1px solid #dfe1e5; overflow:hidden; font-family:'Google Sans', 'Segoe UI', Arial, Helvetica, sans-serif; box-shadow:0 18px 48px rgba(0,0,0,0.12);">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:18px 24px 10px; background:#ffffff;">
      <div style="display:flex; align-items:center; gap:10px; min-width:0;">
        <h1 style="margin:0; font-size:20px; line-height:1.35; font-weight:500; color:#202124; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeTitle}</h1>
        <span style="display:inline-flex; align-items:center; border-radius:8px; background:#f1f3f4; color:#5f6368; padding:4px 8px; font-size:12px; white-space:nowrap;">Caixa de entrada</span>
      </div>
      <div style="display:flex; gap:14px; color:#5f6368; font-size:12px; white-space:nowrap;">
        <span>${timestamp}</span>
        <span>☆</span>
        <span>↩</span>
        <span>⋮</span>
      </div>
    </div>
    <div style="display:flex; align-items:flex-start; gap:14px; padding:10px 24px 18px; background:#ffffff;">
      <div style="flex:none; width:40px; height:40px; border-radius:999px; background:#1a73e8; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:700;">B</div>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:14px;">
          <div style="min-width:0;">
            <div style="font-size:14px; font-weight:700; color:#202124;">BJJ Manager <span style="color:#1a73e8;">✓</span> <span style="font-weight:400; color:#5f6368;">&lt;nao-responder@bjjmanager.com&gt;</span></div>
            <div style="font-size:13px; color:#5f6368;">para mim</div>
          </div>
        </div>
        <div style="background:#f6f8fc; border-radius:0; padding:26px 18px 34px;">
          <div style="max-width:700px; margin:0 auto; background:#ffffff; border:1px solid #dfe1e5; border-radius:12px; box-shadow:0 1px 3px rgba(60,64,67,0.12); overflow:hidden;">
            <div style="padding:24px 28px; border-bottom:1px solid #edf1f6; text-align:center;">
              ${normalizedAutoNotice}
              <h2 style="margin:0; font-size:20px; line-height:1.35; font-weight:700; color:#202124; letter-spacing:-0.2px;">${safeTitle}</h2>
            </div>
            <div data-bjj-email-preview-content="true" style="padding:24px 28px; background:#ffffff; color:#3a3f47; font-size:15px; line-height:1.6; min-height:120px;">
              ${confidentialSection}
              ${normalizedMainBody}
              ${attachmentsSection}
              ${signatureSection}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
};

export const renderDirectEmailHtml = (bodyHtml: string, title: string) => {
  const safeTitle = escapeHtml(title || "Mensagem");
  const safeBody = normalizeBodyHtml(bodyHtml);
  const { autoNoticeSection, confidentialSection, attachmentsSection, signatureSection, mainBody } = extractSections(safeBody);
  const normalizedMainBody = normalizeEmailSendBodyHtml(mainBody);
  const normalizedAutoNotice = normalizeEmailSendAutoNoticeHtml(autoNoticeSection);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    * {
      box-sizing: border-box;
    }
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
    .email-card {
      width: 100%;
      margin: 0 auto;
      background: #ffffff;
      border: 0;
      border-radius: 0;
      overflow: hidden;
    }
    .email-header {
      padding: 28px 40px 14px;
      border-bottom: 1px solid #eef2f6;
      background: #ffffff;
    }
    .email-title {
      margin: 0;
      font-size: 32px;
      line-height: 1.2;
      font-weight: 700;
      color: #202124;
      letter-spacing: -0.03em;
      text-align: left;
    }
    .email-body {
      padding: 28px 40px 34px;
      background: #ffffff;
      color: #2f3640;
      font-size: 18px;
      line-height: 1.65;
    }
    @media (max-width: 640px) {
      .email-card {
        border-radius: 0 !important;
        border-left: 0 !important;
        border-right: 0 !important;
      }
      .email-header {
        padding: 18px 18px 12px !important;
      }
      .email-title {
        font-size: 24px !important;
      }
      .email-body {
        padding: 18px 18px 22px !important;
        font-size: 16px !important;
      }
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%; border-collapse:collapse; background:#ffffff;">
    <tr>
      <td style="padding:0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" bgcolor="#ffffff" style="width:100%; margin:0 auto; border-collapse:separate; background:#ffffff;">
          <tr>
            <td class="email-header" bgcolor="#ffffff" style="padding:28px 40px 14px; border-bottom:1px solid #eef2f6; background:#ffffff;">
              ${normalizedAutoNotice}
              <h1 class="email-title" style="margin:0; font-size:32px; line-height:1.2; font-weight:700; color:#202124; letter-spacing:-0.03em; text-align:left;">${safeTitle}</h1>
            </td>
          </tr>
          <tr>
            <td class="email-body" bgcolor="#ffffff" style="padding:28px 40px 34px; background:#ffffff; color:#2f3640; font-size:18px; line-height:1.65;">
              ${confidentialSection}
              ${normalizedMainBody}
              ${attachmentsSection}
              ${signatureSection}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const renderTelegramPreviewHtml = (bodyHtml: string, title: string, previewDate: Date) => {
  const safeTitle = escapeHtml(title || "Mensagem");
  const safeBody = normalizeBodyHtml(bodyHtml);
  const { autoNoticeSection, mainBody } = extractSections(safeBody);
  const normalizedMainBody = normalizePreviewBodyHtml(mainBody, 620, "#f4eee3", "left");
  const normalizedAutoNotice = normalizeAutoNoticePreviewHtml(autoNoticeSection, "dark");
  const previewDay = formatTelegramPreviewDate(previewDate);
  const previewTime = formatTelegramPreviewTime(previewDate);

  return `
  <div style="margin:0 auto; max-width:420px; border-radius:22px; overflow:hidden; border:1px solid #20232b; font-family:'Segoe UI', Arial, Helvetica, sans-serif; box-shadow:0 22px 50px rgba(0,0,0,0.32);">
    <div style="padding:10px 14px; background:#1f2733; color:#dce3ec; font-size:13px; font-weight:600;">
      ${escapeHtml(previewDay)}
    </div>
    <div style="padding:14px 10px 18px; background:
      radial-gradient(circle at 18% 14%, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1.5px, transparent 1.5px) 0 0 / 28px 28px,
      linear-gradient(180deg, #101318 0%, #12161d 100%);
      min-height:300px;">
      <div style="margin:0 auto 0 0; max-width:320px; border-radius:12px; background:#2b2f36; padding:14px 14px 12px; box-shadow:0 8px 18px rgba(0,0,0,0.22);">
        ${normalizedAutoNotice}
        <div style="font-size:18px; line-height:1.35; font-weight:700; color:#ffffff; margin:0 0 10px; text-align:left;">${safeTitle}</div>
        <div style="font-size:14px; line-height:1.45; color:#f3f5f7; text-align:left;">${normalizedMainBody}</div>
        <div style="margin-top:10px; text-align:right; font-size:11px; color:#9aa3ad;">${escapeHtml(previewTime)}</div>
      </div>
    </div>
  </div>`;
};

export const renderWhatsAppPreviewHtml = (bodyHtml: string, title: string, previewDate: Date) => {
  const safeTitle = escapeHtml(title || "Mensagem");
  const safeBody = normalizeBodyHtml(bodyHtml);
  const { autoNoticeSection, mainBody } = extractSections(safeBody);
  const normalizedMainBody = normalizePreviewBodyHtml(mainBody, 620, "#f5f7f8", "left");
  const normalizedAutoNotice = normalizeAutoNoticePreviewHtml(autoNoticeSection, "dark");
  const previewDay = formatWhatsAppPreviewDate(previewDate);
  const previewTime = formatWhatsAppPreviewTime(previewDate);

  return `
  <div style="margin:0 auto; max-width:430px; border-radius:24px; overflow:hidden; border:1px solid #1b1f24; font-family:'Segoe UI', Arial, Helvetica, sans-serif; box-shadow:0 22px 50px rgba(0,0,0,0.34);">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; background:#111b21; color:#f5f7f8;">
      <div style="display:flex; align-items:center; gap:10px; min-width:0;">
        <div style="width:40px; height:40px; border-radius:999px; background:#25d366; color:#0d1c14; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800;">W</div>
        <div style="min-width:0;">
          <div style="font-size:15px; font-weight:700; color:#f7fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">BJJ Manager</div>
          <div style="font-size:12px; color:#9db0ba;">conta comercial</div>
        </div>
      </div>
      <div style="display:flex; gap:12px; color:#d1d7db; font-size:18px;">
        <span>⌕</span>
        <span>⋮</span>
      </div>
    </div>
    <div style="padding:14px 12px; background:
      radial-gradient(circle at 16% 12%, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1.4px, transparent 1.4px) 0 0 / 28px 28px,
      linear-gradient(180deg, #0b141a 0%, #111b21 100%);
      min-height:420px;">
      <div style="margin:0 auto 12px; width:max-content; max-width:100%; padding:5px 10px; border-radius:999px; background:#182229; color:#d7e0e5; font-size:12px; font-weight:600;">
        ${escapeHtml(previewDay)}
      </div>
      <div style="margin:0 auto 16px; max-width:300px; border-radius:10px; background:#103529; color:#7ee7c0; text-align:center; padding:10px 14px; font-size:12px; line-height:1.45;">
        Esta empresa usa um servico seguro da Meta para gerenciar esta conversa.
      </div>
      <div style="margin:0 auto 0 0; max-width:332px; border-radius:10px; background:#202c33; padding:14px 14px 12px; box-shadow:0 8px 18px rgba(0,0,0,0.22);">
        ${normalizedAutoNotice}
        <div style="font-size:18px; line-height:1.35; font-weight:700; color:#ffffff; margin:0 0 10px; text-align:left;">${safeTitle}</div>
        <div style="font-size:14px; line-height:1.5; color:#f5f7f8; text-align:left;">${normalizedMainBody}</div>
        <div style="margin-top:10px; text-align:right; font-size:11px; color:#9fb0b8;">${escapeHtml(previewTime)}</div>
      </div>
      <div style="margin-top:18px; border-radius:999px; background:#202c33; padding:11px 16px; color:#8696a0; font-size:14px;">
        Digite uma mensagem
      </div>
    </div>
  </div>`;
};

const sanitizeWhatsappTokenText = (value: string) =>
  value.replace(/\*/g, "-").replace(/_/g, "-").replace(/~/g, "-").replace(/`/g, "'");

export const buildTelegramChannelText = (title: string, plainText: string) => {
  const normalizedTitle = escapeHtml((title || "Mensagem").trim());
  const normalizedBody = normalizePlainText(plainText);

  return [
    "<b>BJJ Manager</b>",
    `<b>${normalizedTitle}</b>`,
    escapeHtml(normalizedBody),
    "<i>Enviado pela mensageria do CT</i>",
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const buildWhatsAppChannelText = (title: string, plainText: string) => {
  const normalizedTitle = sanitizeWhatsappTokenText((title || "Mensagem").trim());
  const normalizedBody = sanitizeWhatsappTokenText(normalizePlainText(plainText));

  return ["*BJJ Manager*", `*${normalizedTitle}*`, normalizedBody, "_Enviado pela mensageria do CT_"].filter(Boolean).join("\n\n");
};
