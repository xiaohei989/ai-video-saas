#!/usr/bin/env node
/**
 * 检查数据库表结构
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const envPath = join(__dirname, '../.env.local')
let supabaseUrl, supabaseServiceKey

try {
  const envContent = readFileSync(envPath, 'utf-8')
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/)
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)

  supabaseUrl = urlMatch[1].trim()
  supabaseServiceKey = keyMatch[1].trim()
} catch (error) {
  console.error('无法读取环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkColumns() {
  console.log('📊 检查 seo_page_variants 表结构\n')

  // 查询一条记录,查看所有字段
  const { data, error } = await supabase
    .from('seo_page_variants')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    console.error('查询失败:', error.message)
    return
  }

  console.log('现有字段列表:\n')
  const scoreFields = []
  const otherFields = []

  Object.keys(data).forEach(key => {
    if (key.includes('score') || key.includes('quality')) {
      scoreFields.push(key)
    } else {
      otherFields.push(key)
    }
  })

  console.log('📈 评分相关字段:')
  scoreFields.forEach(field => {
    console.log(`  - ${field}: ${typeof data[field]} = ${data[field]}`)
  })

  console.log('\n需要的4个维度字段:')
  const requiredFields = [
    { name: 'meta_info_quality_score', desc: 'Meta信息质量', max: 30 },
    { name: 'keyword_optimization_score', desc: '关键词优化', max: 25 },
    { name: 'content_quality_score', desc: '内容质量', max: 25 },
    { name: 'readability_score', desc: '可读性', max: 20 }
  ]

  console.log('\n✅ 字段检查:')
  requiredFields.forEach(field => {
    const exists = field.name in data
    console.log(`  ${exists ? '✅' : '❌'} ${field.name} (${field.desc} /${field.max}分)`)
  })

  // 检查是否需要添加新字段
  const missingFields = requiredFields.filter(f => !(f.name in data))

  if (missingFields.length > 0) {
    console.log(`\n⚠️ 缺少 ${missingFields.length} 个字段:`)
    missingFields.forEach(f => {
      console.log(`  - ${f.name}`)
    })
    console.log('\n需要执行SQL添加字段:')
    missingFields.forEach(f => {
      console.log(`ALTER TABLE seo_page_variants ADD COLUMN IF NOT EXISTS ${f.name} INTEGER DEFAULT 0;`)
    })
  } else {
    console.log('\n✅ 所有必需字段都存在!')
  }
}

checkColumns().catch(console.error)
