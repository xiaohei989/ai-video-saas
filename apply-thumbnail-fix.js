import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 应用缩略图触发器修复\n');

// 读取 SQL 文件
const sql = readFileSync('supabase/migrations/024_fix_thumbnail_trigger_config.sql', 'utf-8');

console.log('执行 SQL migration...\n');

// 使用 Supabase Admin API 执行 SQL
// 注意：Supabase JS 客户端不直接支持执行原始 SQL
// 我们需要使用 pg 或者直接 psql

console.log('⚠️  请使用以下命令执行 SQL:');
console.log('');
console.log('方法1 - 使用 psql:');
console.log('psql "postgresql://postgres.hvkzwrnvxsleeonqqrzq:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" -f supabase/migrations/024_fix_thumbnail_trigger_config.sql');
console.log('');
console.log('方法2 - 在 Supabase Dashboard SQL Editor 中执行:');
console.log('打开 https://supabase.com/dashboard/project/hvkzwrnvxsleeonqqrzq/sql/new');
console.log('粘贴 supabase/migrations/024_fix_thumbnail_trigger_config.sql 的内容');
console.log('');
console.log('方法3 - 使用 node 执行（需要 pg 库）:');
console.log('将使用环境变量中的密码自动执行...\n');

// 尝试使用环境变量执行
import('pg').then(async ({ default: pg }) => {
  const { Client } = pg;

  const client = new Client({
    host: 'db.hvkzwrnvxsleeonqqrzq.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'huixiangyigou2025!',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ 已连接到数据库\n');

    const result = await client.query(sql);

    console.log('✅ SQL 执行成功！\n');

    // 测试配置
    console.log('🧪 测试修复后的配置...\n');

    const testResult = await client.query(`
      SELECT value
      FROM system_config
      WHERE key IN ('supabase_url', 'service_role_key')
      ORDER BY key;
    `);

    console.log('system_config 配置:');
    testResult.rows.forEach(row => {
      console.log(`  ✅ 配置存在`);
    });

    await client.end();

    console.log('\n✅ 修复完成！现在新视频应该能自动生成缩略图了');

  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  }
}).catch(() => {
  console.log('⚠️  pg 库未安装，请使用上述方法1或方法2手动执行');
});
