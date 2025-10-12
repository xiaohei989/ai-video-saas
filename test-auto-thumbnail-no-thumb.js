/**
 * 测试自动缩略图生成功能 - 找没有缩略图的视频
 * 运行: node test-auto-thumbnail-no-thumb.js
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

  // 步骤1: 查找没有缩略图或只有 SVG 占位符的视频
  console.log('📹 步骤1: 查找需要生成缩略图的视频...');
  const { data: videos, error: fetchError } = await supabase
    .from('videos')
    .select('id, title, video_url, thumbnail_url, status, created_at')
    .eq('status', 'completed')
    .not('video_url', 'is', null)
    .or('thumbnail_url.is.null,thumbnail_url.like.data:image/svg%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (fetchError) {
    console.error('❌ 查询视频失败:', fetchError);
    process.exit(1);
  }

  if (!videos || videos.length === 0) {
    console.log('⚠️  没有找到需要生成缩略图的视频');
    console.log('ℹ️  所有已完成的视频都已有缩略图\n');

    // 显示统计信息
    const { data: allVideos } = await supabase
      .from('videos')
      .select('status')
      .eq('status', 'completed')
      .not('video_url', 'is', null);

    console.log(`📊 数据统计: 共有 ${allVideos?.length || 0} 个已完成的视频`);
    process.exit(0);
  }

  console.log(`✅ 找到 ${videos.length} 个需要生成缩略图的视频:\n`);
  videos.forEach((v, idx) => {
    console.log(`${idx + 1}. ${v.title || 'Untitled'}`);
    console.log(`   ID: ${v.id}`);
    console.log(`   Video URL: ${v.video_url}`);
    console.log(`   Thumbnail: ${v.thumbnail_url ? 'SVG占位符' : '无'}\n`);
  });

  const video = videos[0];
  console.log(`🎯 选择第一个视频进行测试: ${video.title || video.id}\n`);

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
    process.exit(1);
  }

  console.log(`✅ HTTP 请求已发送到 Edge Function (response_id: ${triggerResult.responseId})\n`);

  // 步骤3: 等待并检查结果
  console.log('⏳ 步骤3: 等待缩略图生成...');

  for (let i = 1; i <= 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log(`   检查 ${i}/6 (已等待 ${i * 5} 秒)...`);

    const { data: updatedVideo, error: checkError } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, thumbnail_generated_at, updated_at')
      .eq('id', video.id)
      .single();

    if (checkError) {
      console.error('   ❌ 查询失败:', checkError);
      continue;
    }

    if (updatedVideo.thumbnail_url && !updatedVideo.thumbnail_url.startsWith('data:image/svg')) {
      console.log('\n✅ 测试成功！缩略图已自动生成');
      console.log(`🖼️  缩略图 URL: ${updatedVideo.thumbnail_url}`);
      console.log(`⏰ 生成时间: ${updatedVideo.thumbnail_generated_at || updatedVideo.updated_at}\n`);
      return;
    }
  }

  console.log('\n⚠️  30秒后缩略图仍未生成，可能原因：');
  console.log('   1. Edge Function 处理时间较长');
  console.log('   2. Cloudinary API 调用失败');
  console.log('   3. 视频 URL 无法访问');
  console.log('   4. pg_net HTTP 请求失败');
  console.log('\n💡 调试建议：');
  console.log('   1. 查看 Edge Function 日志:');
  console.log('      npx supabase functions logs auto-generate-thumbnail --tail');
  console.log('   2. 检查触发器日志（在 Supabase Dashboard 的 Logs 中）');
  console.log('   3. 手动访问视频 URL 确认可访问性');
  console.log(`      ${video.video_url}\n`);
}

// 运行测试
testAutoThumbnail().catch(console.error);
