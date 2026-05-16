-- Remove duplicate 'aluno' roles where user also has a 'mestre' role
DELETE FROM public.user_roles
WHERE role = 'aluno'
AND user_id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'mestre'
);
