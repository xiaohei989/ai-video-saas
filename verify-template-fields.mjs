import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 检查更新后的模板字段...')

try {
  const { data: template, error } = await supabase
    .from('templates')
    .select('slug, thumbnail_url, veo3_settings, created_at, updated_at, prompt_template')
    .eq('slug', 'miniature-animals-surprise')
    .single()

  if (error) {
    console.error('❌ 查询错误:', error)
    process.exit(1)
  }

  console.log('📋 模板字段验证:')
  console.log('  slug:', template.slug)
  console.log('  thumbnail_url:', template.thumbnail_url?.substring(0, 80) + '...')
  console.log('  created_at:', template.created_at)
  console.log('  updated_at:', template.updated_at)
  console.log('  prompt_template类型:', typeof template.prompt_template)
  console.log('  prompt_template长度:', template.prompt_template?.length || 0)
  console.log('')
  console.log('  veo3_settings:', JSON.stringify(template.veo3_settings, null, 2))

  console.log('')
  console.log('✅ 验证字段映射结果:')
  console.log('  ✓ thumbnail_url:', template.thumbnail_url ? '已设置' : '未设置')
  console.log('  ✓ created_at:', template.created_at ? '已设置' : '未设置')
  console.log('  ✓ updated_at:', template.updated_at ? '已设置' : '未设置')
  console.log('  ✓ icon:', template.veo3_settings?.icon ? `已设置(${template.veo3_settings.icon})` : '未设置')
  console.log('  ✓ blurThumbnailUrl:', template.veo3_settings?.blurThumbnailUrl ? '已设置' : '未设置')
  console.log('  ✓ prompt_template:', template.prompt_template ? '已设置' : '未设置')

} catch (error) {
  console.error('❌ 验证失败:', error.message)
  process.exit(1)
}