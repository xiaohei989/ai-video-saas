/**
 * 测试简化后的API点赞数显示
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

async function testSimplifiedApi() {
  console.log('🔍 测试简化后的API点赞数显示...')
  
  // 1. 测试直接查询templates表的like_count字段
  console.log('\n📊 直接查询templates表的like_count字段...')
  const { data: templates, error: templatesError } = await supabase
    .from('templates')
    .select(`
      id,
      slug,
      name,
      like_count
    `)
    .eq('is_active', true)
    .eq('is_public', true)
    .eq('audit_status', 'approved')
    .order('like_count', { ascending: true })
    .limit(10)
  
  if (templatesError) {
    console.error('❌ 查询templates失败:', templatesError)
    return
  }
  
  console.log(`✅ 获取到 ${templates?.length || 0} 个模板`)
  console.log('模板点赞数（最少的10个）:')
  templates?.forEach(template => {
    const nameCn = template.name?.zh || template.name?.en || template.slug
    console.log(`  ${nameCn}: ${template.like_count}个点赞`)
  })
  
  // 2. 测试完整的API查询（模拟getTemplateList方法）
  console.log('\n📊 测试完整的API查询（第一页）...')
  const { data: apiTemplates, error: apiError } = await supabase
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
      like_count,
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
  
  if (apiError) {
    console.error('❌ API查询失败:', apiError)
    return
  }
  
  console.log(`✅ API查询获取到 ${apiTemplates?.length || 0} 个模板`)
  console.log('API查询结果（第一页）:')
  apiTemplates?.forEach(template => {
    const nameCn = template.name?.zh || template.name?.en || template.slug
    console.log(`  ${nameCn}: ${template.like_count}个点赞`)
  })
  
  // 3. 验证点赞数范围
  console.log('\n📊 验证点赞数范围...')
  const likeCounts = apiTemplates?.map(t => t.like_count) || []
  const minLikes = Math.min(...likeCounts)
  const maxLikes = Math.max(...likeCounts)
  const avgLikes = Math.round(likeCounts.reduce((sum, count) => sum + count, 0) / likeCounts.length)
  const zeroLikes = likeCounts.filter(count => count === 0).length
  
  console.log(`📈 点赞数统计:`)
  console.log(`  最少点赞: ${minLikes}`)
  console.log(`  最多点赞: ${maxLikes}`)
  console.log(`  平均点赞: ${avgLikes}`)
  console.log(`  0点赞的模板: ${zeroLikes}个`)
  
  if (minLikes >= 50) {
    console.log('✅ 所有模板点赞数都>=50')
  } else {
    console.log('❌ 存在点赞数<50的模板')
  }
  
  if (zeroLikes === 0) {
    console.log('✅ 没有0点赞的模板')
  } else {
    console.log('❌ 存在0点赞的模板')
  }
  
  // 4. 测试popular排序
  console.log('\n📊 测试按点赞数排序...')
  const { data: popularTemplates, error: popularError } = await supabase
    .from('templates')
    .select('slug, name, like_count')
    .eq('is_active', true)
    .eq('is_public', true)
    .eq('audit_status', 'approved')
    .order('like_count', { ascending: false })
    .limit(5)
  
  if (popularError) {
    console.error('❌ 热门排序查询失败:', popularError)
  } else {
    console.log('🔥 最热门的5个模板:')
    popularTemplates?.forEach((template, index) => {
      const nameCn = template.name?.zh || template.name?.en || template.slug
      console.log(`  ${index + 1}. ${nameCn}: ${template.like_count}个点赞`)
    })
  }
  
  console.log('\n🔍 简化API测试完成!')
}

testSimplifiedApi().catch(console.error)