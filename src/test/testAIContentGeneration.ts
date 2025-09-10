/**
 * AI内容生成功能测试脚本
 * 用于验证AI自动生成标题和简介的功能是否正常工作
 */

import aiContentService from '../services/aiContentService'

interface TestCase {
  name: string
  templateName: string
  prompt: string
  parameters: Record<string, any>
  userLanguage?: string
}

const testCases: TestCase[] = [
  {
    name: '婴儿职业采访 - 中文',
    templateName: 'Baby Professional Interview',
    prompt: 'A cynical female reporter interviews a happy-go-lucky baby in a tiny taxi driver uniform with cap, sitting in a toy car.',
    parameters: {
      baby_profession: 'uber_driver',
      reporter_question: 'Driving strangers around all day, isn\'t it exhausting?',
      baby_response: 'No way! I meet so many interesting people and explore new places!'
    },
    userLanguage: 'zh-CN'
  },
  {
    name: 'Baby Professional Interview - English',
    templateName: 'Baby Professional Interview',
    prompt: 'A cynical female reporter interviews a happy-go-lucky baby in a tiny food delivery uniform.',
    parameters: {
      baby_profession: 'food_delivery',
      reporter_question: 'Still delivering food this late, this job must be really tough, huh?',
      baby_response: 'Not tough at all! I love riding around the city, it\'s super cool!'
    },
    userLanguage: 'en'
  },
  {
    name: '魔法生物召唤 - 日语',
    templateName: 'Magical Creature Summon',
    prompt: 'A wizard summons a cute magical creature in an enchanted forest.',
    parameters: {
      creature_type: 'dragon',
      magic_spell: '召唤术！现身吧，小龙！',
      forest_setting: 'moonlit enchanted grove'
    },
    userLanguage: 'ja'
  },
  {
    name: 'Empty Parameters Test',
    templateName: 'Simple Template',
    prompt: 'A basic video prompt without complex parameters.',
    parameters: {},
    userLanguage: 'zh-CN'
  }
]

async function runTests() {
  console.log('🚀 开始AI内容生成测试...\n')
  
  // 首先检查服务健康状态
  console.log('🔍 检查API服务状态...')
  try {
    const isHealthy = await aiContentService.checkServiceHealth()
    console.log(`服务状态: ${isHealthy ? '✅ 正常' : '❌ 不可用'}`)
    
    if (!isHealthy) {
      console.log('⚠️  API服务不可用，测试将使用回退方案')
    }
  } catch (error) {
    console.log('⚠️  无法检查服务状态:', error)
  }
  
  console.log('\n' + '='.repeat(50))
  
  let successCount = 0
  let failCount = 0
  
  // 运行各个测试用例
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.log(`\n📋 测试 ${i + 1}/${testCases.length}: ${testCase.name}`)
    console.log(`模板: ${testCase.templateName}`)
    console.log(`语言: ${testCase.userLanguage || 'zh-CN'}`)
    console.log(`提示词长度: ${testCase.prompt.length} 字符`)
    console.log(`参数数量: ${Object.keys(testCase.parameters).length}`)
    
    const startTime = Date.now()
    
    try {
      console.log('🤖 生成中...')
      
      const result = await aiContentService.generateVideoMetadata({
        templateName: testCase.templateName,
        prompt: testCase.prompt,
        parameters: testCase.parameters,
        userLanguage: testCase.userLanguage
      })
      
      const duration = Date.now() - startTime
      
      console.log('✅ 生成成功!')
      console.log(`⏱️  耗时: ${duration}ms`)
      console.log(`📝 标题: "${result.title}"`)
      console.log(`📄 简介: "${result.description}"`)
      
      // 验证结果质量
      const titleValid = result.title.length >= 5 && result.title.length <= 100
      const descValid = result.description.length >= 20 && result.description.length <= 500
      
      console.log(`🔍 质量检查:`)
      console.log(`   标题长度: ${result.title.length} ${titleValid ? '✅' : '❌'}`)
      console.log(`   简介长度: ${result.description.length} ${descValid ? '✅' : '❌'}`)
      
      if (titleValid && descValid) {
        successCount++
        console.log('🎉 测试通过')
      } else {
        failCount++
        console.log('⚠️  质量检查未通过')
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      failCount++
      
      console.log('❌ 生成失败')
      console.log(`⏱️  耗时: ${duration}ms`)
      console.log(`🔥 错误: ${error instanceof Error ? error.message : String(error)}`)
    }
    
    console.log('-'.repeat(40))
    
    // 在测试之间添加延迟，避免API限流
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  // 输出测试总结
  console.log('\n' + '='.repeat(50))
  console.log('📊 测试总结')
  console.log(`总测试数: ${testCases.length}`)
  console.log(`成功: ${successCount} ✅`)
  console.log(`失败: ${failCount} ❌`)
  console.log(`成功率: ${((successCount / testCases.length) * 100).toFixed(1)}%`)
  
  if (successCount === testCases.length) {
    console.log('🎉 所有测试通过！AI内容生成功能正常工作')
  } else if (successCount > 0) {
    console.log('⚠️  部分测试通过，功能基本可用但需要调优')
  } else {
    console.log('💥 所有测试失败，请检查配置和网络连接')
  }
}

// 错误处理包装器
async function main() {
  try {
    await runTests()
  } catch (error) {
    console.error('💥 测试脚本执行失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { runTests, testCases }