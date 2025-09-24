/**
 * 使用Playwright测试点赞计数功能
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🎭 开始Playwright点赞计数测试...')

async function testLikeCountDisplay() {
  try {
    // 获取一些有点赞的模板用于测试
    console.log('\n📊 第一步：获取测试数据')
    const { data: templates } = await supabase
      .from('templates')
      .select('id, slug, like_count')
      .eq('audit_status', 'approved')
      .eq('is_active', true)
      .eq('is_public', true)
      .gt('like_count', 0)
      .order('like_count', { ascending: false })
      .limit(5)
    
    if (!templates || templates.length === 0) {
      console.log('❌ 没有找到有点赞的模板')
      return false
    }
    
    console.log(`✅ 找到 ${templates.length} 个有点赞的模板`)
    
    // 显示测试模板信息
    console.log('\n📋 测试模板列表:')
    templates.forEach((template, index) => {
      console.log(`  ${index + 1}. ${template.slug}: ${template.like_count} 个赞`)
    })
    
    return { templates, testData: templates[0] }
  } catch (error) {
    console.error('❌ 获取测试数据失败:', error)
    return false
  }
}

// 导出测试数据供Playwright使用
const testResult = await testLikeCountDisplay()
if (testResult) {
  console.log(`\n🎯 主要测试模板: ${testResult.testData.slug}`)
  console.log(`📊 预期点赞数: ${testResult.testData.like_count}`)
  console.log(`🔗 模板ID: ${testResult.testData.id}`)
  
  // 将测试数据写入环境变量或文件，供Playwright读取
  console.log('\n✅ 数据准备完成，可以开始Playwright测试')
} else {
  console.log('\n❌ 数据准备失败')
  process.exit(1)
}