import { readFileSync } from 'fs';
import 'dotenv/config';

console.log('🔧 通过 Supabase API 执行修复\n');

const sql = readFileSync('supabase/migrations/024_fix_thumbnail_trigger_config.sql', 'utf-8');

// 使用 Supabase Management API
const projectRef = 'hvkzwrnvxsleeonqqrzq';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const response = await fetch(
  `https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify({ query: sql })
  }
);

if (!response.ok) {
  const error = await response.text();
  console.error('❌ 执行失败:', error);

  console.log('\n📋 请手动在 Supabase Dashboard 执行以下 SQL:\n');
  console.log('打开: https://supabase.com/dashboard/project/hvkzwrnvxsleeonqqrzq/sql/new\n');
  console.log('粘贴以下内容:\n');
  console.log('-----------------------------------');
  console.log(sql);
  console.log('-----------------------------------');
} else {
  console.log('✅ 修复已成功应用！');
  console.log('\n现在新视频完成时应该能自动生成缩略图了');
}
