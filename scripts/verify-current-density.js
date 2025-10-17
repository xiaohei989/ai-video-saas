#!/usr/bin/env node
/**
 * 当前内容关键词密度验证工具
 * 用于在浏览器Console中验证SEO页面显示的密度是否准确
 *
 * 使用方法：
 * 1. 在SEO管理页面打开浏览器Console（F12 → Console标签）
 * 2. 复制下面的验证代码并粘贴到Console
 * 3. 按Enter运行
 */

// ==================== 浏览器Console验证代码 ====================
// 复制下面这段代码到浏览器Console运行

const CONSOLE_CODE = `
// 🔍 关键词密度验证工具

console.log('🔍 开始验证关键词密度统计...\\n')

// 1. 尝试从不同来源获取数据
let record = null

// 尝试从React Admin获取
if (window.__REACT_ADMIN_RECORD__) {
  record = window.__REACT_ADMIN_RECORD__
  console.log('✅ 从 __REACT_ADMIN_RECORD__ 读取数据')
}

// 尝试从React DevTools获取
if (!record && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('⚠️  无法自动读取，请手动提供record对象')
  console.log('💡 方法：在React DevTools中找到record对象，然后运行：')
  console.log('   verifyDensity(yourRecordObject)')
}

// 如果都没有，提示用户
if (!record) {
  console.error('❌ 无法自动读取数据')
  console.log('\\n请手动执行以下步骤：')
  console.log('1. 在Network标签找到最近的 getOne 请求')
  console.log('2. 复制Response中的data对象')
  console.log('3. 运行：verifyDensity(复制的数据)')

  // 定义全局验证函数
  window.verifyDensity = function(recordData) {
    performVerification(recordData)
  }

  console.log('\\n✅ 已定义 verifyDensity() 函数，准备好后调用它')
  return
}

// 2. 定义密度计算函数
function calculateDensity(content, keywords) {
  if (!content || keywords.length === 0) {
    return {}
  }

  // 文本预处理
  const normalizedContent = content
    .toLowerCase()
    .replace(/\\s+/g, ' ')
    .trim()

  // 分词
  const words = normalizedContent.split(/[\\s\\p{P}]+/u).filter(w => w.length > 0)
  const totalWords = words.length

  console.log(\`📝 总词数: \${totalWords}\`)

  const density = {}

  // 计算每个关键词的密度
  keywords.forEach(keyword => {
    const normalizedKeyword = keyword.toLowerCase().trim()
    const keywordWords = normalizedKeyword.split(/\\s+/)

    let count = 0

    if (keywordWords.length === 1) {
      // 单词关键词
      count = words.filter(w => w === keywordWords[0]).length
    } else {
      // 多词关键词：滑动窗口
      for (let i = 0; i <= words.length - keywordWords.length; i++) {
        const match = keywordWords.every((kw, idx) => words[i + idx] === kw)
        if (match) count++
      }
    }

    const densityValue = (count / totalWords) * 100
    density[keyword] = {
      count: count,
      density: parseFloat(densityValue.toFixed(2))
    }
  })

  return density
}

// 3. 执行验证
function performVerification(recordData) {
  console.log('\\n🔄 开始计算密度...\\n')

  // 提取完整内容
  const parts = []
  if (recordData.meta_title) parts.push(recordData.meta_title)
  if (recordData.meta_description) parts.push(recordData.meta_description)
  if (recordData.meta_keywords) parts.push(recordData.meta_keywords)
  if (recordData.guide_intro) parts.push(recordData.guide_intro)
  if (recordData.guide_content) parts.push(recordData.guide_content)
  if (recordData.faq_items && recordData.faq_items.length > 0) {
    recordData.faq_items.forEach(item => {
      parts.push(item.question)
      parts.push(item.answer)
    })
  }

  const fullContent = parts.join('\\n\\n')

  console.log(\`📄 内容长度: \${fullContent.length} 字符\`)
  console.log(\`📋 包含部分: meta(\${recordData.meta_title ? 'Y' : 'N'}) intro(\${recordData.guide_intro ? 'Y' : 'N'}) content(\${recordData.guide_content ? 'Y' : 'N'}) faq(\${recordData.faq_items?.length || 0})\`)

  // 获取关键词列表
  const allKeywords = [
    ...(recordData.primary_keyword ? [recordData.primary_keyword] : []),
    ...(recordData.long_tail_keywords || []),
    ...(recordData.secondary_keywords || [])
  ].filter(Boolean)

  console.log(\`🔑 关键词数量: \${allKeywords.length}\`)
  console.log('')

  // 计算密度
  const calculated = calculateDensity(fullContent, allKeywords)

  // 获取显示的密度
  const displayed = recordData.keyword_density || {}

  // 对比结果
  console.log('\\n📊 验证结果：\\n')

  let matchCount = 0
  let mismatchCount = 0
  const mismatches = []

  allKeywords.forEach(keyword => {
    const calc = calculated[keyword]?.density || 0
    const disp = displayed[keyword] || 0
    const diff = Math.abs(calc - disp)

    const status = diff < 0.01 ? '✅' : '❌'
    const message = \`\${status} \${keyword}: 计算=\${calc.toFixed(2)}% 显示=\${disp.toFixed(2)}% 差异=\${diff.toFixed(2)}%\`

    if (diff < 0.01) {
      matchCount++
    } else {
      mismatchCount++
      mismatches.push({
        keyword,
        calculated: calc,
        displayed: disp,
        diff: diff
      })
    }

    console.log(message)
  })

  // 汇总
  console.log(\`\\n📈 统计汇总：\`)
  console.log(\`   ✅ 匹配: \${matchCount}/\${allKeywords.length}\`)
  console.log(\`   ❌ 不匹配: \${mismatchCount}/\${allKeywords.length}\`)

  if (mismatchCount > 0) {
    console.log(\`\\n⚠️  发现 \${mismatchCount} 个差异较大的关键词：\`)
    console.table(mismatches)

    console.log('\\n🔧 可能的原因：')
    console.log('1. 内容在评分后被修改过')
    console.log('2. 使用了不同版本的算法')
    console.log('3. 文本预处理方式不同')
  } else {
    console.log('\\n🎉 所有关键词密度统计准确！')
  }

  // 返回详细数据供进一步分析
  return {
    calculated,
    displayed,
    mismatches,
    totalWords: fullContent.split(/[\\s\\p{P}]+/u).filter(w => w.length > 0).length
  }
}

// 如果已经有record，立即执行
if (record) {
  const result = performVerification(record)

  // 将结果保存到全局变量
  window.densityVerificationResult = result
  console.log('\\n💾 验证结果已保存到 window.densityVerificationResult')
}
`

// 输出使用说明
console.log('======================================')
console.log('  关键词密度验证工具')
console.log('======================================')
console.log('')
console.log('📋 使用方法：')
console.log('')
console.log('1. 在SEO管理页面打开浏览器开发者工具（F12）')
console.log('2. 切换到 Console 标签')
console.log('3. 复制下面的代码并粘贴到Console')
console.log('4. 按 Enter 运行')
console.log('')
console.log('======================================')
console.log('开始复制（下一行开始）')
console.log('======================================')
console.log('')
console.log(CONSOLE_CODE)
console.log('')
console.log('======================================')
console.log('复制结束（上一行结束）')
console.log('======================================')
