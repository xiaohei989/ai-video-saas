#!/bin/bash

# Redis凭证配置脚本
# 使用方法：./setup-redis-credentials.sh <REDIS_URL> <REDIS_TOKEN>

set -e

echo "🔧 配置Upstash Redis凭证..."

# 检查参数
if [ $# -ne 2 ]; then
    echo "❌ 使用方法: $0 <UPSTASH_REDIS_REST_URL> <UPSTASH_REDIS_REST_TOKEN>"
    echo ""
    echo "📋 步骤："
    echo "1. 访问 https://console.upstash.com/"
    echo "2. 创建新的Redis数据库 (选择Global类型)"
    echo "3. 从 Details > REST API 复制URL和Token"
    echo "4. 运行: $0 'https://your-redis.upstash.io' 'your-token-here'"
    exit 1
fi

REDIS_URL="$1"
REDIS_TOKEN="$2"

echo "🔑 设置Redis环境变量..."

# 设置Supabase Edge Functions环境变量
echo "📤 配置Supabase secrets..."
# 从环境变量读取Access Token，如果没有则使用默认值
ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN:-"sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb"}
SUPABASE_ACCESS_TOKEN=$ACCESS_TOKEN supabase secrets set UPSTASH_REDIS_REST_URL="$REDIS_URL"
SUPABASE_ACCESS_TOKEN=$ACCESS_TOKEN supabase secrets set UPSTASH_REDIS_REST_TOKEN="$REDIS_TOKEN"

echo "✅ Redis凭证配置完成！"

# 验证配置
echo "🔍 验证配置..."
echo "当前Supabase secrets:"
SUPABASE_ACCESS_TOKEN=$ACCESS_TOKEN supabase secrets list

echo ""
echo "🚀 下一步："
echo "1. 运行 ./deploy-redis-functions.sh 部署Edge Functions"
echo "2. 测试Redis连接状态"