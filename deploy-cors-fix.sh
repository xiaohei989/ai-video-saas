#!/bin/bash

# Cloudflare CORS Worker 部署脚本
# 解决 Transform API 跨域问题

echo "🚀 开始部署 Cloudflare CORS Worker..."

# 检查 wrangler 是否已安装
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI 未安装，正在安装..."
    npm install -g wrangler
fi

# 检查是否已登录
echo "🔐 检查 Cloudflare 登录状态..."
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  请先登录 Cloudflare:"
    echo "   wrangler auth login"
    exit 1
fi

# 部署 Worker
echo "📦 部署 CORS Worker..."
wrangler deploy cloudflare-cors-worker.js --config wrangler-cors.toml --env production

if [ $? -eq 0 ]; then
    echo "✅ CORS Worker 部署成功！"
    echo ""
    echo "🔧 接下来需要手动配置路由规则："
    echo "1. 进入 Cloudflare Dashboard"
    echo "2. 选择域名 veo3video.me"
    echo "3. 进入 Workers Routes"
    echo "4. 添加路由: cdn.veo3video.me/cdn-cgi/image/*"
    echo "5. 选择 Worker: veo3video-image-cors-prod"
    echo ""
    echo "🧪 测试 CORS 配置："
    echo "curl -H \"Origin: http://localhost:3000\" -X OPTIONS https://cdn.veo3video.me/cdn-cgi/image/w=450,q=95,f=auto/templates/thumbnails/test.jpg"
else
    echo "❌ Worker 部署失败，请检查配置"
    exit 1
fi