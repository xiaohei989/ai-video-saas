import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查 Mechanical Dragon 视频\n');

const { data: videos } = await supabase
  .from('videos')
  .select('id, title, status, video_url, thumbnail_url, thumbnail_generated_at, created_at')
  .ilike('title', '%Mechanical Dragon%')
  .order('created_at', { ascending: false })
  .limit(1);

if (!videos || videos.length === 0) {
  console.log('❌ 未找到视频');
  process.exit(1);
}

const video = videos[0];
const now = new Date();
const created = new Date(video.created_at);
const ageMinutes = Math.floor((now - created) / 1000 / 60);

console.log('📹 视频信息:');
console.log(`   标题: ${video.title}`);
console.log(`   ID: ${video.id}`);
console.log(`   状态: ${video.status}`);
console.log(`   创建时间: ${video.created_at}`);
console.log(`   视频年龄: ${ageMinutes} 分钟`);
console.log(`   视频 URL: ${video.video_url || '(未生成)'}`);
console.log(`   缩略图: ${video.thumbnail_url || '(未生成)'}`);

if (!video.thumbnail_url && video.status === 'completed' && video.video_url) {
  console.log('\n💡 视频已完成但缩略图未生成');
  console.log('   可能原因: 视频太新,Cloudflare 还在处理');
  console.log(`   建议: 等待 ${Math.max(0, 20 - ageMinutes)} 分钟后重试\n`);
  
  // 手动触发重试
  console.log('🔄 重新触发缩略图生成...');
  
  await supabase
    .from('videos')
    .update({ status: 'processing' })
    .eq('id', video.id);
  
  await new Promise(r => setTimeout(r, 1000));
  
  const triggerTime = new Date();
  await supabase
    .from('videos')
    .update({ status: 'completed' })
    .eq('id', video.id);
  
  console.log(`   已触发 (${triggerTime.toISOString()})`);
  console.log('   等待 10 秒...\n');
  
  await new Promise(r => setTimeout(r, 10000));
  
  // 检查结果
  const { data: updated } = await supabase
    .from('videos')
    .select('thumbnail_url')
    .eq('id', video.id)
    .single();
  
  if (updated?.thumbnail_url && !updated.thumbnail_url.startsWith('data:image/svg')) {
    console.log('✅ 缩略图生成成功!');
    console.log(`   URL: ${updated.thumbnail_url}`);
  } else {
    console.log('⏳ 缩略图仍在生成中...');
    console.log('   Edge Function 正在重试,请等待 2-3 分钟');
  }
}
