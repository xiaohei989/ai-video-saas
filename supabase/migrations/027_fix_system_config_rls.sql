-- ========================================
-- 修复 system_config 表的 RLS 安全问题
-- 执行时间: 2025-10-15
-- 问题: system_config 表未启用 RLS，导致敏感配置可能暴露
-- 解决方案: 启用 RLS 并采用最严格的访问策略
-- ========================================

-- 1. 启用 RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 2. 访问策略说明
-- ⚠️ 重要：此表不创建任何 SELECT/INSERT/UPDATE/DELETE 策略
-- 原因：
--   - 表中包含敏感信息（service_role_key, supabase_url）
--   - 前端不需要访问此表
--   - 只供数据库内部触发器函数使用（通过 SECURITY DEFINER）
--
-- 效果：
--   - PostgREST API 完全无法访问此表
--   - 触发器函数（SECURITY DEFINER）仍可正常访问
--   - 最大程度保护敏感配置

-- 3. 创建管理函数：允许管理员安全地更新配置
CREATE OR REPLACE FUNCTION update_system_config(
  p_key TEXT,
  p_value TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- 检查是否为管理员
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only administrators can update system configuration'
    );
  END IF;

  -- 更新或插入配置
  INSERT INTO system_config (key, value, description, updated_at)
  VALUES (p_key, p_value, p_description, NOW())
  ON CONFLICT (key) DO UPDATE
  SET
    value = EXCLUDED.value,
    description = COALESCE(EXCLUDED.description, system_config.description),
    updated_at = NOW();

  RETURN json_build_object(
    'success', true,
    'key', p_key,
    'message', 'Configuration updated successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 创建读取函数：允许管理员安全地读取配置（非敏感字段）
CREATE OR REPLACE FUNCTION get_system_config(p_key TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_result JSON;
  v_sensitive_keys TEXT[] := ARRAY['service_role_key', 'supabase_url'];
BEGIN
  -- 检查是否为管理员
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only administrators can read system configuration'
    );
  END IF;

  -- 读取单个配置
  IF p_key IS NOT NULL THEN
    -- 检查是否为敏感字段
    IF p_key = ANY(v_sensitive_keys) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Cannot read sensitive configuration key'
      );
    END IF;

    SELECT json_build_object(
      'success', true,
      'key', key,
      'value', value,
      'description', description
    ) INTO v_result
    FROM system_config
    WHERE key = p_key;

    RETURN COALESCE(v_result, json_build_object('success', false, 'error', 'Key not found'));
  END IF;

  -- 读取所有非敏感配置
  SELECT json_build_object(
    'success', true,
    'configs', json_agg(
      json_build_object(
        'key', key,
        'value', value,
        'description', description
      )
    )
  ) INTO v_result
  FROM system_config
  WHERE key != ALL(v_sensitive_keys);

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 授权函数（只允许认证用户调用，函数内部会检查管理员权限）
GRANT EXECUTE ON FUNCTION update_system_config(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_config(TEXT) TO authenticated;

-- 6. 添加注释
COMMENT ON TABLE public.system_config IS '系统配置表（启用 RLS，仅触发器函数和管理员可访问）';
COMMENT ON FUNCTION update_system_config(TEXT, TEXT, TEXT) IS '管理员更新系统配置（安全函数）';
COMMENT ON FUNCTION get_system_config(TEXT) IS '管理员读取系统配置（自动过滤敏感字段）';

-- 7. 输出信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'system_config 表 RLS 安全修复完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS 已启用';
  RAISE NOTICE '✅ 禁止 PostgREST 直接访问';
  RAISE NOTICE '✅ 触发器函数（SECURITY DEFINER）仍可访问';
  RAISE NOTICE '✅ 管理员可通过函数安全访问：';
  RAISE NOTICE '   - update_system_config(key, value, description)';
  RAISE NOTICE '   - get_system_config(key)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  敏感字段自动保护：';
  RAISE NOTICE '   - service_role_key（不可读取）';
  RAISE NOTICE '   - supabase_url（不可读取）';
  RAISE NOTICE '========================================';
END $$;
