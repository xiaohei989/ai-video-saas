import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 检查模板缩略图URL状况...')

try {
  const { data: templates, error } = await supabase
    .from('templates')
    .select('id, slug, thumbnail_url, preview_url')
    .eq('is_active', true)
    .eq('is_public', true)
    .eq('audit_status', 'approved')
    .limit(10)

  if (error) {
    console.error('❌ 查询失败:', error)
  } else {
    console.log(`📊 检查前10个模板的缩略图状况:`)
    
    templates?.forEach((template, index) => {
      console.log(`\n${index + 1}. ${template.slug}`)
      console.log(`   ID: ${template.id}`)
      console.log(`   缩略图URL: ${template.thumbnail_url || 'NULL'}`)
      console.log(`   预览URL: ${template.preview_url || 'NULL'}`)
      
      if (template.thumbnail_url) {
        const isValid = template.thumbnail_url.startsWith('http') || template.thumbnail_url.startsWith('/') || template.thumbnail_url.startsWith('.')
        console.log(`   URL格式: ${isValid ? '✅ 有效' : '❌ 无效'}`)
      } else {
        console.log(`   URL格式: ❌ 空值`)
      }
    })
    
    const withThumbnails = templates?.filter(t => t.thumbnail_url).length || 0
    const withPreviews = templates?.filter(t => t.preview_url).length || 0
    
    console.log(`\n📈 统计:`)
    console.log(`   有缩略图: ${withThumbnails}/${templates?.length}`)
    console.log(`   有预览图: ${withPreviews}/${templates?.length}`)
  }
} catch (error) {
  console.error('❌ 发生错误:', error.message)
}