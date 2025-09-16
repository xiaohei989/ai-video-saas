-- 创建获取订单列表的函数，支持分页和筛选

-- 1. 获取订单列表函数（支持分页）
CREATE OR REPLACE FUNCTION get_orders_list(
  page_offset integer DEFAULT 0,
  page_limit integer DEFAULT 20,
  status_filter text DEFAULT NULL,
  payment_type_filter text DEFAULT NULL,
  search_email text DEFAULT NULL,
  date_from timestamp with time zone DEFAULT NULL,
  date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  user_email text,
  user_role text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount numeric,
  currency text,
  status text,
  description text,
  payment_type text,
  metadata jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    py.id,
    py.user_id,
    p.email as user_email,
    COALESCE(p.role, 'user') as user_role,
    py.stripe_payment_intent_id,
    py.stripe_checkout_session_id,
    py.amount,
    py.currency::text,
    py.status::text,
    py.description,
    CASE 
      WHEN py.description = '订阅支付' OR py.metadata->>'type' = 'subscription' THEN 'subscription'
      WHEN py.description = '积分购买' OR py.metadata->>'type' = 'credit_purchase' THEN 'credit_purchase'
      ELSE 'other'
    END as payment_type,
    py.metadata,
    py.created_at,
    py.updated_at
  FROM payments py
  LEFT JOIN profiles p ON p.id = py.user_id
  WHERE 
    (status_filter IS NULL OR py.status = status_filter)
    AND (payment_type_filter IS NULL OR 
         (payment_type_filter = 'subscription' AND (py.description = '订阅支付' OR py.metadata->>'type' = 'subscription')) OR
         (payment_type_filter = 'credit_purchase' AND (py.description = '积分购买' OR py.metadata->>'type' = 'credit_purchase')) OR
         (payment_type_filter = 'other' AND py.description NOT IN ('订阅支付', '积分购买') AND py.metadata->>'type' NOT IN ('subscription', 'credit_purchase'))
    )
    AND (search_email IS NULL OR p.email ILIKE '%' || search_email || '%')
    AND (date_from IS NULL OR py.created_at >= date_from)
    AND (date_to IS NULL OR py.created_at <= date_to)
  ORDER BY py.created_at DESC
  LIMIT page_limit OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

-- 2. 获取订单总数函数（用于分页计算）
CREATE OR REPLACE FUNCTION get_orders_count(
  status_filter text DEFAULT NULL,
  payment_type_filter text DEFAULT NULL,
  search_email text DEFAULT NULL,
  date_from timestamp with time zone DEFAULT NULL,
  date_to timestamp with time zone DEFAULT NULL
)
RETURNS bigint AS $$
DECLARE
  total_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO total_count
  FROM payments py
  LEFT JOIN profiles p ON p.id = py.user_id
  WHERE 
    (status_filter IS NULL OR py.status = status_filter)
    AND (payment_type_filter IS NULL OR 
         (payment_type_filter = 'subscription' AND (py.description = '订阅支付' OR py.metadata->>'type' = 'subscription')) OR
         (payment_type_filter = 'credit_purchase' AND (py.description = '积分购买' OR py.metadata->>'type' = 'credit_purchase')) OR
         (payment_type_filter = 'other' AND py.description NOT IN ('订阅支付', '积分购买') AND py.metadata->>'type' NOT IN ('subscription', 'credit_purchase'))
    )
    AND (search_email IS NULL OR p.email ILIKE '%' || search_email || '%')
    AND (date_from IS NULL OR py.created_at >= date_from)
    AND (date_to IS NULL OR py.created_at <= date_to);
    
  RETURN total_count;
END;
$$ LANGUAGE plpgsql;

-- 3. 获取订单统计概览函数
CREATE OR REPLACE FUNCTION get_orders_summary()
RETURNS TABLE(
  total_orders bigint,
  successful_orders bigint,
  pending_orders bigint,
  failed_orders bigint,
  total_revenue numeric,
  subscription_orders bigint,
  credit_purchase_orders bigint,
  avg_order_amount numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN py.status = 'succeeded' THEN 1 END) as successful_orders,
    COUNT(CASE WHEN py.status IN ('processing', 'pending') THEN 1 END) as pending_orders,
    COUNT(CASE WHEN py.status IN ('failed', 'canceled') THEN 1 END) as failed_orders,
    COALESCE(SUM(CASE WHEN py.status = 'succeeded' THEN py.amount ELSE 0 END), 0) as total_revenue,
    COUNT(CASE WHEN py.description = '订阅支付' OR py.metadata->>'type' = 'subscription' THEN 1 END) as subscription_orders,
    COUNT(CASE WHEN py.description = '积分购买' OR py.metadata->>'type' = 'credit_purchase' THEN 1 END) as credit_purchase_orders,
    COALESCE(AVG(CASE WHEN py.status = 'succeeded' THEN py.amount END), 0) as avg_order_amount
  FROM payments py
  LEFT JOIN profiles p ON p.id = py.user_id;
END;
$$ LANGUAGE plpgsql;