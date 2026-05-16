CREATE POLICY "Mestre can read CT member roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'mestre'::app_role)
  AND user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.ct_id = get_user_ct(auth.uid())
  )
);
