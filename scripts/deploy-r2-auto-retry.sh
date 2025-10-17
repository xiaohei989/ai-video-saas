#!/bin/bash
# 部署 R2 迁移自动重试系统（Supabase版本）

set -e

echo "========================================="
echo "🚀 部署 R2 迁移自动重试系统"
echo "========================================="
echo ""

# 步骤 1: 应用数据库迁移
echo "📦 步骤 1/3: 应用数据库迁移..."
echo "请在 Supabase SQL Editor 中执行:"
echo "  supabase/migrations/028_add_r2_migration_auto_retry.sql"
echo ""
read -p "迁移已执行完成？(y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 部署取消"
  exit 1
fi

# 步骤 2: 部署 Edge Function
echo ""
echo "🔧 步骤 2/3: 部署 Edge Function..."
npx supabase functions deploy retry-failed-migrations --no-verify-jwt

if [ $? -eq 0 ]; then
  echo "✅ Edge Function 部署成功"
else
  echo "❌ Edge Function 部署失败"
  exit 1
fi

# 步骤 3: 配置 Cron 任务
echo ""
echo "⏰ 步骤 3/3: 配置 Supabase pg_cron"
echo ""
echo "请在 Supabase SQL Editor 中执行以下 SQL:"
echo ""
cat << 'EOF'
-- 启用 pg_cron 扩展（如果还没启用）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 创建定时任务（每5分钟执行一次）
SELECT cron.schedule(
  'retry-failed-migrations',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM system_config WHERE key = 'supabase_url') || '/functions/v1/retry-failed-migrations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT value FROM system_config WHERE key = 'service_role_key')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- 验证 Cron 任务已创建
SELECT * FROM cron.job WHERE jobname = 'retry-failed-migrations';
EOF
echo ""
read -p "Cron 任务已配置完成？(y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "⚠️  警告: Cron 任务未配置，自动重试将不会运行"
else
  echo "✅ Cron 任务配置成功"
fi

echo ""
echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo ""
echo "📊 验证部署:"
echo "  1. 查看系统健康:"
echo "     SELECT * FROM migration_health;"
echo ""
echo "  2. 手动测试重试:"
echo "     SELECT auto_retry_failed_migrations();"
echo ""
echo "  3. 查看 Cron 任务执行历史:"
echo "     SELECT * FROM cron.job_run_details"
echo "     WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-migrations')"
echo "     ORDER BY start_time DESC LIMIT 10;"
echo ""
echo "🔍 监控命令:"
echo "  - 查看失败原因: SELECT * FROM migration_failures;"
echo "  - 查看可重试数: SELECT retriable_count FROM migration_health;"
echo ""
echo "⏱️  Cron 将在5分钟内首次执行，请耐心等待"
echo ""
