import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查 Puppy 视频触发器执行记录\n');

// 查询 pg_net 请求记录
const { data: netRequests, error } = await supabase.rpc('sql', {
  query: `
    SELECT 
      id,
      created,
      url,
      method,
      body::text,
      timeout_milliseconds,
      error_msg
    FROM net._http_response
    WHERE url LIKE '%auto-generate-thumbnail%'
      AND body::text LIKE '%e8bfccd7-49b1-4b8c-a90a-fcfee914cb63%'
    ORDER BY created DESC
    LIMIT 5;
  `
});

if (error) {
  console.error('❌ 查询失败:', error);
} else if (!netRequests || netRequests.length === 0) {
  console.log('❌ 没有找到相关的触发器记录');
} else {
  console.log(`✅ 找到 ${netRequests.length} 条记录:\n`);
  netRequests.forEach((req, i) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`记录 ${i + 1}:`);
    console.log('   ID:', req.id);
    console.log('   时间:', req.created);
    console.log('   URL:', req.url);
    console.log('   超时设置:', req.timeout_milliseconds, 'ms');
    console.log('   请求体:', req.body);
    console.log('   错误:', req.error_msg || '(无)');
    console.log('');
  });
}
