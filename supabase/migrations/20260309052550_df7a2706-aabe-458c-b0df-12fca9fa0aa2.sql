DO $$
DECLARE
  uid uuid := '314e9de4-64a3-4490-8581-0ae1be9071bf';
  ct uuid;
  admin_id uuid;
BEGIN
  SELECT id INTO ct FROM centros_treinamento LIMIT 1;
  SELECT user_id INTO admin_id FROM profiles WHERE username = 'admin' LIMIT 1;

  IF ct IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = uid) THEN
    RETURN;
  END IF;

  UPDATE public.profiles SET nome = 'Aluno Widget Teste', username = 'aluno.widget.teste', 
    email = 'alunowidget@bjjmanager.local', faixa = 'azul', ct_id = ct WHERE user_id = uid;
  UPDATE public.user_roles SET role = 'aluno' WHERE user_id = uid;

  IF admin_id IS NULL THEN
    admin_id := uid;
  END IF;

  INSERT INTO public.avaliacoes (aluno_id, avaliador_id, ct_id, nota_tecnica, nota_frequencia, nota_disciplina, observacoes, created_at)
  VALUES (uid, admin_id, ct, 5, 7, 8, 'Primeira avaliação', now() - interval '7 days');
  INSERT INTO public.avaliacoes (aluno_id, avaliador_id, ct_id, nota_tecnica, nota_frequencia, nota_disciplina, observacoes, created_at)
  VALUES (uid, admin_id, ct, 7, 9, 9, 'Segunda avaliação - evolução', now());
END $$;
