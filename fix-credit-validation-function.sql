-- 修复积分验证函数，将硬编码的100改为动态读取系统配置
CREATE OR REPLACE FUNCTION validate_credit_balances()
RETURNS TABLE (
  user_id UUID,
  profile_balance INTEGER,
  calculated_balance INTEGER,
  difference INTEGER
) AS $$
DECLARE
  v_default_credits INTEGER;
BEGIN
  -- 从系统配置表中获取默认积分
  SELECT COALESCE(setting_value::INTEGER, 50) INTO v_default_credits
  FROM public.system_settings 
  WHERE setting_key = 'default_user_credits';
  
  RETURN QUERY
  WITH transaction_sums AS (
    SELECT 
      ct.user_id,
      SUM(ct.amount) as calculated_balance
    FROM public.credit_transactions ct
    GROUP BY ct.user_id
  )
  SELECT 
    p.id as user_id,
    p.credits as profile_balance,
    COALESCE(ts.calculated_balance + v_default_credits, v_default_credits) as calculated_balance,
    (p.credits - COALESCE(ts.calculated_balance + v_default_credits, v_default_credits)) as difference
  FROM public.profiles p
  LEFT JOIN transaction_sums ts ON ts.user_id = p.id
  WHERE p.credits != COALESCE(ts.calculated_balance + v_default_credits, v_default_credits);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;