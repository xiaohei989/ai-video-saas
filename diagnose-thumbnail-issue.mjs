#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// 从环境变量读取配置 - 使用SERVICE_ROLE_KEY以获取完整权限
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ 缺少 SUPABASE_SERVICE_ROLE_KEY 或 VITE_SUPABASE_ANON_KEY 环境变量');
  process.exit(1);
}

console.log(`🔑 使用 ${supabaseKey.substring(0, 20)}... 连接到 ${supabaseUrl}\n`);

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 开始诊断吸血鬼视频缩略图问题...\n');

try {
  // 查询吸血鬼相关视频
  const { data: videos, error } = await supabase
    .from('videos')
    .select('*')
    .ilike('title', '%吸血鬼%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ 查询失败:', error);
    process.exit(1);
  }

  console.log(`📊 找到 ${videos.length} 个吸血鬼相关视频\n`);

  videos.forEach((video, index) => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`视频 #${index + 1}: ${video.title}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📌 ID: ${video.id}`);
    console.log(`📌 状态: ${video.status}`);
    console.log(`📌 视频URL: ${video.video_url ? '✅ 存在' : '❌ 缺失'}`);
    if (video.video_url) {
      console.log(`   └─ ${video.video_url.substring(0, 80)}...`);
    }

    console.log(`\n📸 缩略图状态:`);
    console.log(`   ├─ thumbnail_url: ${video.thumbnail_url ? (video.thumbnail_url.startsWith('data:image/svg') ? '⚠️  SVG占位符' : '✅ 真实图片') : '❌ NULL'}`);
    if (video.thumbnail_url && !video.thumbnail_url.startsWith('data:image/svg')) {
      console.log(`   │  └─ ${video.thumbnail_url.substring(0, 80)}...`);
    }
    console.log(`   ├─ thumbnail_blur_url: ${video.thumbnail_blur_url || '❌ NULL'}`);
    console.log(`   ├─ thumbnail_generated_at: ${video.thumbnail_generated_at || '❌ NULL'}`);

    if (video.thumbnail_generation_status !== undefined) {
      console.log(`\n🔄 新版缩略图生成状态:`);
      console.log(`   ├─ status: ${video.thumbnail_generation_status || '❌ NULL'}`);
      console.log(`   ├─ error: ${video.thumbnail_generation_error || '-'}`);
      console.log(`   ├─ attempts: ${video.thumbnail_generation_attempts || 0}`);
      console.log(`   └─ last_attempt: ${video.thumbnail_generation_last_attempt_at || '❌ NULL'}`);
    }

    console.log(`\n🚀 R2迁移状态:`);
    console.log(`   ├─ migration_status: ${video.migration_status || '❌ NULL'}`);
    console.log(`   ├─ r2_url: ${video.r2_url ? '✅ 存在' : '❌ NULL'}`);
    console.log(`   └─ r2_uploaded_at: ${video.r2_uploaded_at || '❌ NULL'}`);

    console.log(`\n⏰ 时间信息:`);
    console.log(`   ├─ 创建时间: ${video.created_at}`);
    const hoursAgo = ((Date.now() - new Date(video.created_at).getTime()) / 1000 / 3600).toFixed(1);
    console.log(`   └─ 创建了 ${hoursAgo} 小时前`);

    // 判断是否应该显示"生成缩略图中..."
    const shouldShowGenerating =
      video.status === 'completed' &&
      video.video_url &&
      (!video.thumbnail_url || video.thumbnail_url.includes('data:image/svg')) &&
      !video.thumbnail_blur_url;

    console.log(`\n🎯 前端显示判断:`);
    console.log(`   └─ 是否显示"生成缩略图中...": ${shouldShowGenerating ? '✅ 是' : '❌ 否'}`);
  });

  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 诊断总结`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const stuckVideos = videos.filter(v =>
    v.status === 'completed' &&
    v.video_url &&
    (!v.thumbnail_url || v.thumbnail_url.includes('data:image/svg')) &&
    !v.thumbnail_blur_url
  );

  console.log(`\n🔴 卡住的视频数量: ${stuckVideos.length}`);

  if (stuckVideos.length > 0) {
    console.log(`\n🔍 可能原因分析:`);

    const allMigrated = stuckVideos.every(v => v.migration_status === 'completed');
    const allHaveR2Url = stuckVideos.every(v => v.r2_url);
    const allOld = stuckVideos.every(v => {
      const hours = (Date.now() - new Date(v.created_at).getTime()) / 1000 / 3600;
      return hours > 1; // 超过1小时
    });

    console.log(`   ${allMigrated ? '✅' : '❌'} 所有视频迁移状态都是completed`);
    console.log(`   ${allHaveR2Url ? '✅' : '❌'} 所有视频都有R2 URL`);
    console.log(`   ${allOld ? '⚠️ ' : '✅'} 所有视频都超过1小时（触发器应该已执行）`);

    if (stuckVideos[0].thumbnail_generation_status === undefined) {
      console.log(`   ⚠️  数据库缺少 thumbnail_generation_status 字段（迁移025未执行？）`);
    } else {
      const statusCounts = stuckVideos.reduce((acc, v) => {
        const status = v.thumbnail_generation_status || 'null';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      console.log(`\n   📊 缩略图生成状态分布:`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`      - ${status}: ${count}个`);
      });
    }
  }

  console.log(`\n\n💡 建议修复步骤:`);
  console.log(`   1. 检查数据库迁移025是否已执行`);
  console.log(`   2. 检查触发器 on_video_completed_auto_thumbnail 是否存在`);
  console.log(`   3. 检查Edge Function auto-generate-thumbnail 是否部署`);
  console.log(`   4. 手动调用批量修复函数（如果存在）`);

} catch (error) {
  console.error('\n❌ 执行过程中出错:', error);
  process.exit(1);
}
