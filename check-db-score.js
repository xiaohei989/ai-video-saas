import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

async function checkScore() {
  const id = '31391a1e-5a9a-4184-8082-0e5168746193'

  console.log('\n🔍 查询数据库中的实际评分...\n')

  const { data, error } = await supabase
    .from('template_seo_guides')
    .select('id, seo_score, content_quality_score, keyword_optimization_score, readability_score, keyword_density_score, updated_at')
    .eq('id', id)
    .single()

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  console.log('✅ 数据库中的实际值:')
  console.log('━'.repeat(60))
  console.log(`总分: ${data.seo_score}`)
  console.log(`内容质量: ${data.content_quality_score}`)
  console.log(`关键词优化: ${data.keyword_optimization_score}`)
  console.log(`可读性: ${data.readability_score}`)
  console.log(`关键词密度: ${data.keyword_density_score} ⭐⭐⭐`)
  console.log(`更新时间: ${data.updated_at}`)
  console.log('━'.repeat(60))

  if (data.keyword_density_score === 10) {
    console.log('\n⚠️ 警告: 数据库中的 keyword_density_score 还是 10！')
    console.log('这说明数据库更新可能失败了。')
  } else if (data.keyword_density_score === 0) {
    console.log('\n✅ 正确: 数据库中的 keyword_density_score 是 0')
    console.log('如果界面显示10，那是前端缓存问题。')
  } else {
    console.log(`\n🤔 数据库中的值是 ${data.keyword_density_score}`)
  }
}

checkScore()
