import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const videoId = '04c347fe-d4e3-40b0-8886-875777de4ba1';

console.log('等待 2 分钟后重试...\n');

// 等待 2 分钟
for (let i = 120; i > 0; i -= 10) {
  process.stdout.write(`\r还剩 ${i} 秒...`);
  await new Promise(r => setTimeout(r, 10000));
}

console.log('\n\n开始测试...');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 重新触发
await supabase
  .from('videos')
  .update({ status: 'processing' })
  .eq('id', videoId);

await new Promise(r => setTimeout(r, 1000));

await supabase
  .from('videos')
  .update({ status: 'completed' })
  .eq('id', videoId);

console.log('已重新触发，等待 10 秒...');
await new Promise(r => setTimeout(r, 10000));

const { data } = await supabase
  .from('videos')
  .select('thumbnail_url, thumbnail_metadata')
  .eq('id', videoId)
  .single();

if (data?.thumbnail_url && !data.thumbnail_url.startsWith('data:image/svg')) {
  console.log('✅ 成功！', data.thumbnail_url);
} else {
  console.log('❌ 仍然失败');
}
