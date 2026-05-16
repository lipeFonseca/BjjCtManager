ALTER TABLE public.config_pagamento ADD CONSTRAINT config_pagamento_ct_id_config_key_unique UNIQUE (ct_id, config_key);
