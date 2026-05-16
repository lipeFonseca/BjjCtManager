-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- ========== profiles ==========
DROP POLICY IF EXISTS "Admins full access profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Mestre can read own students" ON profiles;
DROP POLICY IF EXISTS "MestreLider can read CT profiles" ON profiles;
DROP POLICY IF EXISTS "MestreLider can update CT profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Mestre can insert profiles" ON profiles;
DROP POLICY IF EXISTS "MestreLider can insert profiles" ON profiles;
CREATE POLICY "Admins full access profiles" ON profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Mestre can read own students" ON profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'mestre') AND mestre_id = auth.uid());
CREATE POLICY "MestreLider can read CT profiles" ON profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'mestre_lider') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "MestreLider can update CT profiles" ON profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'mestre_lider') AND ct_id = get_user_ct(auth.uid())) WITH CHECK (has_role(auth.uid(), 'mestre_lider') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Mestre can insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'mestre') AND mestre_id = auth.uid());
CREATE POLICY "MestreLider can insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'mestre_lider') AND ct_id = get_user_ct(auth.uid()));
-- ========== user_roles ==========
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;
DROP POLICY IF EXISTS "Users can read own role" ON user_roles;
CREATE POLICY "Admins can manage roles" ON user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own role" ON user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- ========== centros_treinamento ==========
DROP POLICY IF EXISTS "Admins full access CT" ON centros_treinamento;
DROP POLICY IF EXISTS "Users can read own CT" ON centros_treinamento;
CREATE POLICY "Admins full access CT" ON centros_treinamento FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own CT" ON centros_treinamento FOR SELECT TO authenticated USING (id = get_user_ct(auth.uid()) OR mestre_lider_id = auth.uid());
-- ========== chat ==========
DROP POLICY IF EXISTS "Admins full access chat" ON chat;
DROP POLICY IF EXISTS "CT members can read chat" ON chat;
DROP POLICY IF EXISTS "CT members can send chat" ON chat;
CREATE POLICY "Admins full access chat" ON chat FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "CT members can read chat" ON chat FOR SELECT TO authenticated USING (ct_id = get_user_ct(auth.uid()));
CREATE POLICY "CT members can send chat" ON chat FOR INSERT TO authenticated WITH CHECK (remetente_id = auth.uid() AND ct_id = get_user_ct(auth.uid()));
-- ========== mensagens ==========
DROP POLICY IF EXISTS "Admins full access mensagens" ON mensagens;
DROP POLICY IF EXISTS "CT members can read mensagens" ON mensagens;
DROP POLICY IF EXISTS "MestreLider can send mensagens" ON mensagens;
CREATE POLICY "Admins full access mensagens" ON mensagens FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "CT members can read mensagens" ON mensagens FOR SELECT TO authenticated USING (ct_id = get_user_ct(auth.uid()));
CREATE POLICY "MestreLider can send mensagens" ON mensagens FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'mestre_lider') AND remetente_id = auth.uid() AND ct_id IN (SELECT id FROM centros_treinamento WHERE mestre_lider_id = auth.uid()));
-- ========== presencas ==========
DROP POLICY IF EXISTS "Admins full access presencas" ON presencas;
DROP POLICY IF EXISTS "Mestre can manage student presencas" ON presencas;
DROP POLICY IF EXISTS "MestreLider can manage CT presencas" ON presencas;
DROP POLICY IF EXISTS "Users can read own presencas" ON presencas;
CREATE POLICY "Admins full access presencas" ON presencas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Mestre can manage student presencas" ON presencas FOR ALL TO authenticated USING (has_role(auth.uid(), 'mestre') AND aluno_id IN (SELECT user_id FROM profiles WHERE mestre_id = auth.uid())) WITH CHECK (has_role(auth.uid(), 'mestre') AND aluno_id IN (SELECT user_id FROM profiles WHERE mestre_id = auth.uid()));
CREATE POLICY "MestreLider can manage CT presencas" ON presencas FOR ALL TO authenticated USING (has_role(auth.uid(), 'mestre_lider') AND ct_id = get_user_ct(auth.uid())) WITH CHECK (has_role(auth.uid(), 'mestre_lider') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Users can read own presencas" ON presencas FOR SELECT TO authenticated USING (aluno_id = auth.uid());
