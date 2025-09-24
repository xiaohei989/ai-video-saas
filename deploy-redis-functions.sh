#!/bin/bash

# Redis Edge Functions部署脚本

set -e

echo "🚀 部署Redis相关Edge Functions..."

# 设置访问令牌 - 优先使用环境变量，否则使用默认值
export SUPABASE_ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN:-"sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb"}

echo "📤 部署get-cached-data函数..."
supabase functions deploy get-cached-data --no-verify-jwt

echo "📤 重新部署batch-update-counters函数..."
supabase functions deploy batch-update-counters --no-verify-jwt

echo "✅ 所有函数部署完成！"

echo ""
echo "🔍 验证部署状态..."
supabase functions list

echo ""
echo "🧪 测试Redis连接..."

# 测试get-cached-data函数
echo "测试缓存函数..."
curl -X POST "https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/get-cached-data" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk" \
  -d '{"action": "get", "key": "test_key"}' | jq '.'

echo ""

# 测试batch-update-counters函数
echo "测试计数器函数..."
curl -X GET "https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/batch-update-counters" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk" | jq '.'

echo ""
echo "🎉 Redis修复完成！"
echo ""
echo "📊 下一步："
echo "1. 访问网站测试缓存性能"
echo "2. 查看浏览器控制台确认Redis连接状态"
echo "3. 监控缓存命中率和系统性能"