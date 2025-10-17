#!/usr/bin/env node
/**
 * 快速测试SEO服务器 - 使用简单数据
 */

console.log('🧪 快速测试SEO服务器...\n')

const testData = {
  language: 'en',
  target_keyword: 'test keyword',
  meta_title: 'Test Title for SEO Optimization Guide',
  meta_description: 'This is a test meta description for SEO optimization. Start now!',
  meta_keywords: 'test, seo, optimization',
  guide_intro: 'This is a short intro paragraph.',
  guide_content: 'This is short test content with test keyword mentioned twice. Test keyword is important.',
  faq_items: [
    { question: 'What is test?', answer: 'Test is testing.' },
    { question: 'Why test?', answer: 'To verify functionality.' }
  ],
  keyword_density: {
    'test keyword': 2.5
  }
}

console.log('📋 测试数据: Meta标题', testData.meta_title)
console.log('☁️  调用 http://localhost:3030/calculate-seo-score\n')

const startTime = Date.now()

fetch('http://localhost:3030/calculate-seo-score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
})
  .then(res => {
    const elapsed = Date.now() - startTime
    console.log(`✅ HTTP ${res.status} (耗时: ${elapsed}ms)`)
    return res.json()
  })
  .then(result => {
    if (result.success) {
      console.log('\n✅ 评分成功!')
      console.log(`   总分: ${result.data.total_score}/100`)
      console.log(`   建议数: ${result.data.recommendations?.length || 0}`)
      if (result.data.recommendations?.length > 0) {
        console.log('\n建议:')
        result.data.recommendations.forEach((r, i) => {
          console.log(`  ${i + 1}. ${r}`)
        })
      }
    } else {
      console.error('\n❌ 评分失败:', result.error)
    }
  })
  .catch(error => {
    console.error('\n❌ 请求失败:', error.message)
  })
