export const normalizeUsername = (username: unknown) =>
  String(username || "").trim().toLowerCase();

export const buildSyntheticLoginEmail = (
  username: string,
  ctId?: string | null,
) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return "";
  }

  if (!ctId) {
    return `${normalizedUsername}@bjjmanager.local`;
  }

  return `${normalizedUsername}+${ctId}@bjjmanager.local`;
};

export const buildTemporarySyntheticLoginEmail = (
  username: string,
  token: string,
) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return "";
  }

  return `${normalizedUsername}+pending-${token}@bjjmanager.local`;
};

export const buildLegacySyntheticLoginEmail = (username: string) =>
  buildSyntheticLoginEmail(username);