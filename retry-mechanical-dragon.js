import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const videoId = 'f22f713f-ff70-4957-9e12-b48c637f43d7';

console.log('🔄 重新触发 Mechanical Dragon 缩略图生成\n');

await supabase
  .from('videos')
  .update({ status: 'processing', thumbnail_url: null })
  .eq('id', videoId);

await new Promise(r => setTimeout(r, 1000));

const triggerTime = new Date();
await supabase
  .from('videos')
  .update({ status: 'completed' })
  .eq('id', videoId);

console.log('✓ 已触发');
console.log('等待 10 秒...\n');

await new Promise(r => setTimeout(r, 10000));

const { data } = await supabase
  .from('videos')
  .select('thumbnail_url')
  .eq('id', videoId)
  .single();

if (data?.thumbnail_url && !data.thumbnail_url.startsWith('data:image/svg')) {
  console.log('✅ 成功! URL:', data.thumbnail_url);
} else {
  console.log('⏳ 仍在生成...');
  
  // 查看响应
  const { data: responses } = await supabase
    .from('pg_net_recent_responses')
    .select('*')
    .gte('created', triggerTime.toISOString())
    .order('created', { ascending: false })
    .limit(1);
  
  if (responses && responses.length > 0) {
    const r = responses[0];
    console.log('Edge Function 响应:', r.status_summary, 'HTTP', r.status_code);
    if (r.content_preview) {
      console.log('内容:', r.content_preview);
    }
  }
}
