-- Create storage bucket for login assets
INSERT INTO storage.buckets (id, name, public) VALUES ('login-assets', 'login-assets', true)
ON CONFLICT (id) DO NOTHING;
-- Allow public read access
CREATE POLICY "Public read login-assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'login-assets');
-- Allow authenticated users to upload/update/delete (admin only enforced in app)
CREATE POLICY "Auth upload login-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'login-assets');
CREATE POLICY "Auth update login-assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'login-assets');
CREATE POLICY "Auth delete login-assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'login-assets');
-- Seed login config keys
INSERT INTO public.layout_config (config_key, config_value) VALUES
  ('login_banner_url', '""'::jsonb),
  ('login_logo_url', '""'::jsonb),
  ('login_bg_color', '"#121212"'::jsonb),
  ('login_card_bg_color', '"#1a1a1a"'::jsonb),
  ('login_primary_color', '"#dc2626"'::jsonb),
  ('login_text_color', '"#f2f2f2"'::jsonb),
  ('login_accent_color', '"#262626"'::jsonb)
ON CONFLICT DO NOTHING;
