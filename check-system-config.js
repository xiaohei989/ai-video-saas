import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查 system_config 配置\n');

const { data, error } = await supabase
  .from('system_config')
  .select('*')
  .in('key', ['supabase_url', 'service_role_key']);

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('配置项:\n');

const configs = {
  supabase_url: null,
  service_role_key: null
};

for (const item of data) {
  configs[item.key] = item.value;
  if (item.key === 'service_role_key') {
    console.log(`✓ ${item.key}: ${item.value ? '已配置 (隐藏)' : '❌ 未配置'}`);
  } else {
    console.log(`✓ ${item.key}: ${item.value || '❌ 未配置'}`);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (!configs.supabase_url || !configs.service_role_key) {
  console.log('❌ 配置缺失！触发器无法工作\n');
  console.log('需要添加配置：');
  if (!configs.supabase_url) {
    console.log(`  supabase_url: ${process.env.VITE_SUPABASE_URL}`);
  }
  if (!configs.service_role_key) {
    console.log('  service_role_key: (从环境变量)');
  }
} else {
  console.log('✅ 配置完整，触发器可以正常工作');
}
