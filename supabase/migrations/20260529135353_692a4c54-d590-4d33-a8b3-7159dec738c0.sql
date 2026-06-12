CREATE OR REPLACE FUNCTION public.faturamento_periodo(p_inicio date, p_fim date)
 RETURNS TABLE(total_faturado numeric, total_atendimentos integer, ticket_medio numeric, taxa_conclusao numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_faturado numeric;
  v_total_atendimentos integer;
  v_ticket_medio numeric;
  v_taxa_conclusao numeric;
BEGIN
  -- Faturamento total vem da tabela de transações (entradas)
  SELECT COALESCE(SUM(valor), 0) INTO v_total_faturado
  FROM public.transactions 
  WHERE tipo = 'entrada' AND data BETWEEN p_inicio AND p_fim;

  -- Total de atendimentos baseia-se em comandas pagas
  SELECT COUNT(*)::INTEGER INTO v_total_atendimentos
  FROM public.commands
  WHERE status = 'paga' AND fechamento::date BETWEEN p_inicio AND p_fim;

  -- Se não houver comandas, tenta contar appointments concluidos (suporte a dados legados)
  IF v_total_atendimentos = 0 THEN
    SELECT COUNT(*)::INTEGER INTO v_total_atendimentos
    FROM public.appointments
    WHERE status = 'concluido' AND data BETWEEN p_inicio AND p_fim;
  END IF;

  -- Cálculo do Ticket Médio
  IF v_total_atendimentos > 0 THEN
    v_ticket_medio := v_total_faturado / v_total_atendimentos;
  ELSE
    v_ticket_medio := 0;
  END IF;

  -- Taxa de conclusão baseada nos agendamentos
  SELECT
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(CASE WHEN status IN ('concluido', 'paga', 'pago') THEN 1 END)::NUMERIC / COUNT(*) * 100, 1)
      ELSE 100 END INTO v_taxa_conclusao
  FROM public.appointments WHERE data BETWEEN p_inicio AND p_fim;
  
  -- Se houver faturamento mas nenhuma agenda concluída (uso exclusivo de comandas), ajusta a taxa
  IF v_taxa_conclusao = 0 AND v_total_faturado > 0 THEN
    v_taxa_conclusao := 100;
  END IF;

  RETURN QUERY SELECT 
    v_total_faturado::numeric, 
    v_total_atendimentos::integer, 
    v_ticket_medio::numeric, 
    v_taxa_conclusao::numeric;
END;
$function$;