#!/bin/bash

# 更新 Supabase Google OAuth 配置，启用 skip_nonce_check

echo "正在更新 Google OAuth 配置..."

curl -X PATCH "https://api.supabase.com/v1/projects/hvkzwrnvxsleeonqqrzq/config/auth" \
  -H "Authorization: Bearer sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb" \
  -H "Content-Type: application/json" \
  -d '{"EXTERNAL_GOOGLE_SKIP_NONCE_CHECK":true}' \
  > /tmp/supabase_response.json

echo ""
echo "响应已保存到 /tmp/supabase_response.json"
echo ""
echo "检查 skip_nonce_check 配置:"
cat /tmp/supabase_response.json | grep -o '"external_google[^}]*}' | head -5

echo ""
echo "完成！"
