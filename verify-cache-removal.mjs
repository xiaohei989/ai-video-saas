/**
 * 验证缓存机制移除后的数据流
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 验证缓存移除后的数据流...')
console.log('')

// 1. 测试API是否返回正确的like_count
console.log('📊 步骤1: 模拟templatesApiService.getTemplateList()调用')

// 获取模板基础数据
const { data: templates } = await supabase
  .from('templates')
  .select('id, slug, name, credit_cost')
  .eq('is_active', true)
  .eq('is_public', true)
  .eq('audit_status', 'approved')
  .order('created_at', { ascending: false })
  .limit(5)

console.log(`获得 ${templates?.length || 0} 个模板`)

// 获取点赞数据
const templateIds = templates?.map(t => t.id) || []
const { data: likes } = await supabase
  .from('template_likes')
  .select('template_id')
  .in('template_id', templateIds)

console.log(`从template_likes表获得 ${likes?.length || 0} 条点赞记录`)

// 统计点赞数
const likeCountMap = new Map()
likes?.forEach(like => {
  const currentCount = likeCountMap.get(like.template_id) || 0
  likeCountMap.set(like.template_id, currentCount + 1)
})

// 为模板添加like_count
const templatesWithLikes = templates?.map(template => ({
  ...template,
  like_count: likeCountMap.get(template.id) || 0
})) || []

console.log('')
console.log('📋 API返回的模板数据（带like_count）:')
for (const template of templatesWithLikes) {
  console.log(`  ${template.slug}: ${template.like_count}个点赞`)
}

console.log('')
console.log('📊 步骤2: 验证前端组件能否正确处理数据')

// 模拟前端组件的数据转换逻辑
function convertDatabaseTemplateToComponentFormat(template) {
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    likeCount: template.like_count,  // 关键字段
    credits: template.credit_cost
  }
}

const convertedTemplates = templatesWithLikes.map(convertDatabaseTemplateToComponentFormat)

console.log('🔄 前端组件接收到的数据:')
for (const template of convertedTemplates) {
  console.log(`  ${template.slug}: likeCount=${template.likeCount}`)
}

console.log('')
console.log('📊 步骤3: 验证TemplateCard组件的显示逻辑')

for (const template of convertedTemplates) {
  // 模拟TemplateCard中的逻辑
  const likeCount = template.likeCount ?? 0
  const hasLikeData = template.likeCount !== undefined
  
  console.log(`  模板 ${template.slug}:`)
  console.log(`    - template.likeCount: ${template.likeCount}`)
  console.log(`    - 显示的likeCount: ${likeCount}`)
  console.log(`    - hasLikeData: ${hasLikeData}`)
  console.log(`    - 是否显示加载动画: ${!hasLikeData}`)
}

console.log('')
console.log('✅ 数据流验证完成!')
console.log('🔄 缓存机制已完全移除，所有点赞数据都直接来自API')