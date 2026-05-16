-- Keep the case-insensitive unique index for usernames and remove the
-- redundant column-level UNIQUE constraint.

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_username_key;
