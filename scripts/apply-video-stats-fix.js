/**
 * 应用视频统计修复补丁
 * 修复admin页面视频数量显示为0的问题
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Supabase 连接配置
const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyFix() {
  console.log('🔧 开始应用视频统计修复补丁...\n')

  try {
    // 读取 SQL 文件
    const sqlPath = join(__dirname, '../sql/patches/fix_video_stats.sql')
    const sqlContent = readFileSync(sqlPath, 'utf-8')

    // 分割 SQL 语句（按函数定义分割）
    const statements = sqlContent
      .split(/--\s*\d+\./)
      .filter(stmt => stmt.trim() && !stmt.startsWith('====='))
      .map(stmt => stmt.trim())

    console.log(`📝 找到 ${statements.length} 个SQL语句\n`)

    // 执行每个语句
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      if (!stmt || stmt.startsWith('--')) continue

      const funcName = stmt.includes('get_admin_dashboard_stats')
        ? 'get_admin_dashboard_stats'
        : 'get_video_generation_trends'

      console.log(`⚙️  执行: 更新函数 ${funcName}...`)

      const { error } = await supabase.rpc('exec_sql', { sql: stmt })

      if (error) {
        console.error(`❌ 执行失败:`, error.message)

        // 尝试直接通过 SQL 执行
        console.log(`🔄 尝试另一种方式...`)
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: stmt })
        })

        if (!response.ok) {
          throw new Error(`执行SQL失败: ${response.statusText}`)
        }
      }

      console.log(`✅ ${funcName} 更新成功\n`)
    }

    console.log('🎉 所有补丁应用成功！\n')
    console.log('📊 验证修复效果...')

    // 测试函数是否正常工作
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats')

    if (error) {
      console.error('❌ 验证失败:', error.message)
    } else {
      console.log('✅ 函数运行正常')
      console.log('\n📈 当前统计数据:')
      console.log(`   总视频数: ${data[0]?.total_videos || 0}`)
      console.log(`   今日视频: ${data[0]?.videos_today || 0}`)
      console.log(`   总用户数: ${data[0]?.total_users || 0}`)
    }

    console.log('\n✨ 修复完成！请刷新 admin 页面查看效果。')

  } catch (error) {
    console.error('💥 执行出错:', error.message)
    process.exit(1)
  }
}

applyFix()