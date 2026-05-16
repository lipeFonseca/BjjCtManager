const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const ALLOWED_ATTRS = new Set([
  "alt",
  "aria-label",
  "aria-hidden",
  "class",
  "colspan",
  "data-alignment",
  "data-bjj-attachments",
  "data-bjj-auto-notice",
  "data-bjj-comunicado-preview",
  "data-bjj-confidential",
  "data-bjj-editorial-card",
  "data-bjj-email-preview",
  "data-bjj-email-preview-content",
  "data-bjj-signature",
  "data-bjj-urgency",
  "data-size-mode",
  "data-width-percent",
  "href",
  "rel",
  "rowspan",
  "src",
  "style",
  "target",
  "title",
]);

const SAFE_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];
const SAFE_DATA_PREFIXES = ["data:image/"];

const sanitizeStyleValue = (value: string) =>
  value
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/behavior\s*:[^;]+;?/gi, "")
    .replace(/url\s*\(\s*(['"]?)javascript:[^)]*\1\s*\)/gi, "")
    .replace(/url\s*\(\s*(['"]?)data:text\/html[^)]*\1\s*\)/gi, "")
    .trim();

export const sanitizeUrlForHtml = (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  if (normalized.startsWith("#") || normalized.startsWith("/")) {
    return normalized;
  }

  const lowered = normalized.toLowerCase();
  if (SAFE_DATA_PREFIXES.some((prefix) => lowered.startsWith(prefix))) {
    return normalized;
  }

  try {
    const url = new URL(normalized, window.location.origin);
    if (!SAFE_PROTOCOLS.includes(url.protocol)) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
};

const sanitizeElementNode = (element: HTMLElement) => {
  const tagName = element.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tagName)) {
    element.replaceWith(...Array.from(element.childNodes));
    return;
  }

  for (const attr of Array.from(element.attributes)) {
    const attrName = attr.name.toLowerCase();
    const attrValue = attr.value;

    if (attrName.startsWith("on")) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (!ALLOWED_ATTRS.has(attrName) && !attrName.startsWith("data-")) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (attrName === "href" || attrName === "src") {
      const safeUrl = sanitizeUrlForHtml(attrValue);
      if (!safeUrl) {
        element.removeAttribute(attr.name);
      } else {
        element.setAttribute(attr.name, safeUrl);
      }
      continue;
    }

    if (attrName === "style") {
      const sanitizedStyle = sanitizeStyleValue(attrValue);
      if (sanitizedStyle) {
        element.setAttribute("style", sanitizedStyle);
      } else {
        element.removeAttribute("style");
      }
      continue;
    }

    if (attrName === "target") {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  }

  if (tagName === "a" && element.hasAttribute("href")) {
    if (!element.hasAttribute("target")) {
      element.setAttribute("target", "_blank");
    }
    element.setAttribute("rel", "noopener noreferrer");
  }
};

const sanitizeTree = (root: ParentNode) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const nodes: HTMLElement[] = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as HTMLElement);
  }

  nodes.forEach(sanitizeElementNode);
};

export const sanitizeHtmlFragment = (html: string) => {
  if (!html || typeof window === "undefined") {
    return html || "";
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  sanitizeTree(template.content);
  return template.innerHTML;
};

export const sanitizeHtmlDocument = (html: string) => {
  if (!html) return "";

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const safeBody = sanitizeHtmlFragment(bodyMatch?.[1] || html);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8" /></head><body style="margin:0; background:#ffffff;">${safeBody}</body></html>`;
};
