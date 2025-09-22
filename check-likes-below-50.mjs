/**
 * 检查点赞数小于50的模板
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 检查点赞数小于50的模板...')

// 1. 获取所有模板
const { data: templates } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('is_active', true)
  .eq('is_public', true)
  .eq('audit_status', 'approved')
  .order('slug')

console.log(`📊 总模板数: ${templates?.length || 0}`)

// 2. 获取所有点赞数据
const { data: allLikes } = await supabase
  .from('template_likes')
  .select('template_id')

// 3. 统计每个模板的点赞数
const likeCountMap = new Map()
allLikes?.forEach(like => {
  const currentCount = likeCountMap.get(like.template_id) || 0
  likeCountMap.set(like.template_id, currentCount + 1)
})

console.log('\n📋 所有模板点赞数统计:')
const templatesNeedingFix = []

for (const template of templates || []) {
  const likeCount = likeCountMap.get(template.id) || 0
  const nameCn = template.name?.zh || template.name?.en || template.slug
  
  if (likeCount < 50) {
    templatesNeedingFix.push({
      id: template.id,
      slug: template.slug,
      name: nameCn,
      currentLikes: likeCount,
      needsAdditional: 50 - likeCount
    })
    console.log(`❌ ${nameCn}: ${likeCount}个点赞 (需要补充${50 - likeCount}个)`)
  } else {
    console.log(`✅ ${nameCn}: ${likeCount}个点赞`)
  }
}

console.log(`\n📈 统计结果:`)
console.log(`  需要修复的模板: ${templatesNeedingFix.length}个`)
console.log(`  已达标的模板: ${(templates?.length || 0) - templatesNeedingFix.length}个`)

if (templatesNeedingFix.length > 0) {
  console.log('\n🔧 需要修复的模板详情:')
  for (const template of templatesNeedingFix) {
    console.log(`  ${template.slug}: 当前${template.currentLikes}个，需要补充${template.needsAdditional}个`)
  }
  
  const totalNeeded = templatesNeedingFix.reduce((sum, t) => sum + t.needsAdditional, 0)
  console.log(`\n📊 总计需要补充: ${totalNeeded}个点赞记录`)
} else {
  console.log('\n🎉 所有模板点赞数都已达到50以上！')
}