/**
 * 发布所有 SEO 指南
 * 将所有未发布的 SEO 指南设置为已发布状态
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取环境变量
config({ path: join(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function publishAllGuides() {
  console.log('🚀 开始发布所有 SEO 指南...\n')

  try {
    // 1. 查询所有未发布的指南
    const { data: unpublished, error: queryError } = await supabase
      .from('template_seo_guides')
      .select('id, template_id, language, primary_keyword, is_published')
      .eq('is_published', false)

    if (queryError) {
      throw queryError
    }

    if (!unpublished || unpublished.length === 0) {
      console.log('✅ 没有需要发布的指南')
      return
    }

    console.log(`📋 找到 ${unpublished.length} 个未发布的指南:\n`)
    unpublished.forEach((guide, index) => {
      console.log(`${index + 1}. ${guide.primary_keyword} (${guide.language})`)
    })

    // 2. 批量更新为已发布
    console.log('\n📤 正在发布...')
    const { data: updated, error: updateError } = await supabase
      .from('template_seo_guides')
      .update({
        is_published: true,
        published_at: new Date().toISOString()
      })
      .eq('is_published', false)
      .select()

    if (updateError) {
      throw updateError
    }

    console.log(`\n✅ 成功发布 ${updated.length} 个指南！`)
    console.log('\n现在用户可以在前端访问这些指南页面了 🎉')

  } catch (error) {
    console.error('\n❌ 发布失败:', error)
    process.exit(1)
  }
}

// 运行
publishAllGuides()
  .then(() => {
    console.log('\n✅ 完成!')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ 错误:', error)
    process.exit(1)
  })
