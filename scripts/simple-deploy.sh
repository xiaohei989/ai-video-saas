#!/bin/bash

# 读取SQL文件
SQL_FILE="supabase/migrations/017_website_analytics.sql"

echo "开始部署网站访问统计系统..."
echo "正在执行SQL文件: $SQL_FILE"

# 使用psql直接连接并执行
PGPASSWORD="huixiangyigou2025!" psql \
  -h db.hvkzwrnvxsleeonqqrzq.supabase.co \
  -p 5432 \
  -d postgres \
  -U postgres.hvkzwrnvxsleeonqqrzq \
  -f "$SQL_FILE"

if [ $? -eq 0 ]; then
  echo "✓ 部署成功!"
else
  echo "✗ 部署失败,请检查错误信息"
  exit 1
fi