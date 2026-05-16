-- Fix ALL RLS policies: change from RESTRICTIVE to PERMISSIVE

-- ===== user_roles =====
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- ===== profiles =====
DROP POLICY IF EXISTS "Admins full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Mestre can read own students" ON public.profiles;
DROP POLICY IF EXISTS "MestreLider can read CT profiles" ON public.profiles;
DROP POLICY IF EXISTS "MestreLider can update CT profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Mestre can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "MestreLider can insert profiles" ON public.profiles;
CREATE POLICY "Admins full access profiles" ON public.profiles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Mestre can read own students" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'mestre'::app_role) AND mestre_id = auth.uid());
CREATE POLICY "MestreLider can read CT profiles" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'mestre_lider'::app_role) AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "MestreLider can update CT profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'mestre_lider'::app_role) AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre_lider'::app_role) AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Mestre can insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND mestre_id = auth.uid());
CREATE POLICY "MestreLider can insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'mestre_lider'::app_role) AND ct_id = get_user_ct(auth.uid()));
-- ===== centros_treinamento =====
DROP POLICY IF EXISTS "Admins full access CT" ON public.centros_treinamento;
DROP POLICY IF EXISTS "Users can read own CT" ON public.centros_treinamento;
CREATE POLICY "Admins full access CT" ON public.centros_treinamento FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own CT" ON public.centros_treinamento FOR SELECT TO authenticated
  USING (id = get_user_ct(auth.uid()) OR mestre_lider_id = auth.uid());
-- ===== chat =====
DROP POLICY IF EXISTS "CT members can read chat" ON public.chat;
DROP POLICY IF EXISTS "CT members can send chat" ON public.chat;
DROP POLICY IF EXISTS "Admins full access chat" ON public.chat;
CREATE POLICY "Admins full access chat" ON public.chat FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CT members can read chat" ON public.chat FOR SELECT TO authenticated
  USING (ct_id = get_user_ct(auth.uid()));
CREATE POLICY "CT members can send chat" ON public.chat FOR INSERT TO authenticated
  WITH CHECK (remetente_id = auth.uid() AND ct_id = get_user_ct(auth.uid()));
-- ===== mensagens =====
DROP POLICY IF EXISTS "Admins full access mensagens" ON public.mensagens;
DROP POLICY IF EXISTS "CT members can read mensagens" ON public.mensagens;
DROP POLICY IF EXISTS "MestreLider can send mensagens" ON public.mensagens;
CREATE POLICY "Admins full access mensagens" ON public.mensagens FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CT members can read mensagens" ON public.mensagens FOR SELECT TO authenticated
  USING (ct_id = get_user_ct(auth.uid()));
CREATE POLICY "MestreLider can send mensagens" ON public.mensagens FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'mestre_lider'::app_role) AND remetente_id = auth.uid() AND ct_id IN (SELECT id FROM centros_treinamento WHERE mestre_lider_id = auth.uid()));
-- ===== presencas =====
DROP POLICY IF EXISTS "Admins full access presencas" ON public.presencas;
DROP POLICY IF EXISTS "Mestre can manage student presencas" ON public.presencas;
DROP POLICY IF EXISTS "MestreLider can manage CT presencas" ON public.presencas;
DROP POLICY IF EXISTS "Users can read own presencas" ON public.presencas;
CREATE POLICY "Admins full access presencas" ON public.presencas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Mestre can manage student presencas" ON public.presencas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre'::app_role) AND aluno_id IN (SELECT user_id FROM profiles WHERE mestre_id = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND aluno_id IN (SELECT user_id FROM profiles WHERE mestre_id = auth.uid()));
CREATE POLICY "MestreLider can manage CT presencas" ON public.presencas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre_lider'::app_role) AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre_lider'::app_role) AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Users can read own presencas" ON public.presencas FOR SELECT TO authenticated
  USING (aluno_id = auth.uid());
-- ===== Add username column to profiles =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;
