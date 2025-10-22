#!/usr/bin/env node
/**
 * SQL执行工具
 * 用于执行Supabase数据库的SQL语句
 *
 * 使用方法:
 * 1. 直接执行SQL: node scripts/exec-sql.js "SELECT * FROM templates LIMIT 5"
 * 2. 从文件执行: node scripts/exec-sql.js -f path/to/query.sql
 * 3. 交互模式: node scripts/exec-sql.js -i
 */

import pkg from 'pg'
const { Client } = pkg
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { createInterface } from 'readline'

dotenv.config()

/**
 * 执行SQL查询
 * 使用pg客户端直接连接数据库
 */
async function executeSQL(sql) {
  console.log('🔍 执行SQL查询...')
  console.log('📝 SQL:', sql.substring(0, 200) + (sql.length > 200 ? '...' : ''))
  console.log('')

  const client = new Client({
    host: process.env.SUPABASE_DB_HOST || 'aws-1-us-west-1.pooler.supabase.com',
    port: parseInt(process.env.SUPABASE_DB_PORT || '6543'),
    user: process.env.SUPABASE_DB_USER || 'postgres.hvkzwrnvxsleeonqqrzq',
    password: process.env.SUPABASE_DATABASE_PASSWORD,
    database: process.env.SUPABASE_DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    const result = await client.query(sql)

    console.log('✅ 查询成功!')

    if (result.rows && result.rows.length > 0) {
      console.log(`📊 返回 ${result.rows.length} 行数据:\n`)
      console.table(result.rows)
    } else if (result.rowCount !== null) {
      console.log(`✅ 操作完成（影响 ${result.rowCount} 行）`)
    } else {
      console.log('✅ 操作完成（无返回数据）')
    }

    return true
  } catch (err) {
    console.error('❌ 执行出错:', err.message)
    if (err.stack) {
      console.error('详细信息:', err.stack)
    }
    return false
  } finally {
    await client.end()
  }
}

/**
 * 交互模式
 */
async function interactiveMode() {
  console.log('🔧 进入SQL交互模式')
  console.log('输入SQL语句，按回车执行')
  console.log('输入 .exit 或 .quit 退出')
  console.log('输入 .help 查看帮助\n')

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'SQL> '
  })

  rl.prompt()

  rl.on('line', async (line) => {
    const input = line.trim()

    if (input === '.exit' || input === '.quit') {
      console.log('👋 退出交互模式')
      rl.close()
      process.exit(0)
    }

    if (input === '.help') {
      console.log('\n命令帮助:')
      console.log('  .exit, .quit  - 退出交互模式')
      console.log('  .help         - 显示此帮助')
      console.log('  .tables       - 显示所有表')
      console.log('  .describe <table> - 显示表结构\n')
      rl.prompt()
      return
    }

    if (input === '.tables') {
      const sql = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `
      await executeSQL(sql)
      console.log('')
      rl.prompt()
      return
    }

    if (input.startsWith('.describe ')) {
      const tableName = input.substring('.describe '.length).trim()
      const sql = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position;
      `
      await executeSQL(sql)
      console.log('')
      rl.prompt()
      return
    }

    if (!input) {
      rl.prompt()
      return
    }

    await executeSQL(input)
    console.log('')
    rl.prompt()
  })

  rl.on('close', () => {
    console.log('👋 再见!')
    process.exit(0)
  })
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)

  // 交互模式
  if (args.includes('-i') || args.includes('--interactive')) {
    await interactiveMode()
    return
  }

  // 从文件读取SQL
  if (args.includes('-f') || args.includes('--file')) {
    const fileIndex = args.indexOf('-f') !== -1 ? args.indexOf('-f') : args.indexOf('--file')
    const filePath = args[fileIndex + 1]

    if (!filePath) {
      console.error('❌ 错误: 请指定SQL文件路径')
      console.log('使用方法: node scripts/exec-sql.js -f path/to/query.sql')
      process.exit(1)
    }

    try {
      const sql = readFileSync(filePath, 'utf-8')
      await executeSQL(sql)
      process.exit(0)
    } catch (err) {
      console.error('❌ 读取文件失败:', err.message)
      process.exit(1)
    }
  }

  // 直接执行SQL
  if (args.length > 0) {
    const sql = args.join(' ')
    const success = await executeSQL(sql)
    process.exit(success ? 0 : 1)
  }

  // 显示帮助
  console.log('SQL执行工具 - Supabase数据库')
  console.log('')
  console.log('使用方法:')
  console.log('  node scripts/exec-sql.js "SELECT * FROM templates LIMIT 5"')
  console.log('  node scripts/exec-sql.js -f path/to/query.sql')
  console.log('  node scripts/exec-sql.js -i')
  console.log('')
  console.log('选项:')
  console.log('  -f, --file <path>     从文件读取SQL并执行')
  console.log('  -i, --interactive     进入交互模式')
  console.log('')
  console.log('示例:')
  console.log('  # 查询模板')
  console.log('  node scripts/exec-sql.js "SELECT id, name FROM templates LIMIT 5"')
  console.log('')
  console.log('  # 更新数据')
  console.log('  node scripts/exec-sql.js "UPDATE seo_content_templates SET recommended_word_count = 1600 WHERE slug = \'how-to\'"')
  console.log('')
  console.log('  # 从文件执行')
  console.log('  node scripts/exec-sql.js -f scripts/queries/update-faq.sql')
  console.log('')
  console.log('  # 交互模式')
  console.log('  node scripts/exec-sql.js -i')
  console.log('')
  console.log('⚠️  注意: 此脚本使用SERVICE_ROLE_KEY，拥有完整数据库权限，请谨慎使用！')
}

main().catch(console.error)
