#!/usr/bin/env node
/**
 * 关键词密度验证脚本
 * 用于验证算法计算的准确性
 */

// 测试文本
const testContent = `
Crunchy ASMR videos are extremely popular. Creating crunchy asmr content requires attention to detail.

ASMR triggers like crunchy sounds help people relax. The best crunchy food asmr includes frozen fruit asmr.

Crunchy ice eating asmr is satisfying. Many creators make asmr crunchy eating videos with crunchy food videos.

Asmr eating crunchy food is very popular. Crunchy eating asmr with asmr mouth sounds creates sensory satisfaction videos.

How to make asmr crunchy videos? Focus on eating crunchy food asmr with asmr eating no talking crunchy style.

Asmr crunchy sounds and crunchy asmr sounds are similar. Eating asmr crunchy content and satisfying asmr eating go together.

Crunchy asmr videos and asmr crunchy ice videos are trending. Frozen fruit asmr and asmr triggers are essential.
`

// 关键词列表
const keywords = [
  'crunchy asmr',
  'asmr triggers',
  'asmr crunchy ice',
  'asmr mouth sounds',
  'crunchy food asmr',
  'frozen fruit asmr',
  'asmr crunchy eating',
  'asmr crunchy sounds',
  'asmr eating crunchy',
  'crunchy asmr sounds',
  'crunchy asmr videos',
  'crunchy eating asmr',
  'crunchy food videos',
  'eating asmr crunchy',
  'satisfying asmr eating',
  'crunchy ice eating asmr',
  'eating crunchy food asmr',
  'how to make asmr crunchy',
  'sensory satisfaction videos',
  'asmr eating no talking crunchy'
]

/**
 * 精确计算关键词密度
 */
function calculateKeywordDensity(content, keywords) {
  if (!content || keywords.length === 0) {
    return {}
  }

  // 1. 文本预处理
  const normalizedContent = content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  // 2. 分词
  const words = normalizedContent.split(/[\s\p{P}]+/u).filter(w => w.length > 0)
  const totalWords = words.length

  console.log(`📝 总词数: ${totalWords}`)
  console.log(`📄 前50个词: ${words.slice(0, 50).join(' ')}\n`)

  if (totalWords === 0) {
    return {}
  }

  const density = {}

  // 3. 计数每个关键词
  keywords.forEach(keyword => {
    const normalizedKeyword = keyword.toLowerCase().trim()
    const keywordWords = normalizedKeyword.split(/\s+/)

    let count = 0

    if (keywordWords.length === 1) {
      // 单词关键词
      count = words.filter(w => w === keywordWords[0]).length
    } else {
      // 多词关键词：滑动窗口
      for (let i = 0; i <= words.length - keywordWords.length; i++) {
        const match = keywordWords.every((kw, idx) => words[i + idx] === kw)
        if (match) {
          count++
        }
      }
    }

    const densityValue = (count / totalWords) * 100
    density[keyword] = {
      count: count,
      density: parseFloat(densityValue.toFixed(1))
    }
  })

  return density
}

// 执行测试
console.log('🔍 开始验证关键词密度计算...\n')
const result = calculateKeywordDensity(testContent, keywords)

console.log('📊 计算结果：\n')
keywords.forEach(keyword => {
  const data = result[keyword]
  const status = data.density >= 1.0 && data.density <= 2.5 ? '✅' : '❌'
  console.log(`${status} ${keyword}`)
  console.log(`   出现次数: ${data.count}次`)
  console.log(`   密度: ${data.density}%`)
  console.log()
})

// 统计
const total = keywords.length
const qualified = keywords.filter(k => {
  const d = result[k].density
  return d >= 1.0 && d <= 2.5
}).length

console.log(`\n📈 统计：${qualified}/${total} 个关键词密度达标 (1.0%-2.5%)`)
