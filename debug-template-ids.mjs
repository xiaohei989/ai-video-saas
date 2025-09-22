/**
 * 调试模板ID匹配问题
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 调试模板ID匹配问题...')

// 1. 查看templates表中的ID格式
console.log('\n📊 Step 1: 检查templates表中的模板ID格式')
const { data: templatesFromDb } = await supabase
  .from('templates')
  .select('id, slug')
  .eq('is_active', true)
  .eq('is_public', true)
  .eq('audit_status', 'approved')
  .limit(5)

console.log('Templates表中的ID格式:')
for (const template of templatesFromDb || []) {
  console.log(`  ${template.slug}: ${template.id}`)
}

// 2. 查看template_likes表中的template_id格式
console.log('\n📊 Step 2: 检查template_likes表中的模板ID格式')
const { data: likesFromDb } = await supabase
  .from('template_likes')
  .select('template_id')
  .limit(5)

console.log('Template_likes表中的ID格式:')
for (const like of likesFromDb || []) {
  console.log(`  ${like.template_id}`)
}

// 3. 检查ID是否匹配
console.log('\n📊 Step 3: 检查ID匹配情况')
const templateIds = templatesFromDb?.map(t => t.id) || []
const { data: matchingLikes } = await supabase
  .from('template_likes')
  .select('template_id')
  .in('template_id', templateIds)

console.log(`Templates表有 ${templateIds.length} 个ID`)
console.log(`匹配的点赞记录有 ${matchingLikes?.length || 0} 条`)

// 4. 检查特定模板的点赞数
console.log('\n📊 Step 4: 检查特定模板的点赞数')
if (templatesFromDb && templatesFromDb.length > 0) {
  const firstTemplate = templatesFromDb[0]
  const { data: specificLikes } = await supabase
    .from('template_likes')
    .select('template_id')
    .eq('template_id', firstTemplate.id)
  
  console.log(`模板 ${firstTemplate.slug} (${firstTemplate.id}) 的点赞数: ${specificLikes?.length || 0}`)
}

// 5. 查看是否有孤立的点赞记录
console.log('\n📊 Step 5: 查看点赞记录的分布')
const { data: likeStats } = await supabase
  .from('template_likes')
  .select('template_id')

const likeCountMap = new Map()
likeStats?.forEach(like => {
  const currentCount = likeCountMap.get(like.template_id) || 0
  likeCountMap.set(like.template_id, currentCount + 1)
})

console.log(`点赞记录覆盖了 ${likeCountMap.size} 个不同的模板ID`)
console.log('点赞数最多的几个模板ID:')
const sortedLikes = Array.from(likeCountMap.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)

for (const [templateId, count] of sortedLikes) {
  console.log(`  ${templateId}: ${count}个点赞`)
}