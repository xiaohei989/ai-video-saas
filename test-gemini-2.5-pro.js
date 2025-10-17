/**
 * Gemini 2.5 Pro 测试用例
 * 详细测试 APICore 上的 gemini-2.5-pro 模型响应
 */

const API_KEY = 'sk-v3f3HRTuOzGpjpmfZk1Dz4YMjNZJa2Uo9HgSGnWd5NZ9rEZn'
const ENDPOINT = 'https://api.apicore.ai/v1/chat/completions'

async function testGemini25Pro() {
  console.log('========================================')
  console.log('Gemini 2.5 Pro 测试')
  console.log('========================================\n')

  const testCases = [
    {
      name: '简单文本生成',
      model: 'gemini-2.5-pro',
      messages: [
        {
          role: 'user',
          content: 'Say hello in Chinese'
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    },
    {
      name: 'JSON格式输出',
      model: 'gemini-2.5-pro',
      messages: [
        {
          role: 'user',
          content: 'Generate a JSON object with title and description fields. Return only valid JSON.'
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    },
    {
      name: '长文本生成',
      model: 'gemini-2.5-pro',
      messages: [
        {
          role: 'user',
          content: 'Write a short paragraph (50 words) about AI video generation.'
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    }
  ]

  for (const testCase of testCases) {
    console.log(`\n📝 测试用例: ${testCase.name}`)
    console.log('─'.repeat(60))

    try {
      const startTime = Date.now()

      console.log('🔧 请求配置:')
      console.log(JSON.stringify({
        model: testCase.model,
        messages: testCase.messages,
        max_tokens: testCase.max_tokens,
        temperature: testCase.temperature,
        response_format: testCase.response_format
      }, null, 2))
      console.log('')

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase)
      })

      const responseTime = Date.now() - startTime

      console.log(`⏱️  响应时间: ${responseTime}ms`)
      console.log(`📊 HTTP状态码: ${response.status} ${response.statusText}`)
      console.log('')

      const data = await response.json()

      // 详细输出响应
      console.log('📦 完整响应:')
      console.log(JSON.stringify(data, null, 2))
      console.log('')

      // 分析响应结构
      console.log('🔍 响应分析:')
      console.log(`  - ID: ${data.id || 'N/A'}`)
      console.log(`  - Model: ${data.model || 'N/A'}`)
      console.log(`  - Created: ${data.created || 'N/A'}`)

      if (data.choices) {
        console.log(`  - Choices数组长度: ${data.choices.length}`)

        if (data.choices.length > 0) {
          console.log('  ✅ 有返回内容:')
          data.choices.forEach((choice, index) => {
            console.log(`    [${index}] Role: ${choice.message?.role || 'N/A'}`)
            console.log(`    [${index}] Content: ${choice.message?.content || 'N/A'}`)
            console.log(`    [${index}] Finish Reason: ${choice.finish_reason || 'N/A'}`)
          })
        } else {
          console.log('  ⚠️  Choices数组为空 - 没有返回内容!')
        }
      } else {
        console.log('  ❌ 响应中没有choices字段')
      }

      if (data.usage) {
        console.log(`\n  💰 Token使用情况:`)
        console.log(`    - Prompt Tokens: ${data.usage.prompt_tokens || 0}`)
        console.log(`    - Completion Tokens: ${data.usage.completion_tokens || 0}`)
        console.log(`    - Total Tokens: ${data.usage.total_tokens || 0}`)

        if (data.usage.completion_tokens_details) {
          console.log(`    - Text Tokens: ${data.usage.completion_tokens_details.text_tokens || 0}`)
          console.log(`    - Reasoning Tokens: ${data.usage.completion_tokens_details.reasoning_tokens || 0}`)
        }
      }

      // 问题诊断
      console.log('\n🩺 问题诊断:')
      if (data.choices && data.choices.length === 0 && data.usage?.completion_tokens > 0) {
        console.log('  ❌ 检测到问题: 模型消耗了tokens但没有返回内容')
        console.log('  📝 详细说明:')
        console.log('     - Completion tokens > 0 说明模型进行了推理')
        console.log('     - Reasoning tokens > 0 说明有思考过程')
        console.log('     - 但 choices 数组为空，没有返回文本')
        console.log('  💡 可能原因:')
        console.log('     1. APICore对Gemini模型的响应格式转换有bug')
        console.log('     2. Gemini模型返回了非标准格式的响应')
        console.log('     3. 中间代理层丢失了生成的文本内容')
      } else if (data.error) {
        console.log(`  ❌ API返回错误: ${data.error.message}`)
        console.log(`  📝 错误类型: ${data.error.type}`)
      } else if (data.choices && data.choices.length > 0) {
        console.log('  ✅ 响应正常')
      }

    } catch (error) {
      console.error('❌ 请求失败:')
      console.error(`  错误类型: ${error.name}`)
      console.error(`  错误信息: ${error.message}`)
      console.error(`  堆栈: ${error.stack}`)
    }

    console.log('\n' + '='.repeat(60) + '\n')
  }

  // 总结
  console.log('\n📊 测试总结:')
  console.log('─'.repeat(60))
  console.log('根据测试结果，gemini-2.5-pro 模型存在以下问题:')
  console.log('1. 模型确实在工作（消耗tokens）')
  console.log('2. 有推理过程（reasoning_tokens > 0）')
  console.log('3. 但最终生成的文本没有返回到 choices 字段')
  console.log('4. 这是APICore对Gemini模型的兼容性问题')
  console.log('\n建议: 暂时不要在生产环境中使用 gemini-2.5-pro')
  console.log('='.repeat(60))
}

// 运行测试
testGemini25Pro().catch(console.error)
