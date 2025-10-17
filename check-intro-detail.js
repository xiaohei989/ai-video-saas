import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

async function checkIntroDetail() {
  const seoGuideId = '31391a1e-5a9a-4184-8082-0e5168746193'

  console.log(`\n🔍 详细检查引言内容`)
  console.log(`SEO Guide ID: ${seoGuideId}\n`)

  const { data: guide, error } = await supabase
    .from('template_seo_guides')
    .select('id, language, primary_keyword, guide_intro, meta_title')
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
  console.log(`目标语言: ${guide.language}`)
  console.log(`主关键词: ${guide.primary_keyword}`)
  console.log(`Meta标题: ${guide.meta_title}`)
  console.log(`\n${'='.repeat(80)}`)
  console.log(`完整引言内容 (guide_intro):`)
  console.log(`${'='.repeat(80)}`)
  console.log(guide.guide_intro)
  console.log(`${'='.repeat(80)}`)
  console.log(`\n引言长度: ${guide.guide_intro?.length || 0} 字符`)

  // 逐字符检查
  console.log(`\n${'='.repeat(80)}`)
  console.log(`逐字符分析（显示 ASCII 码）:`)
  console.log(`${'='.repeat(80)}`)

  if (guide.guide_intro) {
    const chars = guide.guide_intro.split('')

    // 检测所有非标准ASCII字符
    const nonAscii = []
    chars.forEach((char, index) => {
      const code = char.charCodeAt(0)
      // ASCII 可打印字符范围: 32-126
      // 如果不在这个范围（除了换行符10、回车符13、制表符9），标记为非标准
      if (code > 127) {
        nonAscii.push({
          char,
          code,
          position: index,
          context: guide.guide_intro.substring(Math.max(0, index - 20), Math.min(guide.guide_intro.length, index + 20))
        })
      }
    })

    if (nonAscii.length > 0) {
      console.log(`\n⚠️ 发现 ${nonAscii.length} 个非标准ASCII字符 (code > 127):`)
      nonAscii.slice(0, 10).forEach((item, i) => {
        console.log(`\n  [${i + 1}] 字符: '${item.char}' | ASCII码: ${item.code} | 位置: ${item.position}`)
        console.log(`      上下文: ...${item.context}...`)
      })
      if (nonAscii.length > 10) {
        console.log(`\n  ... 还有 ${nonAscii.length - 10} 个非标准字符`)
      }
    } else {
      console.log(`\n✅ 所有字符都在标准ASCII范围内 (0-127)`)
    }

    // 专门检查 Unicode 字符类别
    const categories = {
      chinese: 0,
      japanese: 0,
      korean: 0,
      arabic: 0,
      cyrillic: 0,
      other: 0
    }

    chars.forEach(char => {
      const code = char.charCodeAt(0)
      if (code >= 0x4e00 && code <= 0x9fa5) {
        categories.chinese++
      } else if ((code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff)) {
        categories.japanese++
      } else if ((code >= 0xac00 && code <= 0xd7af) || (code >= 0x1100 && code <= 0x11ff)) {
        categories.korean++
      } else if (code >= 0x0600 && code <= 0x06ff) {
        categories.arabic++
      } else if (code >= 0x0400 && code <= 0x04ff) {
        categories.cyrillic++
      } else if (code > 127 && code < 0x0400) {
        categories.other++
      }
    })

    console.log(`\n${'='.repeat(80)}`)
    console.log(`Unicode 字符类别统计:`)
    console.log(`${'='.repeat(80)}`)
    console.log(`中文字符: ${categories.chinese}`)
    console.log(`日文字符: ${categories.japanese}`)
    console.log(`韩文字符: ${categories.korean}`)
    console.log(`阿拉伯文字符: ${categories.arabic}`)
    console.log(`西里尔字符(俄语等): ${categories.cyrillic}`)
    console.log(`其他非ASCII字符: ${categories.other}`)

    const totalNonEnglish = Object.values(categories).reduce((sum, val) => sum + val, 0)
    if (totalNonEnglish === 0) {
      console.log(`\n✅ 确认：引言内容100%为英文或标准ASCII字符`)
    } else {
      console.log(`\n⚠️ 警告：发现 ${totalNonEnglish} 个非英文字符`)
    }
  }

  console.log(`\n${'='.repeat(80)}\n`)
}

checkIntroDetail()
