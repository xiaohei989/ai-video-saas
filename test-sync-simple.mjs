/**
 * 简单测试模板同步功能
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 测试模板同步...')

async function testSimpleSync() {
  try {
    // 检查现有模板数量
    const { count } = await supabase
      .from('templates')
      .select('*', { count: 'exact', head: true })

    console.log(`📋 数据库中现有模板数量: ${count}`)

    // 查看几个模板
    const { data: templates } = await supabase
      .from('templates')
      .select('id, slug, name, credit_cost, tags')
      .limit(3)

    console.log('\n📄 模板示例:')
    templates?.forEach((template, i) => {
      console.log(`${i + 1}. ${template.slug} (${template.credit_cost} 积分)`)
      console.log(`   名称: ${template.name}`)
      console.log(`   标签: ${template.tags?.join(', ') || '无'}`)
    })

    // 测试插入一个新模板  
    const testId = `5f7e8d9c-3b4a-5c6d-7e8f-${Date.now().toString().slice(-12)}`
    const testTemplate = {
      id: testId,
      slug: `test-template-${Date.now()}`,
      name: JSON.stringify({ en: 'Test Template', zh: '测试模板' }),
      description: JSON.stringify({ en: 'A test template', zh: '一个测试模板' }),
      credit_cost: 5,
      tags: ['test', 'sample'],
      preview_url: 'https://example.com/test.mp4',
      parameters: { test: true },
      prompt_template: JSON.stringify({ test: 'prompt' }),
      veo3_settings: {},
      like_count: 0,
      is_active: true,
      is_public: true,
      version: '1.0.0'
    }

    console.log('\n🔧 插入测试模板...')
    const { error: insertError } = await supabase
      .from('templates')
      .insert(testTemplate)

    if (insertError) {
      console.error('❌ 插入失败:', insertError.message)
    } else {
      console.log('✅ 成功插入测试模板')
      
      // 验证插入
      const { data: inserted } = await supabase
        .from('templates')
        .select('*')
        .eq('id', testId)
        .single()

      if (inserted) {
        console.log('✅ 验证成功，模板存在')
        
        // 清理测试数据
        await supabase
          .from('templates')
          .delete()
          .eq('id', testId)
        
        console.log('🧹 已清理测试数据')
      }
    }

  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

testSimpleSync()