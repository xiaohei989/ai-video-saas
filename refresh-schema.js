import { createClient } from '@supabase/supabase-js'

// 使用 service_role key 以获得完整权限
const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.xf63TZNGy60zFFOeUTxw7LOI3bkXPOZDqm3eMHNLBOI'
)

async function refreshSchema() {
  console.log('\n🔄 正在刷新 Supabase Schema Cache...\n')

  // 方法1: 发送 NOTIFY 命令触发 PostgREST 重新加载 schema
  const { error: notifyError } = await supabase.rpc('pgrst_watch').select()

  if (notifyError && notifyError.code !== '42883') {
    // 42883 = function does not exist，这是正常的
    console.log('📝 NOTIFY 命令结果:', notifyError.message)
  }

  // 方法2: 简单地查询表结构，让 PostgREST 发现变化
  console.log('📋 检查表结构...')
  const { data, error } = await supabase
    .from('template_seo_guides')
    .select('keyword_density_score')
    .limit(1)

  if (error) {
    console.error('❌ 错误:', error.message)
    if (error.message.includes('performance_score')) {
      console.log('\n⚠️  Schema cache 仍然使用旧字段名')
      console.log('📌 解决方案：')
      console.log('   1. 前往 Supabase Dashboard: https://supabase.com/dashboard/project/hvkzwrnvxsleeonqqrzq')
      console.log('   2. Settings → API')
      console.log('   3. 点击右上角 "Refresh Schema" 或 "Reload schema cache"')
      console.log('   4. 等待 10-20 秒')
      console.log('   5. 重新运行 AI 评分')
    }
  } else {
    console.log('✅ Schema cache 已更新！新字段 keyword_density_score 可用')
    console.log('💡 现在可以重新运行 AI 评分了')
  }

  console.log('\n━'.repeat(40))
}

refreshSchema()
