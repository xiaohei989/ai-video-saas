-- 修复订阅分布函数的类型问题
CREATE OR REPLACE FUNCTION get_subscription_distribution()
RETURNS TABLE(
  tier text,
  user_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH subscription_tiers AS (
    SELECT 
      CASE 
        WHEN s.tier IS NULL THEN 'free'
        ELSE s.tier::text
      END as tier,
      COUNT(*) as user_count
    FROM profiles p
    LEFT JOIN subscriptions s ON p.id = s.user_id AND s.status = 'active'
    WHERE p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')
    GROUP BY 
      CASE 
        WHEN s.tier IS NULL THEN 'free'
        ELSE s.tier::text
      END
  )
  SELECT st.tier, st.user_count
  FROM subscription_tiers st
  ORDER BY st.user_count DESC;
END;
$$ LANGUAGE plpgsql;