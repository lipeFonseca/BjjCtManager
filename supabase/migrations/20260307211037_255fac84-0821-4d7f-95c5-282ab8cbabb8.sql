-- Backfill usernames for legacy profiles without username
UPDATE public.profiles
SET username = 'user_' || substr(replace(user_id::text, '-', ''), 1, 8)
WHERE username IS NULL OR btrim(username) = '';
-- Normalize usernames to lowercase without surrounding spaces
UPDATE public.profiles
SET username = lower(btrim(username))
WHERE username IS NOT NULL;
-- Enforce username as required credential
ALTER TABLE public.profiles
ALTER COLUMN username SET NOT NULL;
-- Ensure username uniqueness (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
ON public.profiles (lower(username));
