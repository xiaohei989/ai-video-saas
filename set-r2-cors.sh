#!/bin/bash

# Cloudflare API设置CORS
# 账户ID
ACCOUNT_ID="c6fc8bcf3bba37f2611b6f3d7aad25b9"
BUCKET_NAME="ai-video-storage"

# 获取Cloudflare API Token (从wrangler config)
API_TOKEN=$(wrangler whoami 2>/dev/null | grep "API Token" | awk '{print $3}' | sed 's/^.\(.*\).$/\1/')

if [ -z "$API_TOKEN" ]; then
    echo "❌ 无法获取API Token"
    exit 1
fi

echo "🔧 设置R2存储桶CORS策略..."
echo "账户ID: $ACCOUNT_ID"
echo "存储桶: $BUCKET_NAME"

# CORS配置JSON
CORS_CONFIG='{
  "rules": [
    {
      "allowed_origins": ["*"],
      "allowed_methods": ["GET", "HEAD"],
      "allowed_headers": ["*"],
      "max_age": 3600
    }
  ]
}'

# 调用API
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET_NAME}/cors" \
     -H "Authorization: Bearer ${API_TOKEN}" \
     -H "Content-Type: application/json" \
     -d "${CORS_CONFIG}" \
     --silent --show-error | jq '.'