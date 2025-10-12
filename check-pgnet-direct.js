/**
 * 直接查询 net._http_response 表
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'net' }
});

console.log('🔍 直接查询 net._http_response 表\n');

// 使用原始 SQL 查询
const { data, error } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      id,
      status_code,
      error_msg,
      created,
      timed_out,
      LEFT(content::text, 200) as content_preview
    FROM net._http_response
    WHERE created > NOW() - INTERVAL '1 hour'
    ORDER BY created DESC
    LIMIT 10;
  `
});

if (error) {
  console.error('❌ 查询失败:', error);
  console.log('\n💡 尝试另一种方法...\n');

  // 尝试直接查询（需要 service_role 权限）
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey
    },
    body: JSON.stringify({
      sql: 'SELECT * FROM net._http_response WHERE created > NOW() - INTERVAL \'1 hour\' ORDER BY created DESC LIMIT 10'
    })
  });

  console.log('Response status:', response.status);
  const result = await response.text();
  console.log('Result:', result);
} else {
  console.log('✅ 查询成功:');
  console.log(JSON.stringify(data, null, 2));
}
