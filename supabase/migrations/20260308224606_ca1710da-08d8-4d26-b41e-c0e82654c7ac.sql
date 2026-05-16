INSERT INTO public.layout_config (config_key, config_value) VALUES
  ('sidebar_position', '"left"'),
  ('sidebar_size', '"normal"'),
  ('sidebar_icon_only', 'false')
ON CONFLICT (config_key) DO NOTHING;
