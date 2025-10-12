/**
 * 应用 migration 022 - 改进的自动缩略图触发器
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import 'dotenv/config';

const sql = readFileSync('supabase/migrations/022_fix_auto_thumbnail_trigger.sql', 'utf8');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('📝 应用 migration 022...\n');

// 使用 Supabase SQL Editor 执行（通过 REST API）
const response = await fetch(
  `${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    body: JSON.stringify({ query: sql })
  }
).catch(() => null);

if (!response || !response.ok) {
  console.log('⚠️  无法通过 API 执行，请手动在 SQL Editor 执行\n');
  console.log('SQL 内容：');
  console.log('='.repeat(60));
  console.log(sql);
  console.log('='.repeat(60));
} else {
  console.log('✅ Migration 022 已成功应用！\n');

  // 验证视图是否创建成功
  const { data, error } = await supabase
    .from('pg_net_recent_responses')
    .select('*')
    .limit(1);

  if (error) {
    console.log('⚠️  视图可能未创建:', error.message);
  } else {
    console.log('✅ pg_net_recent_responses 视图可用');
  }

  // 验证测试函数是否可用
  const { data: testResult, error: testError } = await supabase.rpc('test_pgnet_connection');

  if (testError) {
    console.log('⚠️  test_pgnet_connection 函数不可用:', testError.message);
  } else {
    console.log('✅ test_pgnet_connection 函数可用');
    console.log('   结果:', testResult);
  }
}
