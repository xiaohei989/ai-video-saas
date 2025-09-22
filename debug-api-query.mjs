/**
 * 调试API查询过程
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 调试API查询的详细过程...')

// Step 1: 获取模板
console.log('\n📊 Step 1: 获取模板数据 (模拟第一页)')
const { data: templates, error: templatesError } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('audit_status', 'approved')
  .eq('is_active', true)
  .eq('is_public', true)
  .order('created_at', { ascending: false })
  .range(0, 11) // 第一页12个

if (templatesError) {
  console.error('获取模板失败:', templatesError)
  process.exit(1)
}

console.log(`✅ 获得 ${templates?.length || 0} 个模板`)
console.log('模板列表:')
for (const template of templates || []) {
  console.log(`  ${template.slug} (${template.id})`)
}

// Step 2: 查询这些模板的点赞数
console.log('\n📊 Step 2: 查询这些模板的点赞数')
const templateIds = templates?.map(t => t.id) || []
console.log(`模板ID数组长度: ${templateIds.length}`)
console.log('查询的模板ID:', templateIds)

const { data: likeCounts, error: likesError } = await supabase
  .from('template_likes')
  .select('template_id')
  .in('template_id', templateIds)

if (likesError) {
  console.error('获取点赞数据失败:', likesError)
  process.exit(1)
}

console.log(`✅ 获得 ${likeCounts?.length || 0} 条点赞记录`)

// Step 3: 统计每个模板的点赞数
console.log('\n📊 Step 3: 统计每个模板的点赞数')
const likeCountMap = new Map()
likeCounts?.forEach(like => {
  const currentCount = likeCountMap.get(like.template_id) || 0
  likeCountMap.set(like.template_id, currentCount + 1)
})

console.log('点赞统计结果:')
for (const template of templates || []) {
  const likeCount = likeCountMap.get(template.id) || 0
  console.log(`  ${template.slug}: ${likeCount}个点赞`)
}

// Step 4: 检查在数据库中但不在第一页的模板
console.log('\n📊 Step 4: 检查其他页面的模板')
const { data: allTemplates } = await supabase
  .from('templates')
  .select('id, slug')
  .eq('audit_status', 'approved')
  .eq('is_active', true)
  .eq('is_public', true)
  .order('created_at', { ascending: false })

console.log(`数据库中总模板数: ${allTemplates?.length || 0}`)
const firstPageIds = new Set(templateIds)
const otherPageTemplates = allTemplates?.filter(t => !firstPageIds.has(t.id)) || []

console.log(`其他页面的模板数: ${otherPageTemplates.length}`)

if (otherPageTemplates.length > 0) {
  console.log('其他页面的前5个模板:')
  for (const template of otherPageTemplates.slice(0, 5)) {
    // 查询这个模板的点赞数
    const { data: likes } = await supabase
      .from('template_likes')
      .select('template_id')
      .eq('template_id', template.id)
    
    console.log(`  ${template.slug}: ${likes?.length || 0}个点赞`)
  }
}

console.log('\n✅ 调试完成!')