#!/bin/bash

# 批量更新 Edge Functions 的 CORS 配置

FUNCTIONS_DIR="supabase/functions"

# 需要更新的函数列表（从客户端调用的函数）
CLIENT_FUNCTIONS=(
  "create-checkout-session"
  "create-portal-session"
  "cancel-subscription"
  "resume-subscription"
  "consume-credits"
  "add-credits"
  "clear-user-cache"
  "get-cached-data"
  "purge-cdn-cache"
  "create-short-link"
  "record-share-event"
  "user-tickets"
  "generate-upload-url"
  "upload-thumbnail"
  "delete-r2-file"
  "update-video-status"
  "migrate-video"
  "batch-update-counters"
  "social-cache"
  "admin-templates"
  "admin-users"
  "admin-orders"
  "admin-stats"
  "admin-tickets"
  "generate-blur-thumbnail"
)

echo "🔄 开始更新 Edge Functions CORS 配置..."
echo ""

for func in "${CLIENT_FUNCTIONS[@]}"; do
  func_file="$FUNCTIONS_DIR/$func/index.ts"

  if [ -f "$func_file" ]; then
    # 检查是否已经导入了共享 CORS
    if grep -q "from '../_shared/cors" "$func_file"; then
      echo "⏭️  $func - 已使用共享 CORS 配置"
    else
      echo "📝 $func - 需要手动更新"
    fi
  else
    echo "⚠️  $func - 文件不存在"
  fi
done

echo ""
echo "✅ 检查完成！"
echo ""
echo "📋 建议操作："
echo "1. 对于每个需要更新的函数，替换 CORS 代码为："
echo "   import { getCorsHeaders, handleCors } from '../_shared/cors.ts'"
echo ""
echo "2. 在函数开始处添加："
echo "   const corsResponse = handleCors(req)"
echo "   if (corsResponse) return corsResponse"
echo ""
echo "3. 在返回响应时使用："
echo "   const corsHeaders = getCorsHeaders(req.headers.get('origin'))"
echo "   return new Response(..., { headers: { ...corsHeaders, ... } })"
