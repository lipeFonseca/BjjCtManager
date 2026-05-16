-- Drop restrictive INSERT policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Mestre can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "MestreLider can insert profiles" ON public.profiles;
-- Recreate as PERMISSIVE (any one matching = allowed)
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Mestre can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'mestre'::app_role));
CREATE POLICY "MestreLider can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'mestre_lider'::app_role));
-- Also fix the ALL policy to be permissive
DROP POLICY IF EXISTS "Admins full access profiles" ON public.profiles;
CREATE POLICY "Admins full access profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Fix user_roles INSERT for admin
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Fix centros_treinamento to be permissive
DROP POLICY IF EXISTS "Admins full access CT" ON public.centros_treinamento;
CREATE POLICY "Admins full access CT" ON public.centros_treinamento
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Fix SELECT policies to be permissive
DROP POLICY IF EXISTS "Users can read own CT" ON public.centros_treinamento;
CREATE POLICY "Users can read own CT" ON public.centros_treinamento
  FOR SELECT TO authenticated
  USING ((id IN (SELECT profiles.ct_id FROM profiles WHERE profiles.user_id = auth.uid())) OR (mestre_lider_id = auth.uid()));
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Mestre can read own students" ON public.profiles;
CREATE POLICY "Mestre can read own students" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'mestre'::app_role) AND mestre_id = auth.uid());
DROP POLICY IF EXISTS "MestreLider can read CT profiles" ON public.profiles;
CREATE POLICY "MestreLider can read CT profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'mestre_lider'::app_role) AND ct_id IN (SELECT profiles.ct_id FROM profiles WHERE profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "MestreLider can update CT profiles" ON public.profiles;
CREATE POLICY "MestreLider can update CT profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'mestre_lider'::app_role) AND ct_id IN (SELECT profiles.ct_id FROM profiles WHERE profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
