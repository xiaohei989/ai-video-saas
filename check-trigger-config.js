import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查触发器配置\n');

// 1. 查看 system_config 表
console.log('1. system_config 表配置:');
const { data: configs } = await supabase
  .from('system_config')
  .select('*')
  .order('key');

if (configs && configs.length > 0) {
  configs.forEach(c => {
    const valueDisplay = c.key.includes('key') ? '***' : c.value;
    console.log(`   ${c.key}: ${valueDisplay}`);
  });
} else {
  console.log('   (无配置)');
}
console.log('');

// 2. 检查触发器是否存在
console.log('2. 检查触发器:');

// 查询触发器 - 修正表名为 pg_trigger
const { data: triggers, error: triggerError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      t.tgname as trigger_name,
      p.proname as function_name,
      CASE t.tgtype::int & 1
        WHEN 1 THEN 'ROW'
        ELSE 'STATEMENT'
      END as level,
      CASE t.tgtype::int & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
      END as timing
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE t.tgname IN ('on_video_completed_auto_thumbnail', 'on_video_completed_auto_migrate')
    ORDER BY t.tgname;
  `
});

// 由于可能没有 exec_sql RPC，我们直接用另一种方式
console.log('   尝试手动验证触发器配置...\n');

// 3. 测试是否缺少配置导致触发器失败
console.log('3. 分析:');
console.log('   缩略图触发器 (021) 使用: current_setting(\'app.settings.supabase_url\')');
console.log('   迁移触发器 (023) 使用: system_config 表');
console.log('');

const hasSupabaseUrl = configs?.some(c => c.key === 'supabase_url');
const hasServiceKey = configs?.some(c => c.key === 'service_role_key');

console.log('   system_config 表配置状态:');
console.log(`   - supabase_url: ${hasSupabaseUrl ? '✅ 已配置' : '❌ 缺失'}`);
console.log(`   - service_role_key: ${hasServiceKey ? '✅ 已配置' : '❌ 缺失'}`);
console.log('');

console.log('========== 结论 ==========');
if (!hasSupabaseUrl || !hasServiceKey) {
  console.log('❌ 缩略图触发器配置缺失！');
  console.log('   current_setting(\'app.settings.supabase_url\') 和 service_role_key');
  console.log('   需要统一使用 system_config 表配置');
} else {
  console.log('✅ system_config 配置完整');
  console.log('   但缩略图触发器使用的是 current_setting()，不是 system_config');
  console.log('   需要修改触发器以保持一致');
}
