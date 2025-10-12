import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('📡 查看最新的 Edge Function 响应\n');

const { data: responses } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .order('created', { ascending: false })
  .limit(1);

if (!responses || responses.length === 0) {
  console.log('⚠️  没有响应记录');
  process.exit(0);
}

const r = responses[0];
console.log('最新响应:');
console.log(`   状态: [${r.status_summary}] HTTP ${r.status_code || 'N/A'}`);
console.log(`   时间: ${r.created}`);
console.log(`   错误: ${r.error_msg || '无'}`);

if (r.content_preview) {
  console.log(`\n响应内容:`);
  console.log(r.content_preview);
}
