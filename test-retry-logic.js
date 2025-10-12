import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const videoId = '04c347fe-d4e3-40b0-8886-875777de4ba1';

console.log('🧪 测试带重试逻辑的缩略图生成\n');

// 重置状态
console.log('1. 重置视频状态...');
await supabase
  .from('videos')
  .update({
    status: 'processing',
    thumbnail_url: null,
    thumbnail_generated_at: null,
    thumbnail_metadata: {}
  })
  .eq('id', videoId);

await new Promise(r => setTimeout(r, 1000));

// 触发
console.log('2. 触发缩略图生成...');
const triggerTime = new Date();
await supabase
  .from('videos')
  .update({ status: 'completed' })
  .eq('id', videoId);

console.log(`   触发时间: ${triggerTime.toISOString()}\n`);

// 由于视频现在已经可以截图，应该第一次就成功
console.log('3. 等待 5 秒...');
await new Promise(r => setTimeout(r, 5000));

// 检查结果
const { data: video } = await supabase
  .from('videos')
  .select('thumbnail_url, thumbnail_metadata')
  .eq('id', videoId)
  .single();

const hasThumbnail = video?.thumbnail_url && !video.thumbnail_url.startsWith('data:image/svg');

console.log('\n📊 结果:');
if (hasThumbnail) {
  console.log('✅ 缩略图生成成功!');
  console.log(`   URL: ${video.thumbnail_url}`);
  if (video.thumbnail_metadata) {
    console.log('   元数据:', JSON.stringify(video.thumbnail_metadata, null, 2));
  }
} else {
  console.log('❌ 缩略图未生成');
}

// 查看 pg_net 响应
console.log('\n📡 查看 Edge Function 响应...');
const { data: responses } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .gte('created', triggerTime.toISOString())
  .order('created', { ascending: false })
  .limit(1);

if (responses && responses.length > 0) {
  const r = responses[0];
  const responseTime = new Date(r.created);
  const duration = (responseTime - triggerTime) / 1000;
  
  console.log(`   状态: [${r.status_summary}] HTTP ${r.status_code}`);
  console.log(`   耗时: ${duration.toFixed(2)} 秒`);
  if (r.content_preview) {
    console.log(`   响应预览: ${r.content_preview.substring(0, 150)}...`);
  }
}

console.log('\n✅ 测试完成!');
