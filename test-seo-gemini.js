/**
 * SEO内容生成 - Gemini 2.5 Pro 完整测试
 * 模拟真实的SEO Guide生成场景
 */

const API_KEY = 'sk-v3f3HRTuOzGpjpmfZk1Dz4YMjNZJa2Uo9HgSGnWd5NZ9rEZn'
const ENDPOINT = 'https://api.apicore.ai/v1/chat/completions'

async function testSEOGeneration() {
  console.log('========================================')
  console.log('SEO内容生成 - Gemini 2.5 Pro 测试')
  console.log('========================================\n')

  const prompt = `你是一位专业的SEO内容编写专家和视频教程作者。请为以下视频模板创建一份完整的、SEO优化的用户指南。

## 模板信息
- 模板名称: ASMR Food Video
- 模板描述: Create relaxing ASMR food videos with crispy sounds
- 分类: Food & Cooking
- 标签: ASMR, Food, Cooking, Relaxation

## SEO关键词
- 主关键词: ASMR food videos
- 长尾关键词: food asmr videos no talking, how to make asmr food videos, asmr cooking videos

## 目标语言
请用 **English** 编写所有内容。

## 输出要求
请生成以下内容，必须严格按照JSON格式返回：

\`\`\`json
{
  "meta_title": "页面标题（55-60字符，包含主关键词）",
  "meta_description": "页面描述（150-155字符，吸引点击）",
  "meta_keywords": "逗号分隔的关键词列表",
  "guide_intro": "引言段落（100-150字，吸引读者继续阅读）",
  "guide_content": "完整的用户指南内容（Markdown格式，500-800字）",
  "faq_items": [
    {
      "question": "常见问题1",
      "answer": "详细答案"
    },
    {
      "question": "常见问题2",
      "answer": "详细答案"
    }
  ],
  "secondary_keywords": ["次要关键词1", "次要关键词2", "次要关键词3"]
}
\`\`\`

请严格按照JSON格式输出，不要添加额外的说明文字。`

  try {
    console.log('🚀 开始生成SEO内容...\n')
    const startTime = Date.now()

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    })

    const responseTime = Date.now() - startTime

    console.log(`⏱️  响应时间: ${responseTime}ms`)
    console.log(`📊 HTTP状态码: ${response.status} ${response.statusText}\n`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API调用失败 (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    // 检查响应
    console.log('📦 响应分析:')
    console.log(`  - Model: ${data.model}`)
    console.log(`  - Choices数组长度: ${data.choices?.length || 0}`)
    console.log(`  - Token使用: ${data.usage?.total_tokens || 0}`)
    console.log(`  - Completion Tokens: ${data.usage?.completion_tokens || 0}`)
    console.log(`  - Text Tokens: ${data.usage?.completion_tokens_details?.text_tokens || 0}`)
    console.log(`  - Reasoning Tokens: ${data.usage?.completion_tokens_details?.reasoning_tokens || 0}\n`)

    if (!data.choices || data.choices.length === 0) {
      console.error('❌ 错误: choices数组为空')
      console.error('尽管消耗了tokens，但没有返回内容')
      console.error('完整响应:', JSON.stringify(data, null, 2))
      return
    }

    if (!data.choices[0].message || !data.choices[0].message.content) {
      console.error('❌ 错误: 响应格式不正确')
      console.error('完整响应:', JSON.stringify(data, null, 2))
      return
    }

    const content = data.choices[0].message.content
    console.log('✅ 成功获取内容!')
    console.log(`📝 内容长度: ${content.length} 字符\n`)

    // 尝试解析JSON
    try {
      const parsedContent = JSON.parse(content)

      console.log('✅ JSON解析成功!\n')
      console.log('━'.repeat(60))
      console.log('生成的SEO内容预览:')
      console.log('━'.repeat(60))
      console.log(`\n📌 Meta Title (${parsedContent.meta_title?.length || 0} 字符):`)
      console.log(`   ${parsedContent.meta_title}\n`)
      console.log(`📝 Meta Description (${parsedContent.meta_description?.length || 0} 字符):`)
      console.log(`   ${parsedContent.meta_description}\n`)
      console.log(`🏷️  Meta Keywords:`)
      console.log(`   ${parsedContent.meta_keywords}\n`)
      console.log(`📖 Guide Intro (${parsedContent.guide_intro?.length || 0} 字符):`)
      console.log(`   ${parsedContent.guide_intro?.substring(0, 200)}...\n`)
      console.log(`📄 Guide Content (${parsedContent.guide_content?.length || 0} 字符):`)
      console.log(`   ${parsedContent.guide_content?.substring(0, 200)}...\n`)
      console.log(`❓ FAQ Items: ${parsedContent.faq_items?.length || 0} 个问题`)
      if (parsedContent.faq_items && parsedContent.faq_items.length > 0) {
        parsedContent.faq_items.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.question}`)
        })
      }
      console.log(`\n🔑 Secondary Keywords: ${parsedContent.secondary_keywords?.length || 0} 个`)
      if (parsedContent.secondary_keywords && parsedContent.secondary_keywords.length > 0) {
        console.log(`   ${parsedContent.secondary_keywords.join(', ')}`)
      }

      console.log('\n' + '━'.repeat(60))
      console.log('\n✅ 测试完全成功!')
      console.log('Gemini 2.5 Pro 在JSON模式下可以正常工作')
      console.log('适合用于SEO内容生成')

    } catch (parseError) {
      console.error('❌ JSON解析失败:', parseError.message)
      console.error('返回的内容:')
      console.error(content)
    }

  } catch (error) {
    console.error('❌ 测试失败:')
    console.error(`  错误: ${error.message}`)
    console.error(`  堆栈: ${error.stack}`)
  }
}

// 运行测试
testSEOGeneration().catch(console.error)
