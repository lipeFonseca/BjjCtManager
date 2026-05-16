import { useEffect, useState } from "react";
import { resolveCtPrivateAssetUrls } from "@/services/ctPrivateAssets";

export const useResolvedCtAssetUrls = (assetRefs: Array<string | null | undefined>, enabled = true) => {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enabled) {
      setUrls({});
      return;
    }

    const normalizedRefs = assetRefs.map((value) => String(value || "").trim()).filter(Boolean);
    if (normalizedRefs.length === 0) {
      setUrls({});
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const resolved = await resolveCtPrivateAssetUrls(normalizedRefs);
        if (!cancelled) {
          setUrls(resolved);
        }
      } catch {
        if (!cancelled) {
          setUrls((previous) => ({ ...previous }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, JSON.stringify(assetRefs)]);

  return urls;
};
