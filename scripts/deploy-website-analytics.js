const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('错误: 缺少SUPABASE_SERVICE_ROLE_KEY环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function deployMigration() {
  try {
    console.log('开始部署网站访问统计迁移...')

    const sqlPath = path.join(__dirname, '../supabase/migrations/017_website_analytics.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')

    // 将SQL分成多个语句执行
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`共有 ${statements.length} 条SQL语句需要执行`)

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'

      // 跳过注释
      if (statement.trim().startsWith('--')) {
        continue
      }

      try {
        console.log(`\n执行语句 ${i + 1}/${statements.length}...`)
        console.log(statement.substring(0, 100) + '...')

        const { error } = await supabase.rpc('exec_sql', {
          sql: statement
        })

        if (error) {
          // 尝试使用原生方式
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ query: statement })
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
          }

          console.log(`✓ 语句 ${i + 1} 执行成功`)
          successCount++
        } else {
          console.log(`✓ 语句 ${i + 1} 执行成功`)
          successCount++
        }
      } catch (err) {
        console.error(`✗ 语句 ${i + 1} 执行失败:`, err.message)

        // 某些错误可以忽略(如已存在的对象)
        if (err.message.includes('already exists') ||
            err.message.includes('does not exist')) {
          console.log('  (忽略此错误,继续执行)')
          successCount++
        } else {
          errorCount++
        }
      }
    }

    console.log(`\n\n部署完成!`)
    console.log(`成功: ${successCount}`)
    console.log(`失败: ${errorCount}`)

    if (errorCount === 0) {
      console.log('\n✓ 网站访问统计系统已成功部署!')
      process.exit(0)
    } else {
      console.log('\n⚠ 部署完成但有错误,请检查日志')
      process.exit(1)
    }

  } catch (error) {
    console.error('部署失败:', error)
    process.exit(1)
  }
}

deployMigration()