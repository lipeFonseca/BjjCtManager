-- Tabela pagamentos: armazena cada pagamento recebido via webhook
CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_payment_id text UNIQUE,
  customer_id text,
  valor numeric,
  status text,
  billing_type text,
  ct_id uuid REFERENCES public.centros_treinamento(id),
  aluno_id uuid,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access pagamentos" ON public.pagamentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Mestre can manage CT pagamentos" ON public.pagamentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()));
CREATE POLICY "Aluno can read own pagamentos" ON public.pagamentos
  FOR SELECT TO authenticated
  USING (aluno_id = auth.uid());
-- Tabela financeiro: saldo consolidado por CT
CREATE TABLE public.financeiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ct_id uuid REFERENCES public.centros_treinamento(id) UNIQUE,
  saldo numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access financeiro" ON public.financeiro
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Mestre can read CT financeiro" ON public.financeiro
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'mestre') AND ct_id = get_user_ct(auth.uid()));
-- Enable realtime for financeiro table
ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos;
