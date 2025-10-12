import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查新生成视频的缩略图状态\n');

const { data: videos, error } = await supabase
  .from('videos')
  .select('id, title, status, video_url, thumbnail_url, thumbnail_generated_at, thumbnail_metadata, created_at')
  .ilike('title', '%Amazing Surveillance Animal Trampoline%')
  .order('created_at', { ascending: false })
  .limit(1);

if (error) {
  console.error('❌ 查询失败:', error.message);
  process.exit(1);
}

if (!videos || videos.length === 0) {
  console.log('⚠️  未找到标题包含 "Amazing Surveillance Animal Trampoline" 的视频');
  console.log('\n查找最近的视频...');
  
  const { data: recentVideos } = await supabase
    .from('videos')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\n最近的 5 个视频:');
  recentVideos?.forEach((v, idx) => {
    console.log(`${idx + 1}. [${v.status}] ${v.title}`);
    console.log(`   ID: ${v.id}`);
    console.log(`   创建时间: ${v.created_at}\n`);
  });
  process.exit(0);
}

const video = videos[0];

console.log('📹 视频信息:');
console.log('='.repeat(60));
console.log(`标题: ${video.title}`);
console.log(`ID: ${video.id}`);
console.log(`状态: ${video.status}`);
console.log(`创建时间: ${video.created_at}`);
console.log(`视频 URL: ${video.video_url || '(未生成)'}`);
console.log('');

const hasThumbnail = video.thumbnail_url && !video.thumbnail_url.startsWith('data:image/svg');

if (hasThumbnail) {
  console.log('✅ 缩略图已生成');
  console.log(`   URL: ${video.thumbnail_url}`);
  console.log(`   生成时间: ${video.thumbnail_generated_at}`);
  if (video.thumbnail_metadata) {
    console.log(`   元数据: ${JSON.stringify(video.thumbnail_metadata, null, 2)}`);
  }
} else {
  console.log('❌ 缩略图未生成');
  console.log(`   当前 URL: ${video.thumbnail_url || '(null)'}`);
  console.log('');
  
  // 检查触发器是否执行
  if (video.status === 'completed' && video.video_url) {
    console.log('💡 视频已完成但缩略图未生成，可能原因:');
    console.log('1. 触发器未触发');
    console.log('2. Edge Function 执行失败');
    console.log('3. 视频 URL 不在 Cloudflare CDN 上');
    console.log('');
    
    // 检查最近的 pg_net 响应
    console.log('📊 查看最近的 pg_net HTTP 响应...');
    const { data: responses } = await supabase
      .from('pg_net_recent_responses')
      .select('*')
      .order('created', { ascending: false })
      .limit(3);
    
    if (responses && responses.length > 0) {
      console.log(`✅ 最近 ${responses.length} 条响应:\n`);
      responses.forEach((r, idx) => {
        console.log(`${idx + 1}. [${r.status_summary}] HTTP ${r.status_code || 'N/A'}`);
        console.log(`   响应 ID: ${r.id}`);
        console.log(`   时间: ${r.created}`);
        console.log(`   错误: ${r.error_msg || '无'}`);
        if (r.content_preview) {
          console.log(`   内容: ${r.content_preview}`);
        }
        console.log('');
      });
    } else {
      console.log('⚠️  没有找到最近的 pg_net 响应');
    }
  } else if (video.status !== 'completed') {
    console.log(`💡 视频状态为 "${video.status}"，缩略图在视频完成后生成`);
  } else if (!video.video_url) {
    console.log('💡 视频 URL 为空，无法生成缩略图');
  }
}

console.log('='.repeat(60));
