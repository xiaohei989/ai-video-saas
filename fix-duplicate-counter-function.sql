-- 修复重复的计数器函数
-- 删除所有现有的update_template_counters_atomic函数并重新创建

-- 删除所有现有的函数
DROP FUNCTION IF EXISTS update_template_counters_atomic(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_template_counters_atomic(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_template_counters_atomic CASCADE;

-- 重新创建正确的函数
CREATE OR REPLACE FUNCTION update_template_counters_atomic(
  p_template_id TEXT,
  p_like_delta INTEGER DEFAULT 0,
  p_comment_delta INTEGER DEFAULT 0,
  p_view_delta INTEGER DEFAULT 0,
  p_usage_delta INTEGER DEFAULT 0,
  p_share_delta INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
  template_uuid UUID;
BEGIN
  -- 尝试转换template_id为UUID
  BEGIN
    template_uuid := p_template_id::UUID;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid UUID format: %', p_template_id;
  END;
  
  -- 检查模板是否存在，如果不存在则跳过更新
  IF NOT EXISTS (SELECT 1 FROM templates WHERE id = template_uuid) THEN
    RAISE NOTICE '模板 % 不存在，跳过计数器更新', p_template_id;
    RETURN;
  END IF;

  -- 更新计数器，确保不为负数
  UPDATE templates 
  SET 
    like_count = GREATEST(0, COALESCE(like_count, 0) + p_like_delta),
    comment_count = GREATEST(0, COALESCE(comment_count, 0) + p_comment_delta),
    view_count = GREATEST(0, COALESCE(view_count, 0) + p_view_delta),
    usage_count = GREATEST(0, COALESCE(usage_count, 0) + p_usage_delta),
    share_count = GREATEST(0, COALESCE(share_count, 0) + p_share_delta),
    updated_at = NOW()
  WHERE id = template_uuid;

  -- 记录更新信息
  RAISE NOTICE '模板 % 计数器更新完成: likes+%, comments+%, views+%, usage+%, shares+%', 
    p_template_id, p_like_delta, p_comment_delta, p_view_delta, p_usage_delta, p_share_delta;

EXCEPTION
  WHEN OTHERS THEN
    -- 记录错误但不阻断
    RAISE NOTICE '模板 % 计数器更新失败: %', p_template_id, SQLERRM;
    -- 继续执行，不抛出异常
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加函数注释
COMMENT ON FUNCTION update_template_counters_atomic IS 
'安全地更新模板计数器，支持增减操作，确保计数器不为负数';

-- 授予权限
GRANT EXECUTE ON FUNCTION update_template_counters_atomic TO service_role;
GRANT EXECUTE ON FUNCTION update_template_counters_atomic TO authenticated;

-- 测试函数
SELECT update_template_counters_atomic('00000000-0000-0000-0000-000000000000', 1, 0, 0, 0, 0);