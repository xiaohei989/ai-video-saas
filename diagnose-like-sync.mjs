import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 诊断点赞数据同步问题...')

// 1. 查看template_likes中的模板ID
console.log('\n📊 template_likes表中的模板ID:')
const { data: likeRecords } = await supabase
  .from('template_likes')
  .select('template_id')
  .limit(10)

const likedTemplateIds = [...new Set(likeRecords?.map(r => r.template_id) || [])]
console.log('点赞过的模板ID:', likedTemplateIds)

// 2. 查看templates表中的实际ID
console.log('\n📊 templates表中的模板ID:')
const { data: templates } = await supabase
  .from('templates')
  .select('id, slug')
  .limit(10)

const actualTemplateIds = templates?.map(t => t.id) || []
console.log('实际模板ID:', actualTemplateIds)

// 3. 检查ID匹配情况
console.log('\n🔍 ID匹配分析:')
const matchingIds = likedTemplateIds.filter(id => actualTemplateIds.includes(id))
const missingIds = likedTemplateIds.filter(id => !actualTemplateIds.includes(id))

console.log(`✅ 匹配的ID: ${matchingIds.length}`)
matchingIds.forEach(id => console.log(`  - ${id}`))

console.log(`❌ 不匹配的ID: ${missingIds.length}`)
missingIds.forEach(id => console.log(`  - ${id}`))

// 4. 手动计算某个模板的点赞数
if (matchingIds.length > 0) {
  const testTemplateId = matchingIds[0]
  console.log(`\n🧮 手动计算模板 ${testTemplateId} 的点赞数:`)
  
  const { data: likesForTemplate } = await supabase
    .from('template_likes')
    .select('*')
    .eq('template_id', testTemplateId)
  
  console.log(`实际点赞数: ${likesForTemplate?.length || 0}`)
  
  const { data: templateInfo } = await supabase
    .from('templates')
    .select('like_count, slug')
    .eq('id', testTemplateId)
    .single()
  
  console.log(`模板表中记录的点赞数: ${templateInfo?.like_count || 0}`)
  console.log(`模板slug: ${templateInfo?.slug || 'Unknown'}`)
}