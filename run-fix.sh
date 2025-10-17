#!/bin/bash

# 修复卡在"生成缩略图中..."的视频
echo "🔧 开始修复卡住的缩略图..."
echo ""

# 执行SQL修复脚本
PGPASSWORD="huixiangyigou2025!" psql \
  -h db.hvkzwrnvxsleeonqqrzq.supabase.co \
  -p 5432 \
  -d postgres \
  -U postgres \
  -f fix-stuck-thumbnails.sql

echo ""
echo "✅ 修复脚本执行完成"
echo "⏰ 请等待3-5分钟让缩略图生成"
echo "🔄 之后刷新浏览器页面查看结果"
