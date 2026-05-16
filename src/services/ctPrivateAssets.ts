import { supabase } from "@/integrations/supabase/client";
import { getFunctionsErrorMessage } from "@/services/functions";

const CT_PRIVATE_BUCKET = "ct-private-assets";
const ABSOLUTE_URL_PATTERN = /^(https?:)?\/\//i;
const DATA_URL_PATTERN = /^data:/i;

type CachedAsset = {
  url: string;
  expiresAt: number;
};

const assetCache = new Map<string, CachedAsset>();

export const isAbsoluteAssetUrl = (value: string | null | undefined) => {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && (ABSOLUTE_URL_PATTERN.test(normalized) || DATA_URL_PATTERN.test(normalized));
};

export const normalizeCtPrivateAssetRef = (value: string | null | undefined) => {
  return String(value || "").trim().replace(/^\/+/, "");
};

export const isCtPrivateAssetRef = (value: string | null | undefined) => {
  const normalized = normalizeCtPrivateAssetRef(value);
  return Boolean(normalized) && !isAbsoluteAssetUrl(normalized);
};

export const buildCtPrivateAssetPath = (ctId: string, kind: "logo" | "banner", fileName: string) => {
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "-");
  return `${ctId}/${kind}/${Date.now()}-${safeName}`;
};

export const removeCtPrivateAsset = async (assetRef: string | null | undefined) => {
  const normalized = normalizeCtPrivateAssetRef(assetRef);
  if (!isCtPrivateAssetRef(normalized)) return;
  await supabase.storage.from(CT_PRIVATE_BUCKET).remove([normalized]);
};

export const resolveCtPrivateAssetUrls = async (assetRefs: Array<string | null | undefined>, expiresIn = 3600) => {
  const refs = Array.from(
    new Set(
      assetRefs
        .map((value) => normalizeCtPrivateAssetRef(value))
        .filter(Boolean),
    ),
  );

  const result: Record<string, string> = {};
  const pathsToFetch: string[] = [];
  const now = Date.now();

  refs.forEach((ref) => {
    if (isAbsoluteAssetUrl(ref)) {
      result[ref] = ref;
      return;
    }

    const cached = assetCache.get(ref);
    if (cached && cached.expiresAt > now + 30_000) {
      result[ref] = cached.url;
      return;
    }

    pathsToFetch.push(ref);
  });

  if (pathsToFetch.length === 0) {
    return result;
  }

  const { data, error } = await supabase.functions.invoke("ct-private-asset-url", {
    body: {
      paths: pathsToFetch,
      expires_in: expiresIn,
    },
  });

  if (error) {
    throw new Error(await getFunctionsErrorMessage(error, "Falha ao resolver os assets privados do CT."));
  }

  const urls = (data?.urls || {}) as Record<string, string>;

  Object.entries(urls).forEach(([ref, url]) => {
    result[ref] = url;
    assetCache.set(ref, {
      url,
      expiresAt: now + Math.max(expiresIn - 60, 60) * 1000,
    });
  });

  return result;
};

export const resolveCtPrivateAssetUrl = async (assetRef: string | null | undefined, expiresIn = 3600) => {
  const normalized = normalizeCtPrivateAssetRef(assetRef);
  if (!normalized) return "";
  if (isAbsoluteAssetUrl(normalized)) return normalized;

  const urls = await resolveCtPrivateAssetUrls([normalized], expiresIn);
  return urls[normalized] || "";
};
