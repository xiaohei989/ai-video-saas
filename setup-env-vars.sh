#!/bin/bash

# Supabase Edge Functions 环境变量配置脚本
# 使用方法: ./setup-env-vars.sh

echo "🔧 开始配置Supabase Edge Functions环境变量..."

# 检查Supabase CLI是否已安装
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI未安装，请先安装："
    echo "npm install -g supabase"
    exit 1
fi

# 项目信息
PROJECT_REF="hvkzwrnvxsleeonqqrzq"
echo "✅ 使用项目ID: $PROJECT_REF"

# 必需的环境变量列表
echo ""
echo "📝 需要配置的环境变量："
echo "1. SUPABASE_URL - Supabase项目URL"
echo "2. SUPABASE_ANON_KEY - Supabase匿名密钥"
echo "3. SUPABASE_SERVICE_ROLE_KEY - Supabase服务角色密钥"
echo "4. STRIPE_SECRET_KEY - Stripe密钥"
echo "5. STRIPE_WEBHOOK_SIGNING_SECRET - Stripe Webhook签名密钥"
echo ""

# 设置基础Supabase环境变量
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
echo "🔧 设置SUPABASE_URL..."
supabase secrets set SUPABASE_URL="$SUPABASE_URL" --project-ref="$PROJECT_REF"

# 从本地配置文件读取密钥
if [ -f ".env.local" ]; then
    echo "📄 从.env.local文件读取配置..."
    
    # 提取Service Role Key
    SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)
    if [ ! -z "$SERVICE_ROLE_KEY" ]; then
        echo "🔧 设置SUPABASE_SERVICE_ROLE_KEY..."
        supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" --project-ref="$PROJECT_REF"
    fi
else
    echo "⚠️  未找到.env.local文件，请手动设置密钥"
fi

# 需要手动设置的环境变量
echo ""
echo "⚠️  以下环境变量需要手动配置："
echo ""
echo "1. 设置Supabase匿名密钥："
echo "   supabase secrets set SUPABASE_ANON_KEY=\"your_anon_key\" --project-ref=\"$PROJECT_REF\""
echo ""
echo "2. 设置Stripe密钥："
echo "   supabase secrets set STRIPE_SECRET_KEY=\"sk_test_...\" --project-ref=\"$PROJECT_REF\""
echo ""
echo "3. 设置Stripe Webhook签名密钥："
echo "   supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=\"whsec_...\" --project-ref=\"$PROJECT_REF\""
echo ""

# 显示当前环境变量
echo "📋 查看当前配置的环境变量："
supabase secrets list --project-ref="$PROJECT_REF"

echo ""
echo "✅ 环境变量配置完成！"
echo ""
echo "📝 接下来的步骤："
echo "1. 在Stripe Dashboard获取API密钥和Webhook签名密钥"
echo "2. 在Supabase Dashboard获取匿名密钥"
echo "3. 运行上述手动配置命令"
echo "4. 重新部署Edge Functions"