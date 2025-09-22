/**
 * 深度调试API查询与数据库不一致的问题
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

async function debugApiInconsistency() {
  console.log('🔍 深度调试API数据不一致问题...')

  // 1. 测试template_likes表的基本访问权限
  console.log('\n📊 Step 1: 测试template_likes表访问权限')
try {
  const { data: testLikes, error: testError } = await supabase
    .from('template_likes')
    .select('*')
    .limit(1)
  
  if (testError) {
    console.error('❌ 无法访问template_likes表:', testError)
  } else {
    console.log('✅ 可以访问template_likes表，示例数据:', testLikes?.[0])
  }
} catch (err) {
  console.error('❌ template_likes表访问异常:', err)
}

// 2. 检查template_likes表的总记录数
console.log('\n📊 Step 2: 检查template_likes表总记录数')
try {
  const { count, error } = await supabase
    .from('template_likes')
    .select('*', { count: 'exact', head: true })
  
  if (error) {
    console.error('❌ 无法获取template_likes总数:', error)
  } else {
    console.log(`✅ template_likes表总记录数: ${count}`)
  }
} catch (err) {
  console.error('❌ 获取总数异常:', err)
}

// 3. 检查templates表的权限和数据
console.log('\n📊 Step 3: 检查templates表')
const { data: templates, error: templatesError } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('is_active', true)
  .eq('is_public', true)
  .eq('audit_status', 'approved')
  .limit(5)

if (templatesError) {
  console.error('❌ 获取templates失败:', templatesError)
} else {
  console.log(`✅ 获取到 ${templates?.length || 0} 个模板`)
  console.log('模板ID示例:')
  templates?.forEach(t => {
    console.log(`  ${t.slug}: ${t.id} (类型: ${typeof t.id})`)
  })
}

// 4. 直接查询特定模板的点赞数
console.log('\n📊 Step 4: 直接查询特定模板的点赞数')
if (templates && templates.length > 0) {
  const firstTemplate = templates[0]
  console.log(`查询模板: ${firstTemplate.slug} (${firstTemplate.id})`)
  
  try {
    const { data: directLikes, error: directError } = await supabase
      .from('template_likes')
      .select('*')
      .eq('template_id', firstTemplate.id)
    
    if (directError) {
      console.error('❌ 直接查询点赞失败:', directError)
    } else {
      console.log(`✅ 直接查询结果: ${directLikes?.length || 0} 个点赞`)
      if (directLikes && directLikes.length > 0) {
        console.log('点赞数据示例:', directLikes[0])
      }
    }
  } catch (err) {
    console.error('❌ 直接查询异常:', err)
  }
}

// 5. 测试IN查询
console.log('\n📊 Step 5: 测试IN查询方式')
if (templates && templates.length > 0) {
  const templateIds = templates.map(t => t.id)
  console.log('查询的模板ID数组:', templateIds)
  console.log('ID数组长度:', templateIds.length)
  console.log('第一个ID类型:', typeof templateIds[0])
  
  try {
    const { data: inQueryLikes, error: inQueryError } = await supabase
      .from('template_likes')
      .select('template_id')
      .in('template_id', templateIds)
    
    if (inQueryError) {
      console.error('❌ IN查询失败:', inQueryError)
    } else {
      console.log(`✅ IN查询结果: ${inQueryLikes?.length || 0} 条记录`)
      
      // 统计每个模板的点赞数
      const likeCountMap = new Map()
      inQueryLikes?.forEach(like => {
        const currentCount = likeCountMap.get(like.template_id) || 0
        likeCountMap.set(like.template_id, currentCount + 1)
      })
      
      console.log('IN查询统计结果:')
      templates.forEach(template => {
        const count = likeCountMap.get(template.id) || 0
        console.log(`  ${template.slug}: ${count}个点赞`)
      })
    }
  } catch (err) {
    console.error('❌ IN查询异常:', err)
  }
}

// 6. 检查数据类型匹配
console.log('\n📊 Step 6: 检查数据类型和格式')
try {
  const { data: likesSample } = await supabase
    .from('template_likes')
    .select('template_id')
    .limit(3)
  
  console.log('template_likes中的template_id样本:')
  likesSample?.forEach((like, index) => {
    console.log(`  ${index + 1}. ${like.template_id} (类型: ${typeof like.template_id})`)
  })
  
  if (templates && likesSample) {
    console.log('\n类型匹配检查:')
    const templateIdType = typeof templates[0].id
    const likeTemplateIdType = typeof likesSample[0].template_id
    console.log(`templates.id类型: ${templateIdType}`)
    console.log(`template_likes.template_id类型: ${likeTemplateIdType}`)
    console.log(`类型匹配: ${templateIdType === likeTemplateIdType ? '✅' : '❌'}`)
    
    // 检查值是否匹配
    const templateIds = new Set(templates.map(t => t.id))
    const likeTemplateIds = new Set(likesSample.map(l => l.template_id))
    
    console.log('\nID值匹配检查:')
    console.log('templates中的ID:', Array.from(templateIds))
    console.log('template_likes中的template_id:', Array.from(likeTemplateIds))
    
    const intersection = new Set([...templateIds].filter(x => likeTemplateIds.has(x)))
    console.log(`匹配的ID数量: ${intersection.size}`)
  }
} catch (err) {
  console.error('❌ 数据类型检查异常:', err)
}

// 7. 模拟完整的API服务流程
console.log('\n📊 Step 7: 模拟完整API服务流程')
try {
  // 获取所有模板
  const { data: allTemplates, error: allTemplatesError } = await supabase
    .from('templates')
    .select('id, slug, name')
    .eq('audit_status', 'approved')
    .eq('is_active', true)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(0, 11)
  
  if (allTemplatesError) {
    console.error('❌ 获取所有模板失败:', allTemplatesError)
    return
  }
  
  console.log(`获取到 ${allTemplates?.length || 0} 个模板`)
  
  // 获取点赞数据
  const templateIds = allTemplates?.map(t => t.id) || []
  const { data: likeCounts, error: likesError } = await supabase
    .from('template_likes')
    .select('template_id')
    .in('template_id', templateIds)
  
  if (likesError) {
    console.error('❌ 获取点赞数据失败:', likesError)
    return
  }
  
  console.log(`获取到 ${likeCounts?.length || 0} 条点赞记录`)
  
  // 统计结果
  const likeCountMap = new Map()
  likeCounts?.forEach(like => {
    const currentCount = likeCountMap.get(like.template_id) || 0
    likeCountMap.set(like.template_id, currentCount + 1)
  })
  
  console.log('\n完整API流程结果:')
  let hasLikes = 0
  let noLikes = 0
  
  allTemplates?.forEach(template => {
    const likeCount = likeCountMap.get(template.id) || 0
    const name = template.name?.zh || template.name?.en || template.slug
    
    if (likeCount > 0) {
      console.log(`✅ ${name}: ${likeCount}个点赞`)
      hasLikes++
    } else {
      console.log(`❌ ${name}: ${likeCount}个点赞`)
      noLikes++
    }
  })
  
  console.log(`\n📈 最终统计: ${hasLikes}个有点赞, ${noLikes}个无点赞`)
  
} catch (err) {
  console.error('❌ 完整流程异常:', err)
}

console.log('\n🔍 调试完成!')