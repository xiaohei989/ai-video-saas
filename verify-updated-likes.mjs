/**
 * 验证更新后的点赞数据
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 验证更新后的点赞数据...')

// 获取所有模板
const { data: templates } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('is_active', true)
  .eq('is_public', true)
  .eq('audit_status', 'approved')
  .order('created_at', { ascending: false })

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

// 整理模板数据
const templatesWithLikes = []
let zeroLikesCount = 0
let totalLikes = 0

for (const template of templates || []) {
  const likeCount = likeCountMap.get(template.id) || 0
  templatesWithLikes.push({
    slug: template.slug,
    likeCount: likeCount
  })
  
  if (likeCount === 0) {
    zeroLikesCount++
  }
  totalLikes += likeCount
}

// 按点赞数排序
templatesWithLikes.sort((a, b) => b.likeCount - a.likeCount)

console.log('')
console.log('📊 更新后的模板点赞统计:')
for (const template of templatesWithLikes) {
  console.log(`  ${template.slug}: ${template.likeCount}个点赞`)
}

console.log('')
console.log('📋 统计摘要:')
console.log(`  总模板数: ${templates?.length || 0}`)
console.log(`  总点赞数: ${totalLikes}`)
console.log(`  仍为0点赞的模板: ${zeroLikesCount}`)
console.log(`  平均每个模板点赞数: ${Math.round(totalLikes / (templates?.length || 1))}`)

// 找出点赞数范围
const likeCounts = templatesWithLikes.map(t => t.likeCount)
const minLikes = Math.min(...likeCounts)
const maxLikes = Math.max(...likeCounts)

console.log(`  点赞数范围: ${minLikes} - ${maxLikes}`)

if (zeroLikesCount === 0) {
  console.log('')
  console.log('✅ 所有模板都已有点赞数据！')
} else {
  console.log('')
  console.log(`❌ 还有 ${zeroLikesCount} 个模板点赞数为0`)
}