#!/bin/bash

echo "🧪 测试缩略图生成 - Bouncing Piglets"
echo ""

# 读取环境变量
source .env.local 2>/dev/null || source .env 2>/dev/null

VIDEO_ID="b76676eb-69ea-4d50-92e6-9b325d9eda78"
VIDEO_URL="https://cdn.veo3video.me/videos/b76676eb-69ea-4d50-92e6-9b325d9eda78.mp4"

echo "📹 视频信息:"
echo "   ID: $VIDEO_ID"
echo "   URL: $VIDEO_URL"
echo ""

echo "🚀 调用 Edge Function..."
echo ""

curl -X POST \
  "https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/auto-generate-thumbnail" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d "{\"videoId\":\"$VIDEO_ID\",\"videoUrl\":\"$VIDEO_URL\"}" \
  --max-time 180 \
  -w "\n\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\n"

echo ""
echo "✅ 测试完成"
