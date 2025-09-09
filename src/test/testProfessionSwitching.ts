/**
 * 测试职业切换时的对话自动填充功能
 */

import fs from 'fs'
import path from 'path'
import { PromptGenerator } from '../services/promptGenerator'

const templatePath = path.join(process.cwd(), 'src/features/video-creator/data/templates/baby-profession-interview.json')
const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'))

console.log('🔄 测试职业切换时的对话自动填充功能\n')

// 模拟职业切换场景
const professions = ['food_delivery', 'programmer', 'stock_trader', 'doctor']

professions.forEach((profession, index) => {
  console.log(`📋 切换到职业 ${index + 1}: ${profession}`)
  console.log('='.repeat(50))
  
  const defaultDialogue = PromptGenerator.getDefaultDialogueForProfession(template, profession)
  
  console.log('🎭 自动填充的对话:')
  console.log('  记者问题:', defaultDialogue.reporter_question)
  console.log('  婴儿回答:', defaultDialogue.baby_response)
  
  // 获取职业的其他特征
  const professionParam = template.params.baby_profession
  const selectedOption = professionParam.options.find((opt: any) => opt.value === profession)
  if (selectedOption) {
    console.log('👔 制服描述:', selectedOption.metadata.uniform)
    console.log('📍 场景描述:', selectedOption.metadata.scene_detail)
  }
  
  console.log()
})

// 模拟前端组件的逻辑
console.log('🎨 模拟前端组件职业切换逻辑:')
console.log('='.repeat(50))

// 模拟当前参数状态
let currentParams = {
  baby_profession: 'food_delivery',
  reporter_question: 'Still delivering food this late, this job must be really tough, huh?',
  baby_response: "Not tough at all! I love riding around the city, it's super cool!"
}

console.log('初始状态 (外卖员):')
console.log('  职业:', currentParams.baby_profession)
console.log('  记者问题:', currentParams.reporter_question)
console.log('  婴儿回答:', currentParams.baby_response)

// 模拟用户切换到程序员
console.log('\n用户切换到程序员...')
currentParams.baby_profession = 'programmer'

// 触发自动填充逻辑
if (template.slug === 'baby-profession-interview' && currentParams.baby_profession) {
  const defaultDialogue = PromptGenerator.getDefaultDialogueForProfession(template, currentParams.baby_profession)
  
  if (defaultDialogue.reporter_question && defaultDialogue.baby_response) {
    currentParams.reporter_question = defaultDialogue.reporter_question
    currentParams.baby_response = defaultDialogue.baby_response
    
    console.log('✅ 对话已自动更新!')
  }
}

console.log('\n更新后状态 (程序员):')
console.log('  职业:', currentParams.baby_profession)
console.log('  记者问题:', currentParams.reporter_question)  
console.log('  婴儿回答:', currentParams.baby_response)

console.log('\n🎉 职业切换对话自动填充功能验证完成!')