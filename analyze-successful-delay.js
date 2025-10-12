import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('📊 分析成功视频的缩略图生成延迟\n');

// 查询最近成功生成缩略图的视频
const { data: videos } = await supabase
  .from('videos')
  .select('id, title, r2_uploaded_at, thumbnail_generated_at, thumbnail_metadata')
  .not('thumbnail_url', 'is', null)
  .not('thumbnail_url', 'like', 'data:image/svg%')
  .not('r2_uploaded_at', 'is', null)
  .not('thumbnail_generated_at', 'is', null)
  .gte('created_at', '2025-10-07T00:00:00')
  .order('thumbnail_generated_at', { ascending: false })
  .limit(10);

console.log(`找到 ${videos.length} 个成功的视频:\n`);

const delays = [];

for (const video of videos) {
  const migrated = new Date(video.r2_uploaded_at);
  const thumbGenerated = new Date(video.thumbnail_generated_at);
  const delay = Math.floor((thumbGenerated - migrated) / 1000);
  
  // 排除手动生成的（延迟超过1小时）
  if (delay < 3600) {
    delays.push(delay);
    console.log(`📹 ${video.title.substring(0, 40)}...`);
    console.log(`   延迟: ${delay} 秒`);
    console.log('');
  }
}

if (delays.length > 0) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 统计分析:\n');
  
  delays.sort((a, b) => a - b);
  
  const min = delays[0];
  const max = delays[delays.length - 1];
  const avg = Math.floor(delays.reduce((a, b) => a + b, 0) / delays.length);
  const median = delays[Math.floor(delays.length / 2)];
  
  console.log(`   最小延迟: ${min} 秒`);
  console.log(`   最大延迟: ${max} 秒`);
  console.log(`   平均延迟: ${avg} 秒`);
  console.log(`   中位数: ${median} 秒`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 建议:\n');
  
  if (max < 15) {
    console.log('   ✅ Cloudflare CDN 处理很快（< 15秒）');
    console.log('   建议延迟: 10 秒');
  } else if (max < 30) {
    console.log('   ⚠️  Cloudflare CDN 偶尔需要较长时间（15-30秒）');
    console.log('   建议延迟: 15 秒');
  } else {
    console.log('   ⚠️  Cloudflare CDN 需要较长时间（> 30秒）');
    console.log('   建议延迟: 20 秒');
  }
}
