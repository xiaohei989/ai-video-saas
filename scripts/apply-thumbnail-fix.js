#!/usr/bin/env node
// 应用缩略图触发器修复

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 缺少环境变量：VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('=========================================')
  console.log('🔧 应用缩略图触发器修复')
  console.log('=========================================\n')

  // 步骤 1: 读取并执行 SQL 迁移文件
  console.log('📦 步骤 1: 应用数据库迁移...')

  try {
    const sqlPath = join(__dirname, '..', 'supabase', 'migrations', '027_fix_thumbnail_trigger_for_failed_migrations.sql')
    const sqlContent = readFileSync(sqlPath, 'utf8')

    // 注意：Supabase JS 客户端不直接支持执行原始 DDL
    // 需要使用 pg 客户端或 REST API
    console.log('⚠️  警告: 需要使用 psql 或 Supabase CLI 执行迁移')
    console.log('   运行: chmod +x scripts/apply-thumbnail-fix.sh')
    console.log('   运行: ./scripts/apply-thumbnail-fix.sh')
    console.log('')

    // 或者使用 RPC 调用（如果函数已经存在）
    console.log('🔄 步骤 2: 尝试调用手动触发函数...')

    const { data, error } = await supabase.rpc('manually_trigger_thumbnails_for_failed_migrations')

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('⚠️  函数尚未部署，请先运行迁移脚本')
        console.log('')
        console.log('💡 使用以下命令应用迁移:')
        console.log('   chmod +x scripts/apply-thumbnail-fix.sh')
        console.log('   ./scripts/apply-thumbnail-fix.sh')
        console.log('')
        console.log('   或者使用 psql:')
        console.log(`   PGPASSWORD="huixiangyigou2025!" psql \\`)
        console.log(`     -h db.hvkzwrnvxsleeonqqrzq.supabase.co \\`)
        console.log(`     -p 5432 \\`)
        console.log(`     -d postgres \\`)
        console.log(`     -U postgres \\`)
        console.log(`     -f supabase/migrations/027_fix_thumbnail_trigger_for_failed_migrations.sql`)
      } else {
        console.error('❌ 调用失败:', error.message)
      }
      return
    }

    console.log('✅ 触发成功！')
    console.log('')
    console.log('📊 执行结果:')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    console.log('=========================================')
    console.log('✅ 修复应用完成！')
    console.log('=========================================\n')

    console.log('💡 后续步骤:')
    console.log('  1. 等待 5-10 分钟让 Edge Function 处理缩略图')
    console.log('  2. 运行检查脚本: node scripts/check-recent-videos-migration.js')
    console.log('  3. 查看缩略图生成状态\n')

  } catch (err) {
    console.error('❌ 执行失败:', err.message)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('❌ 执行失败:', err)
  process.exit(1)
})
