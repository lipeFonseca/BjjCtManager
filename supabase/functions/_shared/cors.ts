/**
 * Configuração centralizada de CORS para edge functions
 * Permite controlar acesso por environment sem duplicar código
 */

const ALLOWED_DOMAINS = {
  development: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
  staging: [
    "https://staging.bjjmanager.com",
  ],
  production: [
    "https://app.bjjmanager.com",
    "https://bjjmanager.com",
  ],
};

const ALLOWED_HOST_PATTERNS = {
  development: ["localhost"],
  staging: [],
  production: [],
};

/**
 * Detecta o ambiente baseado em variável de ambiente
 * Default: development se não estiver definido
 */
const getEnvironment = (): keyof typeof ALLOWED_DOMAINS => {
  const env = Deno.env.get("DENO_ENV") || Deno.env.get("NODE_ENV") || "development";
  if (env.includes("prod")) return "production";
  if (env.includes("staging")) return "staging";
  return "development";
};

const getAdditionalAllowedOrigins = () =>
  String(Deno.env.get("ALLOWED_CORS_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

/**
 * Valida e retorna a origem segura para CORS
 * Se a origem não está na whitelist, retorna undefined (bloqueia)
 */
export const getOriginForCors = (requestHeaders: Headers): string | undefined => {
  const origin = requestHeaders.get("origin");
  if (!origin) return undefined;

  const env = getEnvironment();
  const allowedDomains = [...ALLOWED_DOMAINS[env], ...getAdditionalAllowedOrigins()];
  const allowedHostPatterns = ALLOWED_HOST_PATTERNS[env];

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return undefined;
  }

  const isAllowed = allowedDomains.some((domain) =>
    origin === domain
  ) || allowedHostPatterns.some((pattern) => {
    const hostname = parsedOrigin.hostname.toLowerCase();
    return pattern.startsWith(".")
      ? hostname.endsWith(pattern)
      : hostname === pattern;
  });

  const isDevelopmentOrigin =
    env === "development" &&
    (parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1");

  if (isAllowed || isDevelopmentOrigin) {
    return origin;
  }

  return undefined;
};

/**
 * Constrói headers CORS seguros baseado na origem da requisição
 * Bloqueia se a origem não está autorizada
 */
export const buildCorsHeaders = (requestHeaders: Headers): Record<string, string> => {
  const allowedOrigin = getOriginForCors(requestHeaders);

  const baseHeaders = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "3600",
  };

  if (allowedOrigin) {
    return {
      ...baseHeaders,
      "Access-Control-Allow-Origin": allowedOrigin,
      "Vary": "Origin",
    };
  }

  // Se origem não autorizada, retorna headers sem Allow-Origin (bloqueia por CORS)
  return {
    ...baseHeaders,
    "Vary": "Origin",
  };
};

/**
 * Headers padrão para respostas OPTIONS (preflight CORS)
 * Uso: return new Response(null, { headers: getOptionsHeaders(req.headers) });
 */
export const getOptionsHeaders = (requestHeaders: Headers): Record<string, string> => {
  return buildCorsHeaders(requestHeaders);
};

/**
 * Headers padrão para respostas de conteúdo
 * Uso: return new Response(JSON.stringify(data), { headers: { ...getContentHeaders(req.headers) } });
 */
export const getContentHeaders = (
  requestHeaders: Headers,
  contentType: string = "application/json"
): Record<string, string> => {
  return {
    ...buildCorsHeaders(requestHeaders),
    "Content-Type": contentType,
  };
};

/**
 * Verifica se a requisição vem de origem autorizada
 * Útil para validações adicionais
 */
export const isOriginAllowed = (requestHeaders: Headers): boolean => {
  return getOriginForCors(requestHeaders) !== undefined;
};
