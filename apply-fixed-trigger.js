/**
 * 应用修复后的触发器（从 system_config 表读取配置）
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 应用修复后的触发器\n');

const migrationSql = readFileSync('/tmp/migration.sql', 'utf8');

console.log('📝 SQL 文件内容:');
console.log('='.repeat(60));
console.log(migrationSql);
console.log('='.repeat(60));
console.log('\n⚠️  请在 Supabase SQL Editor 中手动执行上述 SQL');
console.log('📍 https://supabase.com/dashboard/project/hvkzwrnvxsleeonqqrzq/sql/new\n');

console.log('执行完成后按 Enter 继续验证...');
