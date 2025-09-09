/**
 * Baby Profession Interview完整提示词输出测试
 * 查看生成的完整prompt内容
 */

import { PromptGenerator } from '../services/promptGenerator'

const babyProfessionTemplate = {
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
      "options": [
        {
          "value": "food_delivery",
          "metadata": {
            "uniform": "tiny food delivery uniform",
            "scene_detail": "sitting on a tricycle",
            "reporter_question_en": "Still delivering food this late, this job must be really tough, huh?",
            "baby_response_en": "Not tough at all! I love riding around the city, it's super cool!",
            "reporter_question_zh": "这么晚还在送外卖，这工作一定很辛苦吧？",
            "baby_response_zh": "一点都不辛苦！我喜欢在城市里骑车，超级酷的！"
          }
        }
      ]
    },
    "dialogue_language": { "type": "select" },
    "uniform": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"},
    "scene_detail": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"},
    "reporter_question": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"},
    "baby_response": {"type": "hidden", "linkedTo": "baby_profession", "linkType": "metadata"}
  }
} as any

console.log('🎬 Baby Profession Interview完整提示词输出测试\n')

// 测试英语版本
console.log('🇺🇸 英语版本:')
console.log('='.repeat(60))
const englishParams = {
  baby_profession: 'food_delivery',
  dialogue_language: 'en-US'
}

const englishPrompt = PromptGenerator.generatePromptForLocal(babyProfessionTemplate, englishParams)
console.log(englishPrompt)

console.log('\n' + '='.repeat(60) + '\n')

// 测试中文版本
console.log('🇨🇳 中文版本:')
console.log('='.repeat(60))
const chineseParams = {
  baby_profession: 'food_delivery',
  dialogue_language: 'zh-CN'
}

const chinesePrompt = PromptGenerator.generatePromptForLocal(babyProfessionTemplate, chineseParams)
console.log(chinesePrompt)

console.log('\n' + '='.repeat(60) + '\n')

// 测试解析后的参数
console.log('🔍 参数解析验证:')
console.log('='.repeat(60))

const resolvedEnglish = PromptGenerator.resolveLinkedParameters(babyProfessionTemplate, englishParams)
console.log('英语参数解析:')
console.log(JSON.stringify(resolvedEnglish, null, 2))

console.log('\n')

const resolvedChinese = PromptGenerator.resolveLinkedParameters(babyProfessionTemplate, chineseParams)
console.log('中文参数解析:')
console.log(JSON.stringify(resolvedChinese, null, 2))

console.log('\n🎉 测试完成!')