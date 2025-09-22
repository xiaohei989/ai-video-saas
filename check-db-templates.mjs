import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 检查数据库中的模板数据...')

try {
  const { data: templates, error } = await supabase
    .from('templates')
    .select('id, slug, name, description, thumbnail_url, category, credit_cost, tags, is_active, is_public, audit_status')
    .limit(5)

  if (error) {
    console.error('❌ 查询失败:', error)
  } else {
    console.log(`📊 数据库中模板数据（显示前5个）:`)
    
    templates?.forEach((template, index) => {
      console.log(`\n${index + 1}. ${template.slug}`)
      console.log(`   ID: ${template.id}`)
      console.log(`   名称: ${typeof template.name === 'object' ? JSON.stringify(template.name) : template.name}`)
      console.log(`   分类: ${template.category}`)
      console.log(`   积分: ${template.credit_cost}`)
      console.log(`   缩略图: ${template.thumbnail_url ? '✅ 有' : '❌ 无'}`)
      console.log(`   状态: ${template.is_active ? '激活' : '禁用'} | ${template.is_public ? '公开' : '私有'} | 审核:${template.audit_status}`)
      console.log(`   标签: [${template.tags?.join(', ')}]`)
    })
  }

  // 检查总数
  const { count } = await supabase
    .from('templates')
    .select('*', { count: 'exact', head: true })

  console.log(`\n📈 数据库模板总数: ${count}`)

  // 检查API Service是否工作
  console.log('\n🧪 测试模板API Service...')
  
  const { data: apiData, error: apiError } = await supabase
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
    .eq('is_active', true)
    .eq('is_public', true)
    .eq('audit_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(3)

  if (apiError) {
    console.error('❌ API查询失败:', apiError)
  } else {
    console.log(`✅ API查询成功，返回 ${apiData?.length} 个模板`)
    console.log('前3个模板:', apiData?.map(t => t.slug))
  }

} catch (error) {
  console.error('❌ 发生错误:', error.message)
}