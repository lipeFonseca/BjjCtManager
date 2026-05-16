-- Fix username uniqueness to be per-CT, not global
-- Remove any existing global username constraint/index
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS public.profiles_username_unique_idx;
-- Create a CT-scoped unique index for usernames
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
ON public.profiles (lower(username), ct_id);
-- Ensure RLS remains enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Note: The backend validation already filters by ct_id:
-- .eq("username", normalizedUsername).eq("ct_id", effectiveCtId)
-- The database now enforces the same CT isolation rule at storage layer.;
