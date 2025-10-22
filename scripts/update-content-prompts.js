#!/usr/bin/env node

/**
 * 更新 seo_content_templates 表的 prompt_template 字段
 * 从 prompts/content-generation/*.md 文件读取内容
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量: VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const templates = [
  {
    slug: 'how-to',
    file: path.join(__dirname, '../prompts/content-generation/how-to.md')
  },
  {
    slug: 'alternatives',
    file: path.join(__dirname, '../prompts/content-generation/alternatives.md')
  },
  {
    slug: 'platform-specific',
    file: path.join(__dirname, '../prompts/content-generation/platform-specific.md')
  }
]

async function updatePrompts() {
  console.log('🚀 开始更新内容生成提示词模板...\n')

  for (const template of templates) {
    try {
      // 读取MD文件
      if (!fs.existsSync(template.file)) {
        console.error(`❌ 文件不存在: ${template.file}`)
        continue
      }

      const content = fs.readFileSync(template.file, 'utf-8')
      console.log(`📄 读取文件: ${path.basename(template.file)} (${content.length} 字符)`)

      // 更新数据库
      const { data, error } = await supabase
        .from('seo_content_templates')
        .update({
          prompt_template: content,
          updated_at: new Date().toISOString()
        })
        .eq('slug', template.slug)
        .select()

      if (error) {
        console.error(`❌ 更新失败 (${template.slug}):`, error.message)
        continue
      }

      if (data && data.length > 0) {
        console.log(`✅ 成功更新: ${template.slug}`)
        console.log(`   - 模板名称: ${data[0].name}`)
        console.log(`   - 提示词长度: ${content.length} 字符\n`)
      } else {
        console.warn(`⚠️  未找到记录: ${template.slug}\n`)
      }
    } catch (err) {
      console.error(`❌ 处理错误 (${template.slug}):`, err.message)
    }
  }

  console.log('✨ 更新完成！')

  // 验证
  console.log('\n📊 验证更新结果:')
  const { data: allTemplates, error: fetchError } = await supabase
    .from('seo_content_templates')
    .select('slug, name')
    .order('slug')

  if (fetchError) {
    console.error('❌ 验证失败:', fetchError.message)
  } else {
    for (const t of allTemplates) {
      const { data } = await supabase
        .from('seo_content_templates')
        .select('prompt_template')
        .eq('slug', t.slug)
        .single()

      console.log(`  - ${t.slug}: ${t.name} (${data?.prompt_template?.length || 0} 字符)`)
    }
  }
}

updatePrompts().catch(console.error)
