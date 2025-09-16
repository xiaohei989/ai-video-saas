#!/bin/bash

# 使用S3 API设置R2 CORS (因为R2兼容S3)
ACCOUNT_ID="c6fc8bcf3bba37f2611b6f3d7aad25b9"
ACCESS_KEY="57c7b53c14b7d962b9a2187e8764a835"
SECRET_KEY="69265850a7e9d5f18f5ebb6f2cf5b6b8ad48d54c2ae722611d1d281e401684a8"
BUCKET_NAME="ai-video-storage"
ENDPOINT="https://${ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "🔧 尝试通过S3 API设置R2 CORS..."

# 使用aws cli (如果安装了)
if command -v aws &> /dev/null; then
    echo "使用AWS CLI设置CORS..."
    
    # 创建CORS配置文件
    cat > cors.json << EOF
{
    "CORSRules": [
        {
            "AllowedOrigins": ["*"],
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedHeaders": ["*"],
            "MaxAgeSeconds": 3600
        }
    ]
}
EOF
    
    # 设置CORS
    aws s3api put-bucket-cors \
        --bucket "$BUCKET_NAME" \
        --cors-configuration file://cors.json \
        --endpoint-url "$ENDPOINT" \
        --profile r2
        
    echo "✅ CORS配置已设置"
    rm cors.json
else
    echo "❌ AWS CLI未安装，请手动在Cloudflare Dashboard中设置CORS"
    echo "或者安装AWS CLI: brew install awscli"
fi