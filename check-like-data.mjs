import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 检查模板表的点赞数据...')

const { data: templates, error } = await supabase
  .from('templates')
  .select('id, slug, like_count, name')
  .order('like_count', { ascending: false })
  .limit(10)

if (error) {
  console.error('❌ 查询错误:', error)
} else {
  console.log('📊 模板点赞数据（Top 10）:')
  templates?.forEach((template, i) => {
    const name = typeof template.name === 'string' ? template.name : 
                  (typeof template.name === 'object' ? template.name?.zh || template.name?.en || 'Unknown' : 'Unknown')
    console.log(`${i+1}. ${name}: ${template.like_count} 赞`)
  })
  console.log()

  const zeroLikes = templates?.filter(t => t.like_count === 0) || []
  console.log(`❌ 点赞数为0的模板: ${zeroLikes.length} / ${templates?.length}`)
}

console.log('\n🔍 检查template_likes表...')
const { data: likes, error: likesError } = await supabase
  .from('template_likes')
  .select('template_id, user_id, created_at')
  .limit(10)

if (likesError) {
  console.error('❌ template_likes查询错误:', likesError)
} else {
  console.log(`📊 template_likes表记录数: ${likes?.length || 0}`)
  if (likes && likes.length > 0) {
    console.log('最近的点赞记录:')
    likes.forEach((like, i) => {
      console.log(`${i+1}. 模板: ${like.template_id} | 用户: ${like.user_id} | 时间: ${like.created_at}`)
    })
  } else {
    console.log('⚠️ template_likes表为空')
  }
}