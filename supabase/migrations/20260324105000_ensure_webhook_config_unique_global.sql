-- Ensure webhook_config really enforces unique per config_key + ct_id including global (ct_id NULL)
-- This fixes behavior where Postgres UNIQUE allows multiple NULL ct_id, making UPSERT on (config_key, ct_id) unreliable for global configs.

DROP INDEX IF EXISTS webhook_config_unique_key_per_ct;
CREATE UNIQUE INDEX webhook_config_unique_key_per_ct
ON public.webhook_config (config_key, COALESCE(ct_id, '00000000-0000-0000-0000-000000000000'::uuid));
