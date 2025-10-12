/**
 * 测试自动缩略图生成功能
 * 运行: node test-auto-thumbnail.js
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY 未配置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAutoThumbnail() {
  console.log('🧪 开始测试自动缩略图生成功能\n');

  // 步骤1: 获取最新完成的视频（没有真实缩略图的）
  console.log('📹 步骤1: 查找最新的完成视频...');
  const { data: videos, error: fetchError } = await supabase
    .from('videos')
    .select('id, title, video_url, thumbnail_url, status, created_at')
    .eq('status', 'completed')
    .not('video_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchError) {
    console.error('❌ 查询视频失败:', fetchError);
    process.exit(1);
  }

  if (!videos || videos.length === 0) {
    console.log('⚠️  没有找到符合条件的视频');
    process.exit(0);
  }

  const video = videos[0];
  console.log(`✅ 找到视频: ${video.title}`);
  console.log(`   ID: ${video.id}`);
  console.log(`   Video URL: ${video.video_url}`);
  console.log(`   Thumbnail: ${video.thumbnail_url ? (video.thumbnail_url.startsWith('data:image/svg') ? 'SVG占位符' : '已有缩略图') : '无'}\n`);

  // 步骤2: 调用手动触发函数
  console.log('🚀 步骤2: 手动触发缩略图生成...');
  const { data: triggerResult, error: triggerError } = await supabase.rpc(
    'manually_trigger_thumbnail_generation',
    { p_video_id: video.id }
  );

  if (triggerError) {
    console.error('❌ 触发失败:', triggerError);
    process.exit(1);
  }

  console.log('✅ 触发结果:', JSON.stringify(triggerResult, null, 2));

  if (!triggerResult.success) {
    console.log('⚠️  触发未成功，原因:', triggerResult.error);
    if (triggerResult.error === 'Thumbnail already exists') {
      console.log('ℹ️  该视频已有缩略图，跳过生成\n');
    }
    process.exit(0);
  }

  console.log(`✅ HTTP 请求已发送 (response_id: ${triggerResult.responseId})\n`);

  // 步骤3: 等待并检查结果
  console.log('⏳ 步骤3: 等待缩略图生成 (10秒)...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  const { data: updatedVideo, error: checkError } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, thumbnail_generated_at, updated_at')
    .eq('id', video.id)
    .single();

  if (checkError) {
    console.error('❌ 查询更新后的视频失败:', checkError);
    process.exit(1);
  }

  console.log('📊 生成结果:');
  console.log(`   Thumbnail URL: ${updatedVideo.thumbnail_url || '仍为空'}`);
  console.log(`   Generated At: ${updatedVideo.thumbnail_generated_at || '未设置'}`);
  console.log(`   Updated At: ${updatedVideo.updated_at}\n`);

  if (updatedVideo.thumbnail_url && !updatedVideo.thumbnail_url.startsWith('data:image/svg')) {
    console.log('✅ 测试成功！缩略图已自动生成');
    console.log(`🖼️  缩略图预览: ${updatedVideo.thumbnail_url}\n`);
  } else {
    console.log('⚠️  缩略图尚未生成，可能原因：');
    console.log('   1. Edge Function 处理时间较长（>10秒）');
    console.log('   2. Cloudinary API 调用失败');
    console.log('   3. 视频 URL 无法访问');
    console.log('\n💡 建议：查看 Edge Function 日志');
    console.log('   运行: npx supabase functions logs auto-generate-thumbnail --tail\n');
  }

  // 步骤4: 显示待处理视频数量
  const { count, error: countError } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .not('video_url', 'is', null)
    .or('thumbnail_url.is.null,thumbnail_url.like.data:image/svg%');

  if (!countError) {
    console.log(`📊 数据统计: 共有 ${count} 个视频等待生成缩略图`);
  }
}

// 运行测试
testAutoThumbnail().catch(console.error);
