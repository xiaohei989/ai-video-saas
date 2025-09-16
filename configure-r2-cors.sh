#!/bin/bash

# R2 CORS配置脚本
# 配置Cloudflare R2存储桶的CORS设置以支持预签名URL上传

# 环境变量检查
if [ -z "$VITE_CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "❌ 错误: VITE_CLOUDFLARE_ACCOUNT_ID 环境变量未设置"
  exit 1
fi

if [ -z "$VITE_CLOUDFLARE_R2_ACCESS_KEY_ID" ]; then
  echo "❌ 错误: VITE_CLOUDFLARE_R2_ACCESS_KEY_ID 环境变量未设置"
  exit 1
fi

if [ -z "$VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY" ]; then
  echo "❌ 错误: VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY 环境变量未设置"
  exit 1
fi

BUCKET_NAME=${VITE_CLOUDFLARE_R2_BUCKET_NAME:-"ai-video-storage"}
ACCOUNT_ID=$VITE_CLOUDFLARE_ACCOUNT_ID
ACCESS_KEY_ID=$VITE_CLOUDFLARE_R2_ACCESS_KEY_ID
SECRET_ACCESS_KEY=$VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY

echo "🔧 配置R2 CORS设置..."
echo "📦 存储桶: $BUCKET_NAME"
echo "🆔 账户ID: $ACCOUNT_ID"

# 创建CORS配置文件
cat > r2-cors-config.json << EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://veo3video.me",
        "https://*.veo3video.me",
        "https://ai-video-saas.pages.dev"
      ],
      "AllowedMethods": [
        "GET",
        "PUT", 
        "POST",
        "DELETE",
        "HEAD"
      ],
      "AllowedHeaders": [
        "*",
        "authorization",
        "content-type",
        "content-length",
        "content-md5",
        "cache-control",
        "x-amz-content-sha256",
        "x-amz-date",
        "x-amz-security-token",
        "x-amz-user-agent",
        "x-amz-acl"
      ],
      "ExposeHeaders": [
        "ETag",
        "x-amz-request-id",
        "x-amz-id-2"
      ],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

echo "📄 CORS配置文件已创建: r2-cors-config.json"

# 使用AWS CLI配置CORS
echo "🚀 应用CORS配置到R2存储桶..."

AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY \
aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration file://r2-cors-config.json \
  --endpoint-url https://$ACCOUNT_ID.r2.cloudflarestorage.com

if [ $? -eq 0 ]; then
  echo "✅ CORS配置成功应用到存储桶: $BUCKET_NAME"
else
  echo "❌ CORS配置失败"
  exit 1
fi

# 验证CORS配置
echo "🔍 验证CORS配置..."
AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY \
aws s3api get-bucket-cors \
  --bucket $BUCKET_NAME \
  --endpoint-url https://$ACCOUNT_ID.r2.cloudflarestorage.com

echo ""
echo "🎉 R2 CORS配置完成！"
echo "📝 配置详情:"
echo "   - 允许的域名: localhost, veo3video.me, pages.dev"
echo "   - 允许的方法: GET, PUT, POST, DELETE, HEAD"
echo "   - 缓存时间: 3600秒 (1小时)"
echo ""
echo "🧪 现在可以测试预签名URL上传功能"

# 清理临时文件
rm -f r2-cors-config.json