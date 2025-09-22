import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 检查数据库中的点赞数据...')

// 1. 检查template_likes表的总数据
const { data: allLikes, error: likesError } = await supabase
  .from('template_likes')
  .select('*')

if (likesError) {
  console.error('❌ 获取点赞数据失败:', likesError)
} else {
  console.log('📊 template_likes表总记录数:', allLikes?.length || 0)
  
  if (allLikes && allLikes.length > 0) {
    console.log('📋 点赞数据详情:')
    allLikes.forEach((like, index) => {
      console.log(`  ${index + 1}. 模板ID: ${like.template_id}, 用户ID: ${like.user_id?.substring(0, 8)}..., 创建时间: ${like.created_at}`)
    })
    
    // 统计每个模板的点赞数
    const likeCountMap = new Map()
    allLikes.forEach(like => {
      const count = likeCountMap.get(like.template_id) || 0
      likeCountMap.set(like.template_id, count + 1)
    })
    
    console.log('\n📈 各模板点赞统计:')
    for (const [templateId, count] of likeCountMap) {
      console.log(`  模板 ${templateId}: ${count} 个赞`)
    }
  }
}

// 2. 检查当前页面显示的模板ID
console.log('\n🔍 检查当前显示模板的点赞情况...')
const { data: templates, error: templatesError } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('audit_status', 'approved')
  .eq('is_active', true)
  .eq('is_public', true)
  .order('created_at', { ascending: false })
  .limit(12)

if (templatesError) {
  console.error('❌ 获取模板失败:', templatesError)
} else {
  console.log('📋 当前页面模板列表:')
  templates?.forEach((template, index) => {
    const name = typeof template.name === 'object' ? template.name?.zh || template.name?.en : template.name
    console.log(`  ${index + 1}. ${template.id} - ${name} (${template.slug})`)
  })
  
  // 检查这些模板是否有点赞
  if (allLikes && templates) {
    console.log('\n🎯 当前页面模板的点赞情况:')
    const templateIds = templates.map(t => t.id)
    const currentPageLikes = allLikes.filter(like => templateIds.includes(like.template_id))
    
    if (currentPageLikes.length > 0) {
      console.log(`📊 当前页面模板共有 ${currentPageLikes.length} 个点赞`)
      const currentLikeMap = new Map()
      currentPageLikes.forEach(like => {
        const count = currentLikeMap.get(like.template_id) || 0
        currentLikeMap.set(like.template_id, count + 1)
      })
      
      templates.forEach(template => {
        const likeCount = currentLikeMap.get(template.id) || 0
        const name = typeof template.name === 'object' ? template.name?.zh || template.name?.en : template.name
        console.log(`  ${name}: ${likeCount} 个赞`)
      })
    } else {
      console.log('❌ 当前页面的模板都没有点赞记录')
    }
  }
}