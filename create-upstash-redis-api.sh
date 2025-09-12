#!/bin/bash

# 使用Upstash REST API自动创建Redis实例
# 需要Upstash API密钥：https://console.upstash.com/account/api

set -e

echo "🔧 使用Upstash API自动创建Redis实例..."

# 检查是否提供了API密钥
if [ -z "$UPSTASH_API_KEY" ]; then
    echo "❌ 需要设置UPSTASH_API_KEY环境变量"
    echo ""
    echo "📋 获取API密钥步骤："
    echo "1. 访问 https://console.upstash.com/account/api"
    echo "2. 创建新的API密钥"
    echo "3. 运行: export UPSTASH_API_KEY='your-api-key-here'"
    echo "4. 重新运行此脚本"
    exit 1
fi

# Redis数据库配置
DATABASE_NAME="ai-video-saas-cache"
REGION="global"  # 全球分布获得最低延迟
TLS_ENABLED=true

echo "📤 创建Redis数据库: $DATABASE_NAME"

# 调用Upstash API创建数据库
RESPONSE=$(curl -s -X POST "https://api.upstash.com/v2/redis/database" \
  -H "Authorization: Bearer $UPSTASH_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$DATABASE_NAME\",
    \"region\": \"$REGION\",
    \"tls\": $TLS_ENABLED
  }")

# 检查响应
if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ 创建Redis实例失败:"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

echo "✅ Redis实例创建成功!"

# 提取连接信息
DATABASE_ID=$(echo "$RESPONSE" | jq -r '.database_id')
REDIS_URL=$(echo "$RESPONSE" | jq -r '.endpoint')
REDIS_TOKEN=$(echo "$RESPONSE" | jq -r '.rest_token')

echo ""
echo "🔑 Redis连接信息:"
echo "Database ID: $DATABASE_ID"
echo "URL: $REDIS_URL"
echo "Token: $REDIS_TOKEN"

echo ""
echo "🚀 自动配置Supabase环境变量..."

# 自动配置Supabase
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase secrets set UPSTASH_REDIS_REST_URL="$REDIS_URL"
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase secrets set UPSTASH_REDIS_REST_TOKEN="$REDIS_TOKEN"

echo "✅ 全自动Redis设置完成!"

echo ""
echo "📊 下一步:"
echo "1. 运行 ./deploy-redis-functions.sh 部署Functions"
echo "2. 访问网站验证缓存性能提升"
echo ""
echo "💰 成本信息："
echo "- 免费层: 10,000请求/天"
echo "- 付费层: $0.2/100K请求"