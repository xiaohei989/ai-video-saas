/**
 * Baby Profession Interview模板测试
 * 测试多语言对话和职业参数联动功能
 */

import { PromptGenerator } from '../services/promptGenerator'

// 模拟模板数据 (从实际文件内容复制)
const babyProfessionTemplate = {
  "id": "baby-profession-interview",
  "slug": "baby-profession-interview", 
  "name": "Baby Professional Interview",
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
          "language": "{dialogue_language}",
          "text": "{reporter_question}"
        }
      },
      {
        "time": "4-8s", 
        "action": "The baby, full of energy, bounces slightly and answers with genuine excitement.",
        "dialogue": {
          "language": "{dialogue_language}",
          "text": "{baby_response}"
        }
      }
    ],
    "audio": {
      "voiceover": [
        {
          "role": "Female Reporter",
          "language": "{dialogue_language}",
          "style": "A world-weary, slightly jaded female reporter's voice.",
          "text": "{reporter_question}"
        },
        {
          "role": "Baby",
          "language": "{dialogue_language}",
          "style": "An excited, carefree, and energetic baby's voice.",
          "text": "{baby_response}"
        }
      ]
    }
  },
  "params": {
    "baby_profession": {
      "type": "select",
      "label": "Baby's Profession",
      "required": true,
      "default": "food_delivery",
      "options": [
        {
          "value": "food_delivery",
          "label": "🛵 Food Delivery",
          "metadata": {
            "uniform": "tiny food delivery uniform",
            "scene_detail": "sitting on a tricycle",
            "reporter_question_en": "Still delivering food this late, this job must be really tough, huh?",
            "baby_response_en": "Not tough at all! I love riding around the city, it's super cool!",
            "reporter_question_zh": "这么晚还在送外卖，这工作一定很辛苦吧？",
            "baby_response_zh": "一点都不辛苦！我喜欢在城市里骑车，超级酷的！"
          }
        },
        {
          "value": "programmer",
          "label": "💻 Programmer",
          "metadata": {
            "uniform": "tiny hoodie with tech company logo",
            "scene_detail": "sitting on a wheeled office chair with a tiny laptop",
            "reporter_question_en": "Coding all night with those deadlines, must be stressful, right?",
            "baby_response_en": "It's like playing with digital LEGOs! I love building cool stuff!",
            "reporter_question_zh": "熬夜赶deadline写代码，压力很大吧？",
            "baby_response_zh": "这就像玩数字乐高！我喜欢创造酷炫的东西！"
          }
        },
        {
          "value": "custom",
          "label": "✏️ Custom Profession"
        }
      ]
    },
    "dialogue_language": {
      "type": "select",
      "label": "Dialogue Language", 
      "required": false,
      "default": "en-US",
      "options": [
        { "value": "en-US", "label": "English 🇺🇸" },
        { "value": "zh-CN", "label": "Chinese 🇨🇳" }
      ]
    },
    "custom_uniform": {
      "type": "text",
      "label": "Custom Uniform Description",
      "required": false,
      "showWhen": { "field": "baby_profession", "value": "custom" }
    },
    "custom_scene_detail": {
      "type": "text",
      "label": "Custom Scene Detail",
      "required": false,
      "showWhen": { "field": "baby_profession", "value": "custom" }
    },
    "custom_reporter_question": {
      "type": "text",
      "label": "Custom Reporter Question",
      "required": false,
      "showWhen": { "field": "baby_profession", "value": "custom" }
    },
    "custom_baby_response": {
      "type": "text",
      "label": "Custom Baby Response",
      "required": false,
      "showWhen": { "field": "baby_profession", "value": "custom" }
    },
    "uniform": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"},
    "scene_detail": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"},
    "reporter_question": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"},
    "baby_response": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"}
  }
} as any

// 测试用例
console.log('🧪 测试Baby Profession Interview模板参数联动功能\n')

// 测试1: 外卖员 + 英语
console.log('📋 测试1: 外卖员 + 英语')
const test1Params = {
  baby_profession: 'food_delivery',
  dialogue_language: 'en-US'
}

try {
  const prompt1 = PromptGenerator.generatePromptForLocal(babyProfessionTemplate, test1Params)
  console.log('✅ 生成成功')
  console.log('👤 记者问题:', prompt1.match(/\"text\": \"([^\"]*)\"/g)?.[0] || '未找到')
  console.log('👶 婴儿回答:', prompt1.match(/\"text\": \"([^\"]*)\"/g)?.[1] || '未找到')
  console.log('👕 制服描述:', prompt1.includes('tiny food delivery uniform') ? '✅ 正确' : '❌ 错误')
} catch (error) {
  console.error('❌ 测试1失败:', error)
}

console.log('\n' + '='.repeat(50) + '\n')

// 测试2: 程序员 + 中文
console.log('📋 测试2: 程序员 + 中文')
const test2Params = {
  baby_profession: 'programmer',
  dialogue_language: 'zh-CN'
}

try {
  const prompt2 = PromptGenerator.generatePromptForLocal(babyProfessionTemplate, test2Params)
  console.log('✅ 生成成功')
  console.log('👤 记者问题:', prompt2.match(/\"text\": \"([^\"]*)\"/g)?.[0] || '未找到')
  console.log('👶 婴儿回答:', prompt2.match(/\"text\": \"([^\"]*)\"/g)?.[1] || '未找到')
  console.log('👕 制服描述:', prompt2.includes('tiny hoodie with tech company logo') ? '✅ 正确' : '❌ 错误')
} catch (error) {
  console.error('❌ 测试2失败:', error)
}

console.log('\n' + '='.repeat(50) + '\n')

// 测试3: 自定义职业
console.log('📋 测试3: 自定义职业')
const test3Params = {
  baby_profession: 'custom',
  custom_uniform: 'tiny chef hat and apron',
  custom_scene_detail: 'standing behind a toy kitchen counter',
  custom_reporter_question: 'Working in a kitchen all night, how do you handle the heat?',
  custom_baby_response: 'I love cooking! Making yummy food makes everyone happy!',
  dialogue_language: 'en-US'
}

try {
  const prompt3 = PromptGenerator.generatePromptForLocal(babyProfessionTemplate, test3Params)
  console.log('✅ 生成成功')
  console.log('👤 记者问题:', prompt3.match(/\"text\": \"([^\"]*)\"/g)?.[0] || '未找到')
  console.log('👶 婴儿回答:', prompt3.match(/\"text\": \"([^\"]*)\"/g)?.[1] || '未找到')
  console.log('👕 制服描述:', prompt3.includes('tiny chef hat and apron') ? '✅ 正确' : '❌ 错误')
} catch (error) {
  console.error('❌ 测试3失败:', error)
}

console.log('\n' + '='.repeat(50) + '\n')

// 测试4: 联动参数解析功能
console.log('📋 测试4: 联动参数解析')
const resolvedParams = PromptGenerator.resolveLinkedParameters(babyProfessionTemplate, {
  baby_profession: 'food_delivery',
  dialogue_language: 'zh-CN'
})

console.log('🔗 解析后的参数:')
console.log('- uniform:', resolvedParams.uniform)
console.log('- scene_detail:', resolvedParams.scene_detail)
console.log('- reporter_question:', resolvedParams.reporter_question)
console.log('- baby_response:', resolvedParams.baby_response)

console.log('\n🎉 测试完成!')