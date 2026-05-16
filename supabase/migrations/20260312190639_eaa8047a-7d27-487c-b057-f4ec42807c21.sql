-- Allow mestres to delete their own messages
CREATE POLICY "Mestre can delete own mensagens"
ON public.mensagens
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'mestre'::app_role)
  AND remetente_id = auth.uid()
  AND ct_id = get_user_ct(auth.uid())
);
