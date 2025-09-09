/**
 * 检查灯光参数集成
 */

import fs from 'fs'
import path from 'path'
import { PromptGenerator } from '../services/promptGenerator'

const templatePath = path.join(process.cwd(), 'src/features/video-creator/data/templates/baby-profession-interview.json')
const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'))

console.log('🔍 检查灯光参数集成\n')

const testParams = {
  baby_profession: 'programmer',
  reporter_question: 'Test',
  baby_response: 'Test'
}

console.log('原始模板lighting字段:', template.promptTemplate.visual_core.lighting)

const resolvedParams = PromptGenerator.resolveLinkedParameters(template, testParams)
console.log('\n解析后的lighting_style:', resolvedParams.lighting_style)

// 检查JSON处理过程
const jsonPrompt = PromptGenerator.generateJsonPrompt(template, testParams)
console.log('\n生成的JSON提示词:')
console.log(JSON.stringify(jsonPrompt, null, 2))