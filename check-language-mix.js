import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

/**
 * 检测文本中的非英文字符
 */
function detectNonEnglishChars(text, fieldName) {
  if (!text) return null

  // 中文字符
  const chineseRegex = /[\u4e00-\u9fa5]/g
  // 日文字符（平假名、片假名、日文汉字）
  const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf]/g
  // 韩文字符
  const koreanRegex = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g
  // 阿拉伯文
  const arabicRegex = /[\u0600-\u06ff]/g
  // 西班牙语特殊字符（带重音符号）
  const spanishRegex = /[áéíóúüñÁÉÍÓÚÜÑ¿¡]/g

  const results = []

  const chineseMatches = text.match(chineseRegex)
  if (chineseMatches) {
    results.push({
      language: '中文',
      count: chineseMatches.length,
      samples: chineseMatches.slice(0, 10).join(', ')
    })
  }

  const japaneseMatches = text.match(japaneseRegex)
  if (japaneseMatches) {
    results.push({
      language: '日文',
      count: japaneseMatches.length,
      samples: japaneseMatches.slice(0, 10).join(', ')
    })
  }

  const koreanMatches = text.match(koreanRegex)
  if (koreanMatches) {
    results.push({
      language: '韩文',
      count: koreanMatches.length,
      samples: koreanMatches.slice(0, 10).join(', ')
    })
  }

  const arabicMatches = text.match(arabicRegex)
  if (arabicMatches) {
    results.push({
      language: '阿拉伯文',
      count: arabicMatches.length,
      samples: arabicMatches.slice(0, 10).join(', ')
    })
  }

  const spanishMatches = text.match(spanishRegex)
  if (spanishMatches) {
    results.push({
      language: '西班牙语特殊字符',
      count: spanishMatches.length,
      samples: spanishMatches.slice(0, 10).join(', ')
    })
  }

  if (results.length > 0) {
    console.log(`\n⚠️ 【${fieldName}】发现非英文字符:`)
    results.forEach(r => {
      console.log(`  - ${r.language}: ${r.count}个字符`)
      console.log(`    示例: ${r.samples}`)
    })
    return results
  }

  return null
}

/**
 * 在文本中查找包含非英文字符的上下文
 */
function findContext(text, regex, maxResults = 3) {
  const contexts = []
  let count = 0

  for (let i = 0; i < text.length && count < maxResults; i++) {
    if (regex.test(text[i])) {
      const start = Math.max(0, i - 50)
      const end = Math.min(text.length, i + 50)
      const context = text.substring(start, end)
      contexts.push(context)
      count++
      // 重置regex的lastIndex
      regex.lastIndex = 0
    }
  }

  return contexts
}

async function checkLanguageMix() {
  const seoGuideId = '31391a1e-5a9a-4184-8082-0e5168746193'

  console.log(`\n🔍 检查 SEO 指南语言混用问题`)
  console.log(`SEO Guide ID: ${seoGuideId}`)
  console.log(`目标语言: English\n`)

  const { data: guide, error } = await supabase
    .from('template_seo_guides')
    .select('*')
    .eq('id', seoGuideId)
    .maybeSingle()

  if (error) {
    console.error('❌ 查询错误:', error)
    return
  }

  if (!guide) {
    console.log('❌ 未找到该记录')
    return
  }

  console.log(`✅ 找到记录\n`)
  console.log(`语言: ${guide.language}`)
  console.log(`主关键词: ${guide.primary_keyword}`)
  console.log(`\n${'='.repeat(80)}`)

  // 逐个检查每个字段
  const fieldsToCheck = [
    { name: 'Meta标题', value: guide.meta_title },
    { name: 'Meta描述', value: guide.meta_description },
    { name: '主关键词', value: guide.primary_keyword },
    { name: '引言 (guide_intro)', value: guide.guide_intro },
    { name: '正文 (guide_content)', value: guide.guide_content },
    { name: 'FAQ', value: JSON.stringify(guide.faq_items) }
  ]

  let totalIssues = 0

  for (const field of fieldsToCheck) {
    const result = detectNonEnglishChars(field.value, field.name)
    if (result) {
      totalIssues++

      // 显示上下文
      if (field.name === '引言 (guide_intro)') {
        console.log(`\n📝 完整引言内容:`)
        console.log(`${field.value}`)
      }

      // 如果是正文，显示上下文
      if (field.name === '正文 (guide_content)' && field.value) {
        const chineseRegex = /[\u4e00-\u9fa5]/g
        const contexts = findContext(field.value, chineseRegex, 3)
        if (contexts.length > 0) {
          console.log(`\n  正文中的非英文上下文（前3处）:`)
          contexts.forEach((ctx, i) => {
            console.log(`\n  [${i + 1}] ...${ctx}...`)
          })
        }
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  if (totalIssues === 0) {
    console.log(`\n✅ 结论: 所有SEO内容字段均为纯英文，无语言混用问题！`)
  } else {
    console.log(`\n⚠️ 结论: 发现 ${totalIssues} 个字段存在非英文字符`)
  }
  console.log(`\n${'='.repeat(80)}\n`)
}

checkLanguageMix()
