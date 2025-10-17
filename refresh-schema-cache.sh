#!/bin/bash

# Supabase Schema Cache 刷新脚本
# 当修改数据库表结构后需要运行此脚本

echo "🔄 正在刷新 Supabase Schema Cache..."

# 使用 service_role key（具有完整权限）
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.xf63TZNGy60zFFOeUTxw7LOI3bkXPOZDqm3eMHNLBOI"

# 发送 NOTIFY 命令刷新缓存
curl -X POST \
  "https://hvkzwrnvxsleeonqqrzq.supabase.co/rest/v1/rpc/pgrst_watch" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

echo ""
echo "✅ Schema cache 刷新请求已发送"
echo "⏳ 请等待 10-30 秒让缓存更新..."
echo ""
echo "💡 如果问题仍存在，请："
echo "   1. 前往 Supabase Dashboard"
echo "   2. Settings → API"
echo "   3. 点击 'Refresh' 按钮"
