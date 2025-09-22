/**
 * 对比数据库查询和API查询的结果
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

async function compareQueries() {
  console.log('🔍 对比数据库查询和API查询结果...')
  
  // 1. 获取所有模板（完整列表）
  console.log('\n📊 获取所有模板列表...')
  const { data: allTemplates, error: templatesError } = await supabase
    .from('templates')
    .select('id, slug, name')
    .eq('is_active', true)
    .eq('is_public', true)
    .eq('audit_status', 'approved')
    .order('slug')  // 按slug排序以便对比
  
  if (templatesError) {
    console.error('❌ 获取模板失败:', templatesError)
    return
  }
  
  console.log(`✅ 获取到 ${allTemplates?.length || 0} 个模板`)
  
  // 2. 为每个模板单独查询点赞数（模拟数据库查询）
  console.log('\n📊 单独查询每个模板的点赞数...')
  const individualResults = []
  
  for (const template of allTemplates || []) {
    const { data: likes, error } = await supabase
      .from('template_likes')
      .select('id')
      .eq('template_id', template.id)
    
    if (!error) {
      individualResults.push({
        slug: template.slug,
        id: template.id,
        likeCount: likes?.length || 0
      })
    }
  }
  
  console.log('单独查询结果:')
  individualResults.forEach(result => {
    console.log(`  ${result.slug}: ${result.likeCount}个点赞`)
  })
  
  // 3. 使用IN查询（模拟API服务的查询方式）
  console.log('\n📊 使用IN查询所有模板的点赞数...')
  const templateIds = allTemplates?.map(t => t.id) || []
  
  const { data: batchLikes, error: batchError } = await supabase
    .from('template_likes')
    .select('template_id')
    .in('template_id', templateIds)
  
  if (batchError) {
    console.error('❌ IN查询失败:', batchError)
    return
  }
  
  console.log(`✅ IN查询获得 ${batchLikes?.length || 0} 条记录`)
  
  // 统计IN查询结果
  const batchCountMap = new Map()
  batchLikes?.forEach(like => {
    const currentCount = batchCountMap.get(like.template_id) || 0
    batchCountMap.set(like.template_id, currentCount + 1)
  })
  
  const batchResults = allTemplates?.map(template => ({
    slug: template.slug,
    id: template.id,
    likeCount: batchCountMap.get(template.id) || 0
  })) || []
  
  console.log('IN查询结果:')
  batchResults.forEach(result => {
    console.log(`  ${result.slug}: ${result.likeCount}个点赞`)
  })
  
  // 4. 对比两种查询结果
  console.log('\n📊 对比两种查询结果...')
  let matchCount = 0
  let mismatchCount = 0
  
  individualResults.forEach(individual => {
    const batch = batchResults.find(b => b.id === individual.id)
    if (batch) {
      if (individual.likeCount === batch.likeCount) {
        matchCount++
      } else {
        mismatchCount++
        console.log(`❌ 不匹配: ${individual.slug}`)
        console.log(`    单独查询: ${individual.likeCount}`)
        console.log(`    IN查询: ${batch.likeCount}`)
      }
    }
  })
  
  console.log(`\n📈 对比结果:`)
  console.log(`  匹配: ${matchCount}个`)
  console.log(`  不匹配: ${mismatchCount}个`)
  
  // 5. 检查是否有特定的查询条件问题
  console.log('\n📊 检查特殊情况...')
  
  // 检查最大的ID数组大小限制
  console.log(`IN查询的ID数组大小: ${templateIds.length}`)
  console.log(`IN查询返回的记录数: ${batchLikes?.length || 0}`)
  
  // 检查0点赞的模板
  const zeroLikeTemplates = batchResults.filter(r => r.likeCount === 0)
  console.log(`IN查询中0点赞的模板数: ${zeroLikeTemplates.length}`)
  
  if (zeroLikeTemplates.length > 0) {
    console.log('0点赞的模板:')
    zeroLikeTemplates.forEach(template => {
      console.log(`  ${template.slug}`)
    })
  }
  
  console.log('\n🔍 对比完成!')
}

compareQueries().catch(console.error)