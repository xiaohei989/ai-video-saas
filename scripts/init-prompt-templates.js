#!/usr/bin/env node
/**
 * 初始化提示词模板到数据库
 * 将prompts/content-generation下的Markdown模板导入到seo_prompt_templates表
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const templates = [
  {
    slug: 'how-to',
    name: 'How-To教程模板',
    file: '../prompts/content-generation/how-to.md'
  },
  {
    slug: 'alternatives',
    name: 'Alternatives对比模板',
    file: '../prompts/content-generation/alternatives.md'
  },
  {
    slug: 'platform-specific',
    name: 'Platform-Specific平台专属模板',
    file: '../prompts/content-generation/platform-specific.md'
  }
]

async function initTemplates() {
  console.log('📝 开始初始化提示词模板到数据库...\n')

  for (const template of templates) {
    try {
      const filePath = join(__dirname, template.file)
      const content = readFileSync(filePath, 'utf-8')

      console.log(`处理模板: ${template.name} (${template.slug})`)

      // 检查是否已存在
      const { data: existing } = await supabase
        .from('seo_prompt_templates')
        .select('id, slug')
        .eq('slug', template.slug)
        .single()

      if (existing) {
        // 更新
        const { error } = await supabase
          .from('seo_prompt_templates')
          .update({
            name: template.name,
            content,
            updated_at: new Date().toISOString()
          })
          .eq('slug', template.slug)

        if (error) throw error
        console.log(`  ✅ 已更新 (${content.length} 字符)\n`)
      } else {
        // 插入
        const { error } = await supabase
          .from('seo_prompt_templates')
          .insert({
            slug: template.slug,
            name: template.name,
            content,
            is_active: true
          })

        if (error) throw error
        console.log(`  ✅ 已插入 (${content.length} 字符)\n`)
      }
    } catch (error) {
      console.error(`  ❌ 失败: ${error.message}\n`)
    }
  }

  // 验证
  console.log('📊 验证数据...')
  const { data: allTemplates } = await supabase
    .from('seo_prompt_templates')
    .select('slug, name, LENGTH(content) as content_length, is_active')
    .order('slug')

  console.table(allTemplates)

  console.log('\n✅ 初始化完成！')
}

initTemplates().catch(console.error)
