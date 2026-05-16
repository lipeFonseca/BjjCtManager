-- Remove duplicate entries for the same config_key + ct_id (including ct_id NULL) to avoid multiple rows interfering with select().

WITH ranked AS (
  SELECT
    id,
    config_key,
    ct_id,
    ROW_NUMBER() OVER (PARTITION BY config_key, COALESCE(ct_id, '00000000-0000-0000-0000-000000000000'::uuid) ORDER BY updated_at DESC NULLS LAST, id) AS rn
  FROM public.webhook_config
)
DELETE FROM public.webhook_config
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);
