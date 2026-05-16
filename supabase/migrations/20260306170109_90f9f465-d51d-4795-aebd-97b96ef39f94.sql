-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'mestre_lider', 'mestre', 'aluno');
-- Enum for belt colors
CREATE TYPE public.faixa_tipo AS ENUM ('branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta', 'coral', 'vermelha');
-- User roles table (separate from profiles per security best practices)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'aluno',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;
-- Centros de Treinamento
CREATE TABLE public.centros_treinamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT,
  mestre_lider_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.centros_treinamento ENABLE ROW LEVEL SECURITY;
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  ct_id UUID REFERENCES public.centros_treinamento(id),
  mestre_id UUID REFERENCES auth.users(id),
  faixa faixa_tipo DEFAULT 'branca',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Presencas (attendance)
CREATE TABLE public.presencas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_treino DATE NOT NULL DEFAULT CURRENT_DATE,
  ct_id UUID REFERENCES public.centros_treinamento(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;
-- Mensagens (CT announcements)
CREATE TABLE public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_id UUID NOT NULL REFERENCES auth.users(id),
  ct_id UUID NOT NULL REFERENCES public.centros_treinamento(id),
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
-- Chat (community chat per CT)
CREATE TABLE public.chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_id UUID NOT NULL REFERENCES auth.users(id),
  ct_id UUID NOT NULL REFERENCES public.centros_treinamento(id),
  mensagem TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat ENABLE ROW LEVEL SECURITY;
-- ===== RLS POLICIES =====

-- user_roles: users can read their own role, admins can manage all
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
-- centros_treinamento: admins full access, others can read their own CT
CREATE POLICY "Admins full access CT" ON public.centros_treinamento
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own CT" ON public.centros_treinamento
  FOR SELECT USING (
    id IN (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
    OR mestre_lider_id = auth.uid()
  );
-- profiles: complex RBAC
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins full access profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "MestreLider can read CT profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'mestre_lider')
    AND ct_id IN (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "MestreLider can update CT profiles" ON public.profiles
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'mestre_lider')
    AND ct_id IN (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Mestre can read own students" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'mestre')
    AND mestre_id = auth.uid()
  );
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "MestreLider can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'mestre_lider'));
CREATE POLICY "Mestre can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'mestre'));
-- presencas
CREATE POLICY "Admins full access presencas" ON public.presencas
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own presencas" ON public.presencas
  FOR SELECT USING (aluno_id = auth.uid());
CREATE POLICY "MestreLider can manage CT presencas" ON public.presencas
  FOR ALL USING (
    public.has_role(auth.uid(), 'mestre_lider')
    AND ct_id IN (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Mestre can manage student presencas" ON public.presencas
  FOR ALL USING (
    public.has_role(auth.uid(), 'mestre')
    AND aluno_id IN (SELECT user_id FROM public.profiles WHERE mestre_id = auth.uid())
  );
-- mensagens: CT members can read, mestre_lider can write
CREATE POLICY "CT members can read mensagens" ON public.mensagens
  FOR SELECT USING (
    ct_id IN (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins full access mensagens" ON public.mensagens
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "MestreLider can send mensagens" ON public.mensagens
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'mestre_lider')
    AND remetente_id = auth.uid()
    AND ct_id IN (SELECT id FROM public.centros_treinamento WHERE mestre_lider_id = auth.uid())
  );
-- chat: CT members can read and write
CREATE POLICY "CT members can read chat" ON public.chat
  FOR SELECT USING (
    ct_id IN (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "CT members can send chat" ON public.chat
  FOR INSERT WITH CHECK (
    remetente_id = auth.uid()
    AND ct_id IN (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins full access chat" ON public.chat
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
-- Trigger for auto profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)), NEW.email);
  
  -- First user gets admin role, others get aluno
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'aluno');
  END IF;
  
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
