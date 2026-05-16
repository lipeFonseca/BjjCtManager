-- Drop legacy uniqueness on config_key alone so webhook_config can store one row per CT.

ALTER TABLE public.webhook_config
DROP CONSTRAINT IF EXISTS webhook_config_config_key_key;
