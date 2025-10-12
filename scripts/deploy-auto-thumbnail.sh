#!/bin/bash

# ========================================
# 自动缩略图系统部署脚本
# ========================================

set -e  # 遇到错误立即退出

echo "=========================================="
echo "🚀 部署后端自动缩略图生成系统"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查必要工具
echo "📋 检查必要工具..."

if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到 npx 命令${NC}"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  警告: 未找到 psql 命令${NC}"
    echo "数据库迁移将通过 Supabase CLI 执行"
fi

echo -e "${GREEN}✅ 工具检查完成${NC}"
echo ""

# 检查环境变量
echo "🔍 检查环境变量配置..."

if [ -z "$CLOUDINARY_CLOUD_NAME" ]; then
    echo -e "${YELLOW}⚠️  警告: CLOUDINARY_CLOUD_NAME 未设置${NC}"
    echo ""
    echo "请按以下步骤操作："
    echo "1. 访问 https://cloudinary.com 注册免费账号"
    echo "2. 复制 Dashboard 中的 Cloud name"
    echo "3. 在 .env.local 文件中添加："
    echo "   CLOUDINARY_CLOUD_NAME=your_cloud_name"
    echo ""
    read -p "是否已配置？继续部署可能失败 (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "部署已取消"
        exit 1
    fi
else
    echo -e "${GREEN}✅ CLOUDINARY_CLOUD_NAME: $CLOUDINARY_CLOUD_NAME${NC}"
fi

echo ""

# 步骤1: 部署 Edge Function
echo "=========================================="
echo "📦 步骤1: 部署 Edge Function"
echo "=========================================="

echo "正在部署 auto-generate-thumbnail..."

if npx supabase functions deploy auto-generate-thumbnail; then
    echo -e "${GREEN}✅ Edge Function 部署成功${NC}"
else
    echo -e "${RED}❌ Edge Function 部署失败${NC}"
    echo "请检查 Supabase CLI 配置和网络连接"
    exit 1
fi

echo ""

# 步骤2: 执行数据库迁移
echo "=========================================="
echo "🗄️  步骤2: 执行数据库迁移"
echo "=========================================="

echo "正在应用 021_auto_thumbnail_trigger.sql..."

if npx supabase db push; then
    echo -e "${GREEN}✅ 数据库迁移成功${NC}"
else
    echo -e "${RED}❌ 数据库迁移失败${NC}"
    echo "请手动在 Supabase Dashboard SQL Editor 中执行："
    echo "  supabase/migrations/021_auto_thumbnail_trigger.sql"
    exit 1
fi

echo ""

# 步骤3: 配置环境变量
echo "=========================================="
echo "⚙️  步骤3: 配置 Supabase 环境变量"
echo "=========================================="

echo ""
echo "请在 Supabase Dashboard 配置以下环境变量："
echo ""
echo "1. 打开: Settings -> Edge Functions -> Environment Variables"
echo "2. 添加变量:"
echo -e "${YELLOW}   CLOUDINARY_CLOUD_NAME = $CLOUDINARY_CLOUD_NAME${NC}"
echo ""
read -p "配置完成后按回车继续..."

echo ""

# 步骤4: 配置数据库 Secrets
echo "=========================================="
echo "🔐 步骤4: 配置数据库 Secrets"
echo "=========================================="

echo ""
echo "需要在 SQL Editor 执行以下配置（一次性配置）:"
echo ""
echo -e "${YELLOW}-- 替换为你的实际值${NC}"
echo "ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';"
echo "ALTER DATABASE postgres SET app.settings.service_role_key = 'your_service_role_key';"
echo "ALTER DATABASE postgres SET app.settings.project_ref = 'your-project-ref';"
echo ""
echo "获取方式:"
echo "  - Supabase URL: Settings -> API -> Project URL"
echo "  - Service Role Key: Settings -> API -> service_role (secret)"
echo "  - Project Ref: Settings -> General -> Reference ID"
echo ""
read -p "配置完成后按回车继续..."

echo ""

# 步骤5: 验证部署
echo "=========================================="
echo "✅ 步骤5: 验证部署"
echo "=========================================="

echo ""
echo "执行测试查询验证触发器..."

# 尝试查询触发器
echo ""
echo "SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'on_video_completed_auto_thumbnail';" | npx supabase db execute || {
    echo -e "${YELLOW}⚠️  无法自动验证，请手动检查${NC}"
}

echo ""

# 完成
echo "=========================================="
echo "🎉 部署完成！"
echo "=========================================="

echo ""
echo "接下来的步骤:"
echo ""
echo "1. 测试单个视频:"
echo "   SELECT manually_trigger_thumbnail_generation('video-id');"
echo ""
echo "2. 批量处理历史视频:"
echo "   SELECT batch_trigger_thumbnail_generation(10);"
echo ""
echo "3. 查看待处理视频:"
echo "   SELECT * FROM videos_pending_auto_thumbnails;"
echo ""
echo "4. 查看日志:"
echo "   npx supabase functions logs auto-generate-thumbnail --tail"
echo ""
echo -e "${GREEN}✨ 系统已就绪！视频完成时将自动生成缩略图${NC}"
echo ""
echo "详细文档: docs/AUTO_THUMBNAIL_DEPLOYMENT.md"
echo ""
