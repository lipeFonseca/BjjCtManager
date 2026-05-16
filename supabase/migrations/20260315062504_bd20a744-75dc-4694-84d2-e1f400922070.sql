-- Planos de mensalidade
CREATE TABLE public.planos_mensalidade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ct_id UUID NOT NULL REFERENCES public.centros_treinamento(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  descricao TEXT,
  periodicidade TEXT NOT NULL DEFAULT 'mensal',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);
ALTER TABLE public.planos_mensalidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access planos_mensalidade" ON public.planos_mensalidade FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Mestre can manage CT planos_mensalidade" ON public.planos_mensalidade FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Aluno can read CT planos_mensalidade" ON public.planos_mensalidade FOR SELECT TO authenticated
  USING (ct_id = get_user_ct(auth.uid()));
-- Associação aluno-plano
CREATE TABLE public.aluno_planos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL,
  plano_id UUID NOT NULL REFERENCES public.planos_mensalidade(id) ON DELETE CASCADE,
  ct_id UUID REFERENCES public.centros_treinamento(id) ON DELETE CASCADE,
  dia_vencimento SMALLINT NOT NULL DEFAULT 10,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.aluno_planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access aluno_planos" ON public.aluno_planos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Mestre can manage CT aluno_planos" ON public.aluno_planos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Aluno can read own aluno_planos" ON public.aluno_planos FOR SELECT TO authenticated
  USING (aluno_id = auth.uid());
-- Cobranças geradas
CREATE TABLE public.cobrancas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL,
  plano_id UUID REFERENCES public.planos_mensalidade(id),
  ct_id UUID REFERENCES public.centros_treinamento(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  asaas_payment_id TEXT,
  asaas_boleto_url TEXT,
  asaas_pix_qrcode TEXT,
  asaas_pix_copia_cola TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pago_em TIMESTAMPTZ
);
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access cobrancas" ON public.cobrancas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Mestre can manage CT cobrancas" ON public.cobrancas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Aluno can read own cobrancas" ON public.cobrancas FOR SELECT TO authenticated
  USING (aluno_id = auth.uid());
-- Config de pagamento por CT (chave pix, conta asaas, templates de cobrança)
CREATE TABLE public.config_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ct_id UUID NOT NULL REFERENCES public.centros_treinamento(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE(ct_id, config_key)
);
ALTER TABLE public.config_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access config_pagamento" ON public.config_pagamento FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Mestre can manage CT config_pagamento" ON public.config_pagamento FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre'::app_role) AND ct_id = get_user_ct(auth.uid()));
