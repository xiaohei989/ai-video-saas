import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 检查前端显示的前12个模板的实际点赞数...')

// 获取前12个模板（对应前端显示的）
const { data: templates } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('is_active', true)
  .eq('is_public', true)
  .order('created_at', { ascending: false })
  .limit(12)

console.log('📋 前12个模板信息:')
for (const template of templates) {
  // 统计每个模板的点赞数
  const { data: likes } = await supabase
    .from('template_likes')
    .select('id')
    .eq('template_id', template.id)
    
  const likeCount = likes?.length || 0
  const name = typeof template.name === 'object' ? 
    template.name?.zh || template.name?.en || template.slug : template.name
    
  console.log(`  ${name}: ${likeCount} 赞 (ID: ${template.id})`)
}

// 检查template_likes表总数
const { data: allLikes } = await supabase
  .from('template_likes')
  .select('id')
  
console.log(`\n📊 template_likes表总记录数: ${allLikes?.length || 0}`)

// 检查有点赞数据的模板
const { data: templatesWithLikes } = await supabase
  .from('template_likes')
  .select('template_id')

const likeCountMap = new Map()
templatesWithLikes?.forEach(like => {
  const count = likeCountMap.get(like.template_id) || 0
  likeCountMap.set(like.template_id, count + 1)
})

console.log(`\n🎯 有点赞数据的模板数量: ${likeCountMap.size}`)
console.log('🔢 点赞数分布:')
Array.from(likeCountMap.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([templateId, count]) => {
    console.log(`  模板ID ${templateId}: ${count} 赞`)
  })