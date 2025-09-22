import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 详细检查template_likes表中的数据...')

// 检查template_likes表的所有数据
const { data: allLikes } = await supabase
  .from('template_likes')
  .select('template_id, user_id, created_at')
  .order('created_at', { ascending: false })

console.log(`📊 template_likes表总记录数: ${allLikes?.length || 0}`)

// 按模板ID统计点赞数
const likesByTemplate = new Map()
allLikes?.forEach(like => {
  const count = likesByTemplate.get(like.template_id) || 0
  likesByTemplate.set(like.template_id, count + 1)
})

console.log(`\n🎯 有点赞数据的模板数量: ${likesByTemplate.size}`)

// 获取模板名称映射
const { data: templates } = await supabase
  .from('templates')
  .select('id, slug, name')
  .eq('is_active', true)
  .eq('is_public', true)

const templateMap = new Map()
templates?.forEach(template => {
  const name = typeof template.name === 'object' ? 
    template.name?.zh || template.name?.en || template.slug : template.name
  templateMap.set(template.id, { slug: template.slug, name })
})

console.log('\n📋 点赞数统计 (按点赞数排序):')
const sortedLikes = Array.from(likesByTemplate.entries())
  .sort((a, b) => b[1] - a[1])

sortedLikes.forEach(([templateId, count]) => {
  const template = templateMap.get(templateId)
  if (template) {
    console.log(`  ${template.slug}: ${count} 赞 (${template.name})`)
  } else {
    console.log(`  ${templateId}: ${count} 赞 (❌ 模板不存在)`)
  }
})

// 检查是否有重复的模板ID
console.log('\n🔍 检查模板ID是否有重复:')
const templateIds = templates?.map(t => t.id) || []
const uniqueIds = new Set(templateIds)

if (templateIds.length !== uniqueIds.size) {
  console.log('❌ 发现重复的模板ID:')
  const idCounts = new Map()
  templateIds.forEach(id => {
    const count = idCounts.get(id) || 0
    idCounts.set(id, count + 1)
  })
  
  idCounts.forEach((count, id) => {
    if (count > 1) {
      console.log(`  ID ${id} 出现 ${count} 次`)
      const duplicateTemplates = templates?.filter(t => t.id === id)
      duplicateTemplates?.forEach(template => {
        console.log(`    -> slug: ${template.slug}`)
      })
    }
  })
} else {
  console.log('✅ 没有重复的模板ID')
}

// 检查最近的点赞记录时间戳
if (allLikes && allLikes.length > 0) {
  console.log('\n⏰ 最近的点赞记录:')
  allLikes.slice(0, 5).forEach((like, index) => {
    const template = templateMap.get(like.template_id)
    console.log(`  ${index + 1}. ${template?.slug || like.template_id} - ${like.created_at}`)
  })
}