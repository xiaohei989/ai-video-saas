#!/bin/bash
# 应用缩略图触发器修复

set -e

echo "========================================="
echo "🔧 应用缩略图触发器修复"
echo "========================================="
echo ""

# 检查环境变量
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ 错误: 缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量"
  echo "请运行: export SUPABASE_SERVICE_ROLE_KEY=your_key"
  exit 1
fi

DB_HOST="db.hvkzwrnvxsleeonqqrzq.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="huixiangyigou2025!"

echo "📦 步骤 1: 应用数据库迁移..."
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -U "$DB_USER" \
  -f supabase/migrations/027_fix_thumbnail_trigger_for_failed_migrations.sql

if [ $? -eq 0 ]; then
  echo "✅ 迁移应用成功"
else
  echo "❌ 迁移应用失败"
  exit 1
fi

echo ""
echo "🔄 步骤 2: 触发现有视频的缩略图生成..."
RESULT=$(PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -U "$DB_USER" \
  -t -A \
  -c "SELECT manually_trigger_thumbnails_for_failed_migrations();")

echo "📊 执行结果:"
echo "$RESULT" | jq '.'

echo ""
echo "========================================="
echo "✅ 修复应用完成！"
echo "========================================="
echo ""
echo "💡 后续步骤:"
echo "  1. 等待 5-10 分钟让 Edge Function 处理缩略图"
echo "  2. 运行检查脚本: node scripts/check-recent-videos-migration.js"
echo "  3. 查看缩略图生成状态"
echo ""
