CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  ct uuid;
  admin_id uuid;
BEGIN
  SELECT id INTO ct FROM centros_treinamento LIMIT 1;
  SELECT user_id INTO admin_id FROM profiles WHERE username = 'admin' LIMIT 1;

  IF ct IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, 
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, aud, role
  ) VALUES (
    new_user_id, '00000000-0000-0000-0000-000000000000',
    'alunowidget@bjjmanager.local',
    extensions.crypt('Teste123!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"AlunoWidgetTeste"}'::jsonb,
    'authenticated', 'authenticated'
  );

  -- Update the profile created by trigger
  UPDATE public.profiles 
  SET nome = 'Aluno Widget Teste', username = 'aluno.widget.teste', 
      email = 'alunowidget@bjjmanager.local', faixa = 'azul', ct_id = ct
  WHERE user_id = new_user_id;

  -- Fix role to aluno
  UPDATE public.user_roles SET role = 'aluno' WHERE user_id = new_user_id;

  IF admin_id IS NULL THEN
    admin_id := new_user_id;
  END IF;

  -- Create test evaluations
  INSERT INTO public.avaliacoes (aluno_id, avaliador_id, ct_id, nota_tecnica, nota_frequencia, nota_disciplina, observacoes, created_at)
  VALUES (new_user_id, admin_id, ct, 5, 7, 8, 'Primeira avaliação', now() - interval '7 days');

  INSERT INTO public.avaliacoes (aluno_id, avaliador_id, ct_id, nota_tecnica, nota_frequencia, nota_disciplina, observacoes, created_at)
  VALUES (new_user_id, admin_id, ct, 7, 9, 9, 'Segunda avaliação - evolução', now());
END $$;
