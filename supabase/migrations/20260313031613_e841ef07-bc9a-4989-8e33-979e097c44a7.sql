-- Allow mestres to upload/update/delete files in ct-assets for their own CT
CREATE POLICY "Mestres can upload ct-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ct-assets'
  AND has_role(auth.uid(), 'mestre'::app_role)
);
CREATE POLICY "Mestres can update ct-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ct-assets'
  AND has_role(auth.uid(), 'mestre'::app_role)
);
CREATE POLICY "Mestres can delete ct-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ct-assets'
  AND has_role(auth.uid(), 'mestre'::app_role)
);
