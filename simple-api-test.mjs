/**
 * 简单的API访问测试
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

async function testApi() {
  console.log('🔍 简单API测试...')
  
  // 1. 测试template_likes表访问
  console.log('\n📊 测试template_likes表访问...')
  const { data: likes, error: likesError, count } = await supabase
    .from('template_likes')
    .select('*', { count: 'exact', head: true })
  
  if (likesError) {
    console.error('❌ template_likes访问失败:', likesError)
  } else {
    console.log(`✅ template_likes表可访问，总记录数: ${count}`)
  }
  
  // 2. 获取几条实际数据
  console.log('\n📊 获取template_likes实际数据...')
  const { data: likesData, error: likesDataError } = await supabase
    .from('template_likes')
    .select('template_id, user_id')
    .limit(3)
  
  if (likesDataError) {
    console.error('❌ 获取likes数据失败:', likesDataError)
  } else {
    console.log(`✅ 获取到 ${likesData?.length || 0} 条likes数据`)
    likesData?.forEach((like, i) => {
      console.log(`  ${i + 1}. template_id: ${like.template_id}`)
    })
  }
  
  // 3. 获取模板数据
  console.log('\n📊 获取模板数据...')
  const { data: templates, error: templatesError } = await supabase
    .from('templates')
    .select('id, slug')
    .eq('is_active', true)
    .eq('is_public', true)
    .eq('audit_status', 'approved')
    .limit(3)
  
  if (templatesError) {
    console.error('❌ 获取templates失败:', templatesError)
  } else {
    console.log(`✅ 获取到 ${templates?.length || 0} 个模板`)
    templates?.forEach((template, i) => {
      console.log(`  ${i + 1}. ${template.slug}: ${template.id}`)
    })
  }
  
  // 4. 测试JOIN查询
  if (templates && templates.length > 0) {
    console.log('\n📊 测试特定模板的点赞查询...')
    const testTemplate = templates[0]
    console.log(`测试模板: ${testTemplate.slug} (${testTemplate.id})`)
    
    const { data: templateLikes, error: templateLikesError } = await supabase
      .from('template_likes')
      .select('template_id')
      .eq('template_id', testTemplate.id)
    
    if (templateLikesError) {
      console.error('❌ 查询特定模板点赞失败:', templateLikesError)
    } else {
      console.log(`✅ 模板 ${testTemplate.slug} 的点赞数: ${templateLikes?.length || 0}`)
    }
  }
  
  // 5. 测试IN查询
  if (templates && templates.length > 0) {
    console.log('\n📊 测试IN查询...')
    const templateIds = templates.map(t => t.id)
    console.log(`查询ID数组: [${templateIds.join(', ')}]`)
    
    const { data: inQueryResult, error: inQueryError } = await supabase
      .from('template_likes')
      .select('template_id')
      .in('template_id', templateIds)
    
    if (inQueryError) {
      console.error('❌ IN查询失败:', inQueryError)
    } else {
      console.log(`✅ IN查询结果: ${inQueryResult?.length || 0} 条记录`)
      
      // 统计每个模板的点赞数
      const countMap = new Map()
      inQueryResult?.forEach(item => {
        const count = countMap.get(item.template_id) || 0
        countMap.set(item.template_id, count + 1)
      })
      
      console.log('各模板点赞统计:')
      templates.forEach(template => {
        const count = countMap.get(template.id) || 0
        console.log(`  ${template.slug}: ${count}个点赞`)
      })
    }
  }
  
  console.log('\n🔍 测试完成!')
}

testApi().catch(console.error)