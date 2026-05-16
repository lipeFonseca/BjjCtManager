-- Drop the restrictive read policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can read layout config" ON public.layout_config;
CREATE POLICY "Anyone can read layout config"
ON public.layout_config
FOR SELECT
TO public
USING (true);
