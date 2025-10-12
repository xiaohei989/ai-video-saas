-- 检查 Supabase Realtime 配置

-- 1. 检查 videos 表是否在 supabase_realtime publication 中
SELECT
  'videos表Realtime状态' as check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND tablename = 'videos'
    ) THEN '✅ 已启用'
    ELSE '❌ 未启用 - 需要在Dashboard中启用Replication'
  END as status;

-- 2. 检查 RLS 策略
SELECT
  'RLS策略检查' as check_item,
  policyname as policy_name,
  cmd as command_type,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'videos'
ORDER BY policyname;

-- 3. 检查是否有 UPDATE 权限的策略
SELECT
  'UPDATE策略状态' as check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'videos'
      AND cmd IN ('SELECT', 'ALL')
    ) THEN '✅ 存在SELECT策略'
    ELSE '❌ 缺少SELECT策略'
  END as status;

-- 4. 检查表字段列表
SELECT
  'videos表字段' as check_item,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'videos'
AND column_name IN ('id', 'title', 'description', 'ai_title_status', 'updated_at')
ORDER BY ordinal_position;
