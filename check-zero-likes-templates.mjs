/**
 * 检查点赞数为0的模板
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 检查当前点赞数为0的模板...')

// 获取所有模板
const { data: templates } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('is_active', true)
  .eq('is_public', true)
  .eq('audit_status', 'approved')
  .order('created_at', { ascending: false })

console.log(`📊 总共找到 ${templates?.length || 0} 个模板`)

// 获取所有点赞数据
const templateIds = templates?.map(t => t.id) || []
const { data: likes } = await supabase
  .from('template_likes')
  .select('template_id')
  .in('template_id', templateIds)

// 统计每个模板的点赞数
const likeCountMap = new Map()
likes?.forEach(like => {
  const currentCount = likeCountMap.get(like.template_id) || 0
  likeCountMap.set(like.template_id, currentCount + 1)
})

// 找出点赞数为0的模板
const zeroLikesTemplates = []
const nonZeroLikesTemplates = []

for (const template of templates || []) {
  const likeCount = likeCountMap.get(template.id) || 0
  if (likeCount === 0) {
    zeroLikesTemplates.push(template)
  } else {
    nonZeroLikesTemplates.push({ ...template, likeCount })
  }
}

console.log('')
console.log(`💔 点赞数为0的模板 (${zeroLikesTemplates.length}个):`)
for (const template of zeroLikesTemplates) {
  console.log(`  - ${template.slug} (ID: ${template.id})`)
}

console.log('')
console.log(`💝 已有点赞的模板 (${nonZeroLikesTemplates.length}个):`)
for (const template of nonZeroLikesTemplates) {
  console.log(`  - ${template.slug}: ${template.likeCount}个点赞`)
}

console.log('')
console.log(`📋 统计摘要:`)
console.log(`  总模板数: ${templates?.length || 0}`)
console.log(`  需要添加点赞的模板: ${zeroLikesTemplates.length}`)
console.log(`  已有点赞的模板: ${nonZeroLikesTemplates.length}`)