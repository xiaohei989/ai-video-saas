/**
 * 简化版Baby Profession Interview模板测试
 * 测试移除多语言后的可编辑对话功能
 */

import { PromptGenerator } from '../services/promptGenerator'

// 简化版模板结构
const simplifiedTemplate = {
  "id": "baby-profession-interview",
  "promptTemplate": {
    "model": "veo3",
    "duration": "8s",
    "aspect_ratio": "16:9",
    "visual_core": {
      "description": "On a neon-lit city street at night, a cynical female reporter interviews a happy-go-lucky baby in a {uniform}, {scene_detail}. No subtitles.",
      "style": "cinematic, neon-noir aesthetic, with realistic wet streets reflecting the vibrant lights",
      "camera": "handheld-style medium shot on the reporter, then a stable close-up on the baby",
      "lighting": "dynamic, colorful light from surrounding neon signs"
    },
    "timeline": [
      {
        "time": "0-4s",
        "action": "The female reporter, looking unimpressed by the city bustle, asks her question with a jaded tone.",
        "dialogue": {
          "language": "en-US",
          "text": "{reporter_question}"
        }
      },
      {
        "time": "4-8s",
        "action": "The baby, full of energy, bounces slightly and answers with genuine excitement.",
        "dialogue": {
          "language": "en-US",
          "text": "{baby_response}"
        }
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
            "scene_detail": "sitting on a wheeled office chair with a tiny laptop",
            "default_reporter_question": "Coding all night with those deadlines, must be stressful, right?",
            "default_baby_response": "It's like playing with digital LEGOs! I love building cool stuff!"
          }
        },
        {
          "value": "custom",
          "metadata": {}
        }
      ]
    },
    "reporter_question": {
      "type": "text",
      "required": true,
      "default": "Still delivering food this late, this job must be really tough, huh?"
    },
    "baby_response": {
      "type": "text", 
      "required": true,
      "default": "Not tough at all! I love riding around the city, it's super cool!"
    },
    "custom_uniform": {
      "type": "text",
      "showWhen": { "field": "baby_profession", "value": "custom" }
    },
    "custom_scene_detail": {
      "type": "text",
      "showWhen": { "field": "baby_profession", "value": "custom" }
    },
    "uniform": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"},
    "scene_detail": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"}
  }
} as any

console.log('🧪 简化版Baby Profession Interview模板测试\n')

// 测试1: 程序员职业 + 默认对话
console.log('📋 测试1: 程序员职业 + 默认对话')
const test1Params = {
  baby_profession: 'programmer',
  reporter_question: 'Coding all night with those deadlines, must be stressful, right?',
  baby_response: "It's like playing with digital LEGOs! I love building cool stuff!"
}

try {
  const prompt1 = PromptGenerator.generatePromptForLocal(simplifiedTemplate, test1Params)
  console.log('✅ 生成成功')
  console.log('👕 制服描述:', prompt1.includes('tiny hoodie with tech company logo') ? '✅ 正确' : '❌ 错误')
  console.log('🪑 场景描述:', prompt1.includes('sitting on a wheeled office chair with a tiny laptop') ? '✅ 正确' : '❌ 错误')
  console.log('🎬 对话内容包含:', prompt1.includes('digital LEGOs') ? '✅ 正确' : '❌ 错误')
  console.log()
} catch (error) {
  console.error('❌ 测试1失败:', error)
}

// 测试2: 自定义对话内容
console.log('📋 测试2: 程序员职业 + 自定义对话')
const test2Params = {
  baby_profession: 'programmer',
  reporter_question: 'Working from home all day must be isolating, right?',
  baby_response: 'Are you kidding? I get to wear pajamas and code with my rubber duck!'
}

try {
  const prompt2 = PromptGenerator.generatePromptForLocal(simplifiedTemplate, test2Params)
  console.log('✅ 生成成功')
  console.log('🦆 自定义对话:', prompt2.includes('rubber duck') ? '✅ 正确' : '❌ 错误')
  console.log('👔 职业描述保持:', prompt2.includes('tiny hoodie') ? '✅ 正确' : '❌ 错误')
  console.log()
} catch (error) {
  console.error('❌ 测试2失败:', error)
}

// 测试3: 自定义职业
console.log('📋 测试3: 自定义职业')
const test3Params = {
  baby_profession: 'custom',
  custom_uniform: 'tiny astronaut suit with helmet',
  custom_scene_detail: 'floating in a toy space station',
  reporter_question: 'Living in zero gravity must be challenging, how do you manage?',
  baby_response: 'Best playground ever! I can do somersaults all day long!'
}

try {
  const prompt3 = PromptGenerator.generatePromptForLocal(simplifiedTemplate, test3Params)
  console.log('✅ 生成成功')
  console.log('👨‍🚀 自定义制服:', prompt3.includes('tiny astronaut suit') ? '✅ 正确' : '❌ 错误')
  console.log('🚀 自定义场景:', prompt3.includes('floating in a toy space station') ? '✅ 正确' : '❌ 错误')
  console.log('🤸 自定义对话:', prompt3.includes('somersaults') ? '✅ 正确' : '❌ 错误')
  console.log()
} catch (error) {
  console.error('❌ 测试3失败:', error)
}

// 测试4: 获取默认对话功能
console.log('📋 测试4: 获取职业默认对话')
const defaultDialogue = PromptGenerator.getDefaultDialogueForProfession(simplifiedTemplate, 'programmer')
console.log('📝 默认记者问题:', defaultDialogue.reporter_question)
console.log('👶 默认婴儿回答:', defaultDialogue.baby_response)

console.log('\n🎉 所有测试完成!')