import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const videoId = 'a39d210b-2abf-4f2e-ad34-4a3897672af5';

console.log('🔄 重新触发赛博坦视频缩略图生成\n');

// 方法：通过更新 status 触发数据库触发器
console.log('1. 设置状态为 processing...');
await supabase
  .from('videos')
  .update({ status: 'processing', thumbnail_url: null })
  .eq('id', videoId);

await new Promise(r => setTimeout(r, 1000));

console.log('2. 设置状态为 completed，触发缩略图生成...');
const triggerTime = new Date();
await supabase
  .from('videos')
  .update({ status: 'completed' })
  .eq('id', videoId);

console.log('✓ 已触发\n');
console.log('等待 10 秒检查结果...\n');

await new Promise(r => setTimeout(r, 10000));

// 检查结果
const { data } = await supabase
  .from('videos')
  .select('thumbnail_url, thumbnail_metadata')
  .eq('id', videoId)
  .single();

if (data?.thumbnail_url && !data.thumbnail_url.startsWith('data:image/svg')) {
  console.log('✅ 成功！缩略图已生成！');
  console.log(`URL: ${data.thumbnail_url}`);
  if (data.thumbnail_metadata) {
    console.log('元数据:', JSON.stringify(data.thumbnail_metadata, null, 2));
  }
} else {
  console.log('⏳ 仍在生成中...');
  console.log(`当前 thumbnail_url: ${data?.thumbnail_url || '(null)'}`);

  // 检查 Edge Function 响应
  const { data: responses } = await supabase
    .from('pg_net_recent_responses')
    .select('*')
    .gte('created', triggerTime.toISOString())
    .order('created', { ascending: false })
    .limit(1);

  if (responses && responses.length > 0) {
    const r = responses[0];
    console.log('\n📊 Edge Function 响应:');
    console.log(`状态: ${r.status_summary} (HTTP ${r.status_code || 'N/A'})`);
    console.log(`时间: ${r.created}`);
    if (r.error_msg) {
      console.log(`错误: ${r.error_msg}`);
    }
    if (r.content_preview) {
      console.log(`内容: ${r.content_preview}`);
    }
  } else {
    console.log('\n⚠️  未找到 Edge Function 响应记录');
  }
}
