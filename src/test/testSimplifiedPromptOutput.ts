/**
 * 查看简化版模板的完整输出
 */

import { PromptGenerator } from '../services/promptGenerator'

const simplifiedTemplate = {
  "id": "baby-profession-interview",
  "promptTemplate": {
    "visual_core": {
      "description": "On a neon-lit city street at night, a cynical female reporter interviews a happy-go-lucky baby in a {uniform}, {scene_detail}. No subtitles."
    },
    "timeline": [
      {
        "time": "0-4s", 
        "action": "The female reporter asks: '{reporter_question}'"
      },
      {
        "time": "4-8s",
        "action": "The baby responds: '{baby_response}'"
      }
    ]
  },
  "params": {
    "baby_profession": {
      "type": "select",
      "options": [
        {
          "value": "programmer",
          "metadata": {
            "uniform": "tiny hoodie with tech company logo",
            "scene_detail": "sitting on a wheeled office chair with a tiny laptop"
          }
        }
      ]
    },
    "reporter_question": { "type": "text" },
    "baby_response": { "type": "text" },
    "uniform": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"},
    "scene_detail": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"}
  }
} as any

console.log('🔍 简化版模板完整输出测试\n')

const testParams = {
  baby_profession: 'programmer',
  reporter_question: 'Working from home all day must be isolating, right?',
  baby_response: 'Are you kidding? I get to wear pajamas and code with my rubber duck!'
}

console.log('📥 输入参数:')
console.log(JSON.stringify(testParams, null, 2))

console.log('\n📤 生成的提示词:')
const prompt = PromptGenerator.generatePromptForLocal(simplifiedTemplate, testParams)
console.log('='.repeat(80))
console.log(prompt)
console.log('='.repeat(80))

console.log('\n🔗 解析后的参数:')
const resolvedParams = PromptGenerator.resolveLinkedParameters(simplifiedTemplate, testParams)
console.log(JSON.stringify(resolvedParams, null, 2))

console.log('\n🎯 检查关键内容:')
console.log('- 包含自定义问题:', prompt.includes(testParams.reporter_question) ? '✅' : '❌')
console.log('- 包含自定义回答:', prompt.includes(testParams.baby_response) ? '✅' : '❌')
console.log('- 包含职业制服:', prompt.includes('tiny hoodie') ? '✅' : '❌')
console.log('- 包含场景描述:', prompt.includes('wheeled office chair') ? '✅' : '❌')