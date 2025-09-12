-- 创建原子计数器更新函数
-- 用于batch-update-counters Edge Function

-- 创建或替换原子计数器更新函数
CREATE OR REPLACE FUNCTION update_template_counters_atomic(
  p_template_id TEXT,
  p_like_delta INTEGER DEFAULT 0,
  p_comment_delta INTEGER DEFAULT 0,
  p_view_delta INTEGER DEFAULT 0,
  p_usage_delta INTEGER DEFAULT 0,
  p_share_delta INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  -- 使用INSERT ... ON CONFLICT来确保模板存在
  INSERT INTO templates (
    id, 
    slug, 
    title, 
    description,
    like_count,
    comment_count,
    view_count,
    usage_count,
    share_count,
    created_at,
    updated_at
  )
  VALUES (
    p_template_id::UUID,
    COALESCE((SELECT slug FROM templates WHERE id = p_template_id::UUID), 'template-' || p_template_id),
    COALESCE((SELECT title FROM templates WHERE id = p_template_id::UUID), 'Template'),
    COALESCE((SELECT description FROM templates WHERE id = p_template_id::UUID), 'AI Generated Video Template'),
    GREATEST(0, p_like_delta),
    GREATEST(0, p_comment_delta), 
    GREATEST(0, p_view_delta),
    GREATEST(0, p_usage_delta),
    GREATEST(0, p_share_delta),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    like_count = GREATEST(0, templates.like_count + p_like_delta),
    comment_count = GREATEST(0, templates.comment_count + p_comment_delta),
    view_count = GREATEST(0, templates.view_count + p_view_delta),
    usage_count = GREATEST(0, templates.usage_count + p_usage_delta),
    share_count = GREATEST(0, templates.share_count + p_share_delta),
    updated_at = NOW();

  -- 记录计数器更新日志
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    timestamp
  )
  VALUES (
    'templates',
    p_template_id,
    'batch_counter_update',
    jsonb_build_object(
      'like_delta', p_like_delta,
      'comment_delta', p_comment_delta,
      'view_delta', p_view_delta,
      'usage_delta', p_usage_delta,
      'share_delta', p_share_delta
    ),
    jsonb_build_object(
      'updated_at', NOW()
    ),
    '00000000-0000-0000-0000-000000000000'::UUID, -- 系统用户
    NOW()
  );
  
  -- 记录成功信息
  RAISE NOTICE '模板 % 计数器批量更新完成: likes=%s, comments=%s, views=%s, usage=%s, shares=%s', 
    p_template_id, p_like_delta, p_comment_delta, p_view_delta, p_usage_delta, p_share_delta;

EXCEPTION
  WHEN OTHERS THEN
    -- 记录错误但不中断事务
    RAISE NOTICE '模板 % 计数器更新失败: %', p_template_id, SQLERRM;
    -- 重新抛出异常
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为函数添加注释
COMMENT ON FUNCTION update_template_counters_atomic IS 
'原子更新模板计数器，支持批量增减操作，确保计数器不会为负数';

-- 授予必要权限
GRANT EXECUTE ON FUNCTION update_template_counters_atomic TO service_role;
GRANT EXECUTE ON FUNCTION update_template_counters_atomic TO authenticated;

-- 验证函数是否创建成功
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'update_template_counters_atomic';