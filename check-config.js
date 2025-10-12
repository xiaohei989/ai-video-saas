import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查 system_config 配置\n');

const { data, error } = await supabase
  .from('system_config')
  .select('key, value')
  .in('key', ['supabase_url', 'service_role_key']);

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log('❌ system_config 表中缺少配置\n');
  console.log('需要在 Supabase SQL Editor 中执行：\n');
  console.log('INSERT INTO system_config (key, value) VALUES');
  console.log(`  ('supabase_url', '${process.env.VITE_SUPABASE_URL}'),`);
  console.log(`  ('service_role_key', '${process.env.SUPABASE_SERVICE_ROLE_KEY}');`);
} else {
  console.log('✅ 找到配置:\n');
  const hasUrl = data.find(item => item.key === 'supabase_url');
  const hasKey = data.find(item => item.key === 'service_role_key');

  console.log('  - supabase_url:', hasUrl ? hasUrl.value : '❌ 缺失');
  console.log('  - service_role_key:', hasKey ? '✅ 已设置' : '❌ 缺失');

  if (!hasUrl || !hasKey) {
    console.log('\n⚠️  配置不完整，触发器无法工作');
  } else {
    console.log('\n✅ 配置完整，触发器可以正常工作');
  }
}
