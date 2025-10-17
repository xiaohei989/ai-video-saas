import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

async function checkSEOContent() {
  const seoGuideId = '31391a1e-5a9a-4184-8082-0e5168746193'
  const templateId = 'a8c5f2d9-4e7b-3a6c-8f1d-2b9e5a8c4f7e'

  // 直接查询 SEO 指南记录
  console.log(`\n🔍 检查 SEO 指南 ID: ${seoGuideId}`)
  console.log(`模板 ID: ${templateId}\n`)

  const { data: guide, error } = await supabase
    .from('template_seo_guides')
    .select('*')
    .eq('id', seoGuideId)
    .maybeSingle()

  if (error) {
    console.error('❌ 查询 SEO 指南错误:', error)
    return
  }

  if (!guide) {
    console.log('❌ 未找到该 SEO 指南')
    return
  }

  console.log(`✅ 找到 SEO 指南\n`)
  console.log(`ID: ${guide.id}`)
  console.log(`模板ID: ${guide.template_id}`)
  console.log(`语言: ${guide.language}`)
  console.log(`主关键词: ${guide.primary_keyword}`)
  console.log(`Meta标题: ${guide.meta_title}`)
  console.log(`Meta描述: ${guide.meta_description?.substring(0, 100)}...`)
  console.log(`引言长度: ${guide.guide_intro?.length || 0} 字符`)
  console.log(`正文长度: ${guide.guide_content?.length || 0} 字符`)
  console.log(`FAQ数量: ${guide.faq_items?.length || 0}`)
  console.log(`SEO评分: ${guide.seo_score || 0}`)
  console.log(`\n--- 内容预览 (前500字符) ---`)
  console.log(guide.guide_content?.substring(0, 500))
  console.log('\n--- 检测中文字符 ---')

  // 检测是否包含中文字符
  const chineseRegex = /[\u4e00-\u9fa5]/g
  const fullContent = [
    guide.meta_title,
    guide.meta_description,
    guide.guide_intro,
    guide.guide_content,
    JSON.stringify(guide.faq_items)
  ].join(' ')

  const chineseMatches = fullContent.match(chineseRegex)
  if (chineseMatches && chineseMatches.length > 0) {
    console.log(`⚠️ 发现 ${chineseMatches.length} 个中文字符:`)
    console.log(`前20个中文字符: ${chineseMatches.slice(0, 20).join(', ')}`)

    // 找出包含中文的具体位置
    const locations = []
    if (guide.meta_title?.match(chineseRegex)) {
      const matches = guide.meta_title.match(chineseRegex)
      locations.push(`Meta标题 (${matches?.length || 0}个): ${matches?.slice(0, 5).join('')}`)
    }
    if (guide.meta_description?.match(chineseRegex)) {
      const matches = guide.meta_description.match(chineseRegex)
      locations.push(`Meta描述 (${matches?.length || 0}个): ${matches?.slice(0, 5).join('')}`)
    }
    if (guide.guide_intro?.match(chineseRegex)) {
      const matches = guide.guide_intro.match(chineseRegex)
      locations.push(`引言 (${matches?.length || 0}个): ${matches?.slice(0, 5).join('')}`)
    }
    if (guide.guide_content?.match(chineseRegex)) {
      const matches = guide.guide_content.match(chineseRegex)
      locations.push(`正文 (${matches?.length || 0}个): ${matches?.slice(0, 5).join('')}`)
    }
    if (JSON.stringify(guide.faq_items)?.match(chineseRegex)) {
      const matches = JSON.stringify(guide.faq_items).match(chineseRegex)
      locations.push(`FAQ (${matches?.length || 0}个): ${matches?.slice(0, 5).join('')}`)
    }

    console.log('\n具体位置:')
    locations.forEach((loc) => {
      console.log(`  - ${loc}`)
    })

    // 搜索中文字符在正文中的上下文
    if (guide.guide_content?.match(chineseRegex)) {
      console.log('\n正文中的中文上下文（前3处）:')
      let count = 0
      for (let i = 0; i < guide.guide_content.length && count < 3; i++) {
        if (chineseRegex.test(guide.guide_content[i])) {
          const start = Math.max(0, i - 30)
          const end = Math.min(guide.guide_content.length, i + 30)
          const context = guide.guide_content.substring(start, end)
          console.log(`\n  [${count + 1}] ...${context}...`)
          count++
        }
      }
    }
  } else {
    console.log('✅ 未发现中文字符')
  }

  console.log('\n' + '='.repeat(80))
}

checkSEOContent()
