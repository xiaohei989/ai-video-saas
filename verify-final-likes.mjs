/**
 * 验证最终的点赞数据显示
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 验证API返回的最终点赞数据...')

// 模拟templatesApiService.getTemplateList()的完整逻辑
async function simulateTemplatesApiService() {
  console.log('\n📊 Step 1: 获取模板基础数据')
  
  // 获取模板基础数据
  const { data: templates, error: templatesError } = await supabase
    .from('templates')
    .select(`
      id,
      slug,
      name,
      description,
      thumbnail_url,
      preview_url,
      category,
      credit_cost,
      tags,
      is_active,
      is_public,
      version,
      created_at,
      updated_at,
      audit_status
    `)
    .eq('audit_status', 'approved')
    .eq('is_active', true)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(0, 11) // 第一页12个

  if (templatesError) {
    console.error('获取模板失败:', templatesError)
    return
  }

  console.log(`获得 ${templates?.length || 0} 个模板`)

  console.log('\n📊 Step 2: 获取点赞数据')
  
  // 获取所有点赞数据
  const templateIds = templates?.map(t => t.id) || []
  console.log('查询的模板ID:', templateIds.slice(0, 3), '...')
  
  const { data: likeCounts, error: likesError } = await supabase
    .from('template_likes')
    .select('template_id')
    .in('template_id', templateIds)

  if (likesError) {
    console.error('获取点赞数据失败:', likesError)
    return
  }

  console.log(`获得 ${likeCounts?.length || 0} 条点赞记录`)

  console.log('\n📊 Step 3: 统计点赞数')
  
  // 统计每个模板的点赞数
  const likeCountMap = new Map()
  likeCounts?.forEach(like => {
    const currentCount = likeCountMap.get(like.template_id) || 0
    likeCountMap.set(like.template_id, currentCount + 1)
  })

  console.log('点赞统计Map大小:', likeCountMap.size)

  console.log('\n📊 Step 4: 为模板添加点赞数')
  
  // 为每个模板添加点赞数
  const templatesWithLikeCounts = templates?.map(template => ({
    ...template,
    like_count: likeCountMap.get(template.id) || 0
  })) || []

  console.log('\n📋 最终API返回的模板数据 (前5个):')
  for (const template of templatesWithLikeCounts.slice(0, 5)) {
    console.log(`  ${template.slug}: ${template.like_count}个点赞`)
  }

  return templatesWithLikeCounts
}

// 执行模拟
const result = await simulateTemplatesApiService()

console.log('\n📊 总结:')
console.log(`  模板总数: ${result?.length || 0}`)
console.log(`  有点赞的模板: ${result?.filter(t => t.like_count > 0).length || 0}`)
console.log(`  0点赞的模板: ${result?.filter(t => t.like_count === 0).length || 0}`)

if (result && result.length > 0) {
  const totalLikes = result.reduce((sum, t) => sum + t.like_count, 0)
  console.log(`  总点赞数: ${totalLikes}`)
  console.log(`  平均点赞数: ${Math.round(totalLikes / result.length)}`)
}

// 检查数据库中的实际点赞总数
console.log('\n🔍 验证数据库状态:')
const { data: allLikes } = await supabase
  .from('template_likes')
  .select('template_id')

console.log(`数据库中总点赞记录数: ${allLikes?.length || 0}`)

// 检查点赞记录覆盖的模板数
const uniqueTemplateIds = new Set(allLikes?.map(l => l.template_id) || [])
console.log(`点赞记录覆盖的模板数: ${uniqueTemplateIds.size}`)

console.log('\n✅ API数据流验证完成!')