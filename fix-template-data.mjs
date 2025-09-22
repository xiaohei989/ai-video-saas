import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔧 修复模板数据...')

try {
  // 1. 将所有模板的审核状态更新为approved
  console.log('\n1️⃣ 更新审核状态为approved...')
  const { data: updatedTemplates, error: updateError } = await supabase
    .from('templates')
    .update({
      audit_status: 'approved',
      reviewed_at: new Date().toISOString()
    })
    .neq('audit_status', 'approved')
    .select('id, slug')

  if (updateError) {
    console.error('❌ 更新审核状态失败:', updateError)
  } else {
    console.log(`✅ 成功更新 ${updatedTemplates?.length || 0} 个模板的审核状态`)
  }

  // 2. 修复空的分类字段
  console.log('\n2️⃣ 修复空的分类字段...')
  const { data: nullCategoryTemplates, error: categoryError } = await supabase
    .from('templates')
    .update({ category: 'entertainment' })
    .is('category', null)
    .select('id, slug')

  if (categoryError) {
    console.error('❌ 更新分类失败:', categoryError)
  } else {
    console.log(`✅ 成功为 ${nullCategoryTemplates?.length || 0} 个模板设置默认分类`)
  }

  // 3. 检查更新后的状态
  console.log('\n3️⃣ 检查更新后的状态...')
  const { data: finalCheck, error: checkError } = await supabase
    .from('templates')
    .select('audit_status, category, is_active, is_public')
    .eq('is_active', true)
    .eq('is_public', true)

  if (checkError) {
    console.error('❌ 检查失败:', checkError)
  } else {
    const approvedCount = finalCheck?.filter(t => t.audit_status === 'approved').length || 0
    const withCategory = finalCheck?.filter(t => t.category && t.category !== null).length || 0
    
    console.log(`✅ 最终状态:`)
    console.log(`   - 审核通过的模板: ${approvedCount}/${finalCheck?.length}`)
    console.log(`   - 有分类的模板: ${withCategory}/${finalCheck?.length}`)
  }

  // 4. 测试API查询
  console.log('\n4️⃣ 测试API查询...')
  const { data: apiTest, error: apiError } = await supabase
    .from('templates')
    .select('id, slug, name, category, audit_status')
    .eq('is_active', true)
    .eq('is_public', true)
    .eq('audit_status', 'approved')
    .limit(5)

  if (apiError) {
    console.error('❌ API测试失败:', apiError)
  } else {
    console.log(`✅ API测试成功，返回 ${apiTest?.length} 个模板:`)
    apiTest?.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.slug} (${template.category}) - ${template.audit_status}`)
    })
  }

} catch (error) {
  console.error('❌ 发生错误:', error.message)
}