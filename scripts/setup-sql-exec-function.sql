-- 创建SQL执行函数
-- 此函数允许通过Supabase RPC执行任意SQL查询

CREATE OR REPLACE FUNCTION exec_sql_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  -- 执行动态SQL并将结果转换为JSONB
  EXECUTE format('SELECT jsonb_agg(t) FROM (%s) t', query_text) INTO result;

  -- 如果没有返回数据，返回空数组
  IF result IS NULL THEN
    result := '[]'::jsonb;
  END IF;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- 返回错误信息
    RAISE EXCEPTION 'SQL执行失败: %', SQLERRM;
END;
$$;

-- 授予权限给service_role
GRANT EXECUTE ON FUNCTION exec_sql_query(TEXT) TO service_role;

-- 说明
COMMENT ON FUNCTION exec_sql_query(TEXT) IS '执行任意SQL查询并返回JSONB结果。仅限service_role使用。';
