import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查当前触发器的源代码\n');

// 查询触发器函数的源代码
const { data: functionDef, error } = await supabase.rpc('sql', {
  query: `
    SELECT
      pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'trigger_auto_generate_thumbnail';
  `
});

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

if (!functionDef || functionDef.length === 0) {
  console.log('❌ 触发器函数不存在');
  process.exit(1);
}

const definition = functionDef[0].definition;

console.log('✅ 触发器函数源代码:\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(definition);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 分析触发器类型
if (definition.includes("NEW.migration_status = 'completed'")) {
  console.log('✅ 当前触发器: 基于 migration_status（新版本）');
  console.log('   触发时机: 迁移完成时');
} else if (definition.includes("NEW.status = 'completed'")) {
  console.log('⚠️  当前触发器: 基于 status（旧版本）');
  console.log('   触发时机: 视频生成完成时（不是迁移完成时）');
  console.log('   问题: Puppy 视频的 status 早在迁移前就是 completed 了');
  console.log('   解决: 需要部署新触发器（基于 migration_status）');
}

// 检查是否包含智能延迟
if (definition.includes('timeSinceMigration') || definition.includes('time_since_migration')) {
  console.log('✅ 包含智能延迟功能');
} else {
  console.log('❌ 不包含智能延迟功能');
}

// 检查超时设置
const timeoutMatch = definition.match(/timeout_milliseconds\s*:=\s*(\d+)/);
if (timeoutMatch) {
  const timeout = parseInt(timeoutMatch[1]);
  console.log(`✅ 超时设置: ${timeout}ms (${timeout / 1000}秒)`);
} else {
  console.log('⚠️  没有设置超时');
}
