#!/usr/bin/env node
// 执行数据库迁移

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const { Client } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  console.log('🔧 执行数据库迁移\n')

  // 读取 SQL 文件
  const sqlPath = join(__dirname, '..', 'supabase', 'migrations', '027_fix_thumbnail_trigger_for_failed_migrations.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  console.log('📄 SQL 文件已读取')
  console.log(`📏 文件大小: ${Math.round(sql.length / 1024)} KB\n`)

  // 连接数据库
  const client = new Client({
    host: 'db.hvkzwrnvxsleeonqqrzq.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'huixiangyigou2025!',
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('🔌 连接数据库...')
    await client.connect()
    console.log('✅ 数据库已连接\n')

    console.log('⚙️  执行迁移...')
    const result = await client.query(sql)
    console.log('✅ 迁移执行成功！\n')

    // 显示 NOTICE 消息（如果有）
    if (result.rows && result.rows.length > 0) {
      console.log('📊 执行结果:')
      console.log(result.rows)
    }

  } catch (err) {
    console.error('❌ 执行失败:', err.message)
    if (err.stack) {
      console.error('\n详细错误:')
      console.error(err.stack)
    }
    process.exit(1)
  } finally {
    await client.end()
    console.log('\n🔌 数据库连接已关闭')
  }
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err)
  process.exit(1)
})
