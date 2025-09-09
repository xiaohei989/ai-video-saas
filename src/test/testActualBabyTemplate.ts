/**
 * 测试实际的Baby Profession Interview模板文件
 */

import fs from 'fs'
import path from 'path'
import { PromptGenerator } from '../services/promptGenerator'

// 读取实际的模板文件
const templatePath = path.join(process.cwd(), 'src/features/video-creator/data/templates/baby-profession-interview.json')
const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'))

console.log('🎬 测试实际Baby Profession Interview模板文件\n')

// 测试1: 程序员 + 自定义对话
console.log('📋 测试1: 程序员职业 + 自定义对话')
console.log('='.repeat(60))
const test1Params = {
  baby_profession: 'programmer',
  reporter_question: 'Working from home must get lonely, right?',
  baby_response: 'Lonely? I have my code, my coffee, and my rubber duck - best team ever!'
}

console.log('📥 参数:')
console.log(JSON.stringify(test1Params, null, 2))

try {
  const prompt1 = PromptGenerator.generatePromptForLocal(template, test1Params)
  console.log('\n📤 生成的提示词:')
  console.log(prompt1)
  
  console.log('\n✅ 验证结果:')
  console.log('- 自定义对话正确嵌入:', prompt1.includes('rubber duck') ? '✅' : '❌')
  console.log('- 程序员制服描述:', prompt1.includes('hoodie with tech company logo') ? '✅' : '❌')
  console.log('- 办公椅场景:', prompt1.includes('wheeled office chair') ? '✅' : '❌')
} catch (error) {
  console.error('❌ 错误:', error)
}

console.log('\n' + '='.repeat(60) + '\n')

// 测试2: 获取默认对话
console.log('📋 测试2: 获取程序员职业默认对话')
const defaultDialogue = PromptGenerator.getDefaultDialogueForProfession(template, 'programmer')
console.log('📝 默认记者问题:', defaultDialogue.reporter_question)
console.log('👶 默认婴儿回答:', defaultDialogue.baby_response)

console.log('\n' + '='.repeat(60) + '\n')

// 测试3: 自定义职业
console.log('📋 测试3: 自定义职业')
const test3Params = {
  baby_profession: 'custom',
  custom_uniform: 'tiny chef outfit with miniature hat',
  custom_scene_detail: 'standing on a toy kitchen counter with tiny utensils',
  reporter_question: 'Kitchen work is tough, especially the night shift, right?',
  baby_response: 'I love cooking! Making people smile with yummy food is the best job ever!'
}

try {
  const prompt3 = PromptGenerator.generatePromptForLocal(template, test3Params)
  console.log('📤 自定义职业提示词:')
  console.log(prompt3)
  
  console.log('\n✅ 验证结果:')
  console.log('- 自定义制服:', prompt3.includes('tiny chef outfit') ? '✅' : '❌')
  console.log('- 自定义场景:', prompt3.includes('toy kitchen counter') ? '✅' : '❌')
  console.log('- 自定义对话:', prompt3.includes('yummy food') ? '✅' : '❌')
} catch (error) {
  console.error('❌ 错误:', error)
}

console.log('\n🎉 实际模板测试完成!')