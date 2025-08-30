#!/bin/bash

# Supabase Edge Functions 部署脚本
# 使用方法: ./deploy-functions.sh

echo "🚀 开始部署Supabase Edge Functions..."

# 检查Supabase CLI是否已安装
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI未安装，请先安装："
    echo "npm install -g supabase"
    exit 1
fi

# 检查是否已登录
if ! supabase status > /dev/null 2>&1; then
    echo "⚠️  请先登录Supabase："
    echo "supabase login"
    echo ""
    echo "然后链接到您的项目："
    echo "supabase link --project-ref YOUR_PROJECT_ID"
    exit 1
fi

echo "✅ Supabase CLI已准备就绪"

# 部署create-checkout-session函数
echo ""
echo "📦 部署create-checkout-session函数..."
if supabase functions deploy create-checkout-session --no-verify-jwt; then
    echo "✅ create-checkout-session函数部署成功"
else
    echo "❌ create-checkout-session函数部署失败"
    exit 1
fi

# 部署stripe-webhook函数
echo ""
echo "📦 部署stripe-webhook函数..."
if supabase functions deploy stripe-webhook --no-verify-jwt; then
    echo "✅ stripe-webhook函数部署成功"
else
    echo "❌ stripe-webhook函数部署失败"
    exit 1
fi

# 部署update-video-status函数
echo ""
echo "📦 部署update-video-status函数..."
if supabase functions deploy update-video-status --no-verify-jwt; then
    echo "✅ update-video-status函数部署成功"
else
    echo "❌ update-video-status函数部署失败"
    exit 1
fi

# 部署create-portal-session函数
echo ""
echo "📦 部署create-portal-session函数..."
if supabase functions deploy create-portal-session --no-verify-jwt; then
    echo "✅ create-portal-session函数部署成功"
else
    echo "❌ create-portal-session函数部署失败"
    exit 1
fi

# 部署cancel-subscription函数
echo ""
echo "📦 部署cancel-subscription函数..."
if supabase functions deploy cancel-subscription --no-verify-jwt; then
    echo "✅ cancel-subscription函数部署成功"
else
    echo "❌ cancel-subscription函数部署失败"
    exit 1
fi

# 部署resume-subscription函数
echo ""
echo "📦 部署resume-subscription函数..."
if supabase functions deploy resume-subscription --no-verify-jwt; then
    echo "✅ resume-subscription函数部署成功"
else
    echo "❌ resume-subscription函数部署失败"
    exit 1
fi

echo ""
echo "🎉 所有Edge Functions部署完成！"
echo ""
echo "📝 接下来的步骤："
echo "1. 在Supabase控制台设置环境变量"
echo "2. 在Stripe Dashboard配置Webhook端点"
echo "3. 测试支付流程"
echo ""
echo "函数URL格式:"
echo "https://YOUR_PROJECT_REF.supabase.co/functions/v1/FUNCTION_NAME"