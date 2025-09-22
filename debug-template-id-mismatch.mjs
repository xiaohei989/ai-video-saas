import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 调试模板ID不匹配问题...')

// 1. 获取所有模板ID
const { data: allTemplates } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('is_active', true)
  .eq('is_public', true)

console.log(`📋 总共有 ${allTemplates.length} 个活跃模板`)

// 2. 获取有点赞数据的模板ID
const { data: templateLikes } = await supabase
  .from('template_likes')
  .select('template_id')

const uniqueTemplateIds = [...new Set(templateLikes?.map(like => like.template_id))]
console.log(`🎯 有点赞数据的模板ID: ${uniqueTemplateIds.length} 个`)

// 3. 检查ID匹配情况
console.log('\n🔍 检查模板ID匹配情况:')
const templateIdSet = new Set(allTemplates.map(t => t.id))

for (const likeTemplateId of uniqueTemplateIds) {
  const exists = templateIdSet.has(likeTemplateId)
  console.log(`  ${likeTemplateId}: ${exists ? '✅ 匹配' : '❌ 不匹配'}`)
  
  if (exists) {
    const template = allTemplates.find(t => t.id === likeTemplateId)
    const name = typeof template.name === 'object' ? 
      template.name?.zh || template.name?.en || template.slug : template.name
    console.log(`    模板名: ${name}`)
    
    // 统计该模板的点赞数
    const { data: likes } = await supabase
      .from('template_likes')
      .select('id')
      .eq('template_id', likeTemplateId)
    console.log(`    点赞数: ${likes?.length || 0}`)
  }
}

// 4. 检查前端显示的前12个模板是否有点赞数据
console.log('\n📊 前端显示的前12个模板检查:')
const { data: frontendTemplates } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('is_active', true)
  .eq('is_public', true)
  .order('created_at', { ascending: false })
  .limit(12)

for (const template of frontendTemplates) {
  const hasLikes = uniqueTemplateIds.includes(template.id)
  const name = typeof template.name === 'object' ? 
    template.name?.zh || template.name?.en || template.slug : template.name
  console.log(`  ${name}: ${hasLikes ? '✅ 有点赞数据' : '❌ 无点赞数据'} (${template.id})`)
}