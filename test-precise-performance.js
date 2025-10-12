/**
 * 精确测量缩略图生成性能
 * 通过 pg_net 响应时间来精确计算
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 对比两个视频的 URL\n');

const successId = '0271fac7-e515-4d4a-b45e-447e8416cf26'; // 成功的
const failId = '04c347fe-d4e3-40b0-8886-875777de4ba1';   // 失败的

// 查询成功的视频
const { data: successVideo } = await supabase
  .from('videos')
  .select('title, video_url')
  .eq('id', successId)
  .single();

// 查询失败的视频
const { data: failVideo } = await supabase
  .from('videos')
  .select('title, video_url')
  .eq('id', failId)
  .single();

console.log('✅ 成功的视频:');
console.log(`   标题: ${successVideo.title}`);
console.log(`   URL: ${successVideo.video_url}\n`);

console.log('❌ 失败的视频:');
console.log(`   标题: ${failVideo.title}`);
console.log(`   URL: ${failVideo.video_url}\n`);

console.log('URL 对比:');
console.log(`   成功: ${successVideo.video_url}`);
console.log(`   失败: ${failVideo.video_url}`);
console.log(`   差异: ${successVideo.video_url === failVideo.video_url ? '无' : '有差异'}\n`);

process.exit(0);

const videoId = '0271fac7-e515-4d4a-b45e-447e8416cf26';

// 步骤 1: 重置
console.log('🔄 重置视频状态...');
await supabase
  .from('videos')
  .update({
    status: 'processing',
    thumbnail_url: null,
    thumbnail_generated_at: null,
    thumbnail_metadata: {}
  })
  .eq('id', videoId);

await new Promise(resolve => setTimeout(resolve, 2000));

// 步骤 2: 记录触发时间并触发
const triggerTime = new Date();
console.log(`\n⏰ 触发时间: ${triggerTime.toISOString()}`);

await supabase
  .from('videos')
  .update({ status: 'completed' })
  .eq('id', videoId);

console.log('✓ 已触发\n');

// 步骤 3: 等待 10 秒
console.log('⏳ 等待 10 秒...');
await new Promise(resolve => setTimeout(resolve, 10000));

// 步骤 4: 查找对应的 pg_net 响应
console.log('\n📊 查找对应的 pg_net 响应...');
const { data: responses } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .gte('created', triggerTime.toISOString())
  .order('created', { ascending: false })
  .limit(1);

if (responses && responses.length > 0) {
  const response = responses[0];
  const responseTime = new Date(response.created);
  const duration = (responseTime - triggerTime) / 1000;

  console.log('✅ 找到对应响应:\n');
  console.log('='.repeat(60));
  console.log(`触发时间: ${triggerTime.toISOString()}`);
  console.log(`完成时间: ${responseTime.toISOString()}`);
  console.log(`\n⚡ 实际耗时: ${duration.toFixed(2)} 秒`);
  console.log('='.repeat(60));
  console.log(`\n状态码: ${response.status_code}`);
  console.log(`状态: ${response.status_summary}`);

  if (response.content_preview) {
    console.log(`\n响应内容预览:\n${response.content_preview}`);
  }
} else {
  console.log('⚠️  未找到对应的 pg_net 响应');
}

// 步骤 5: 检查视频元数据
const { data: video } = await supabase
  .from('videos')
  .select('thumbnail_url, thumbnail_metadata')
  .eq('id', videoId)
  .single();

if (video?.thumbnail_metadata) {
  console.log(`\n📋 视频元数据:`);
  console.log(JSON.stringify(video.thumbnail_metadata, null, 2));

  if (video.thumbnail_metadata.optimized) {
    console.log(`\n✨ 确认使用优化版本`);
  }
}

console.log(`\n🖼️  缩略图: ${video?.thumbnail_url || '未生成'}`);
