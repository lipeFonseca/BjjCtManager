-- Migração: Adicionar trigger para cleanup automático de webhook_config
-- Esta migração garante que quando um CT é deletado, todos os seus webhooks são removidos

CREATE OR REPLACE FUNCTION public.cleanup_ct_configs() 
RETURNS TRIGGER AS $$
BEGIN
  -- Deletar webhook_config do CT que foi deletado
  DELETE FROM public.webhook_config WHERE ct_id = OLD.id;
  
  -- Deletar secure_config_entries do CT que foi deletado
  DELETE FROM public.secure_config_entries WHERE ct_id = OLD.id;
  
  RAISE NOTICE 'Cleanup concluído para CT: %', OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Drop trigger se existir
DROP TRIGGER IF EXISTS trg_cleanup_ct_configs ON public.centros_treinamento;
-- Criar trigger
CREATE TRIGGER trg_cleanup_ct_configs
BEFORE DELETE ON public.centros_treinamento
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_ct_configs();
-- Comentário
COMMENT ON FUNCTION public.cleanup_ct_configs() IS 
  'Limpa automaticamente webhook_config e secure_config_entries quando um CT é deletado';
