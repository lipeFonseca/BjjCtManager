-- Upgrade webhook_config to support CT-scoped messaging settings on environments
-- where the table was created without ct_id.

ALTER TABLE public.webhook_config
ADD COLUMN IF NOT EXISTS ct_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS webhook_config_unique_key_per_ct
ON public.webhook_config (config_key, COALESCE(ct_id, '00000000-0000-0000-0000-000000000000'::uuid));
ALTER TABLE public.webhook_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins full access webhook_config" ON public.webhook_config;
CREATE POLICY "Admins full access webhook_config"
ON public.webhook_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Mestre can read own webhook_config" ON public.webhook_config;
CREATE POLICY "Mestre can read own webhook_config"
ON public.webhook_config
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'mestre'::app_role)
  AND ct_id = (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Mestre can insert own webhook_config" ON public.webhook_config;
CREATE POLICY "Mestre can insert own webhook_config"
ON public.webhook_config
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'mestre'::app_role)
  AND ct_id = (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Mestre can update own webhook_config" ON public.webhook_config;
CREATE POLICY "Mestre can update own webhook_config"
ON public.webhook_config
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'mestre'::app_role)
  AND ct_id = (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'mestre'::app_role)
  AND ct_id = (SELECT ct_id FROM public.profiles WHERE user_id = auth.uid())
);
