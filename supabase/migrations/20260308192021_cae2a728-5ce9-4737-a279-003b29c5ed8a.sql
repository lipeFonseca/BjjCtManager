-- Convert existing mestre_lider to mestre
UPDATE public.user_roles SET role = 'mestre' WHERE role = 'mestre_lider';
-- Drop all dependent policies
DROP POLICY IF EXISTS "Admins full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Mestre can read own students" ON public.profiles;
DROP POLICY IF EXISTS "Mestre can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "MestreLider can read CT profiles" ON public.profiles;
DROP POLICY IF EXISTS "MestreLider can update CT profiles" ON public.profiles;
DROP POLICY IF EXISTS "MestreLider can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins full access CT" ON public.centros_treinamento;
DROP POLICY IF EXISTS "Users can read own CT" ON public.centros_treinamento;
DROP POLICY IF EXISTS "Admins full access chat" ON public.chat;
DROP POLICY IF EXISTS "CT members can read chat" ON public.chat;
DROP POLICY IF EXISTS "CT members can send chat" ON public.chat;
DROP POLICY IF EXISTS "Admins full access mensagens" ON public.mensagens;
DROP POLICY IF EXISTS "CT members can read mensagens" ON public.mensagens;
DROP POLICY IF EXISTS "MestreLider can send mensagens" ON public.mensagens;
DROP POLICY IF EXISTS "Admins full access presencas" ON public.presencas;
DROP POLICY IF EXISTS "Mestre can manage student presencas" ON public.presencas;
DROP POLICY IF EXISTS "MestreLider can manage CT presencas" ON public.presencas;
DROP POLICY IF EXISTS "Users can read own presencas" ON public.presencas;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins full access horarios" ON public.horarios_aulas;
DROP POLICY IF EXISTS "Mestre can manage CT horarios" ON public.horarios_aulas;
DROP POLICY IF EXISTS "MestreLider can manage CT horarios" ON public.horarios_aulas;
DROP POLICY IF EXISTS "Alunos can read CT horarios" ON public.horarios_aulas;
DROP POLICY IF EXISTS "Admins can manage ct-assets" ON storage.objects;
-- Drop functions
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
-- Convert column to text, drop old enum, create new, convert back
ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
DROP TYPE public.app_role;
CREATE TYPE public.app_role AS ENUM ('admin', 'mestre', 'aluno');
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::public.app_role;
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'aluno'::public.app_role;
-- Recreate functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;
-- Recreate all policies
CREATE POLICY "Admins full access profiles" ON public.profiles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Mestre can read CT profiles" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'mestre') AND (mestre_id = auth.uid() OR ct_id = get_user_ct(auth.uid())));
CREATE POLICY "Mestre can update CT profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Mestre can insert CT profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'mestre') AND (mestre_id = auth.uid() OR ct_id = get_user_ct(auth.uid())));
CREATE POLICY "Admins full access CT" ON public.centros_treinamento FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own CT" ON public.centros_treinamento FOR SELECT TO authenticated
  USING (id = get_user_ct(auth.uid()) OR mestre_lider_id = auth.uid());
CREATE POLICY "Admins full access chat" ON public.chat FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "CT members can read chat" ON public.chat FOR SELECT TO authenticated
  USING (ct_id = get_user_ct(auth.uid()));
CREATE POLICY "CT members can send chat" ON public.chat FOR INSERT TO authenticated
  WITH CHECK (remetente_id = auth.uid() AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Admins full access mensagens" ON public.mensagens FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "CT members can read mensagens" ON public.mensagens FOR SELECT TO authenticated
  USING (ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Mestre can send mensagens" ON public.mensagens FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'mestre') AND remetente_id = auth.uid() AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Admins full access presencas" ON public.presencas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Mestre can manage CT presencas" ON public.presencas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Users can read own presencas" ON public.presencas FOR SELECT TO authenticated
  USING (aluno_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins full access horarios" ON public.horarios_aulas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Mestre can manage CT horarios" ON public.horarios_aulas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Alunos can read CT horarios" ON public.horarios_aulas FOR SELECT TO authenticated
  USING (ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Admins can manage ct-assets" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'ct-assets' AND has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'ct-assets' AND has_role(auth.uid(), 'admin'));
-- Update handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN RETURN NEW; END IF;
  INSERT INTO public.profiles (user_id, nome, email, username) VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)), NEW.email,
    COALESCE(split_part(NEW.email, '@', 1), 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8)));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'aluno');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
