-- 修复check_ip_auth_block函数中的变量名冲突
CREATE OR REPLACE FUNCTION check_ip_auth_block(
  p_ip_address INET,
  p_attempt_type VARCHAR(20) DEFAULT 'login'
) RETURNS TABLE (
  is_blocked BOOLEAN,
  blocked_until TIMESTAMPTZ,
  reason TEXT,
  failure_count INTEGER
) AS $$
DECLARE
  v_latest_block TIMESTAMPTZ;
  v_failure_count INTEGER;
BEGIN
  -- 查找最新的阻止时间
  SELECT MAX(afa.blocked_until), COUNT(*)
  INTO v_latest_block, v_failure_count
  FROM public.auth_failure_attempts afa
  WHERE afa.ip_address = p_ip_address
    AND afa.attempt_type = p_attempt_type
    AND afa.created_at >= NOW() - INTERVAL '1 hour' -- 只查看最近1小时
    AND afa.blocked_until IS NOT NULL;
  
  -- 如果没有阻止记录或已过期
  IF v_latest_block IS NULL OR v_latest_block <= NOW() THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      NULL::TIMESTAMPTZ,
      'IP地址认证检查通过'::TEXT,
      COALESCE(v_failure_count, 0);
  ELSE
    RETURN QUERY SELECT 
      true::BOOLEAN,
      v_latest_block,
      format('IP地址因多次失败被临时阻止，解除时间：%s', v_latest_block::TEXT),
      v_failure_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Auth block function fixed successfully' as status;