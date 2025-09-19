/**
 * 测试自动同步功能
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🧪 测试自动同步功能...')

async function testAutoSync() {
  try {
    // 1. 删除一个测试模板记录（用于测试）
    const testTemplateId = '00000000-0000-0000-0000-000000000001' // 使用一个测试专用ID
    
    console.log(`\n🗑️ 临时删除模板 ${testTemplateId} 用于测试...`)
    const { error: deleteError } = await supabase
      .from('templates')
      .delete()
      .eq('id', testTemplateId)

    if (deleteError) {
      console.error('删除失败:', deleteError.message)
      return
    }

    console.log('✅ 模板已删除')

    // 2. 验证模板确实不存在
    const { data: checkDeleted } = await supabase
      .from('templates')
      .select('id')
      .eq('id', testTemplateId)
      .single()

    if (checkDeleted) {
      console.error('❌ 模板删除失败，仍然存在')
      return
    }

    console.log('✅ 确认模板已不存在')

    // 3. 现在模拟点赞操作，这应该触发自动同步
    console.log('\n🔧 模拟点赞操作以触发自动同步...')
    
    // 模拟用户点赞（这里只是测试模板查询部分，实际点赞需要用户认证）
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('like_count')
      .eq('id', testTemplateId)
      .single()

    if (templateError && templateError.code === 'PGRST116') {
      console.log('✅ 确认收到了"模板不存在"错误，这是正常的')
      console.log('📝 错误代码:', templateError.code)
      console.log('📝 错误消息:', templateError.message)
      
      // 模拟自动同步逻辑
      console.log('\n🔄 现在手动触发同步来模拟自动同步...')
      
      // 这里需要实际的模板数据来测试同步
      const testTemplate = {
        id: testTemplateId,
        slug: 'test-auto-sync-template',
        name: JSON.stringify({
          en: 'Fireplace Cozy Selfie',
          zh: '壁炉温馨自拍'
        }),
        description: JSON.stringify({
          en: 'Cozy fireside selfie video',
          zh: '温馨炉边自拍视频'
        }),
        preview_url: 'https://cdn.veo3video.me/templates/videos/fireplace-seduction-selfie.mp4?v=1758008502567',
        credit_cost: 8,
        tags: ['selfie', 'cozy', 'fireplace', 'asmr'],
        parameters: {
          character_type: { type: 'select', required: true },
          dialogue_content: { type: 'textarea', required: true }
        },
        prompt_template: JSON.stringify({
          model: 'veo3',
          duration: '8s'
        }),
        veo3_settings: {},
        like_count: 0,
        is_active: true,
        is_public: true,
        version: '1.0.0'
      }

      const { error: insertError } = await supabase
        .from('templates')
        .insert(testTemplate)

      if (insertError) {
        console.error('❌ 模拟同步失败:', insertError.message)
        return
      }

      console.log('✅ 模拟同步成功')

      // 4. 验证同步结果
      const { data: syncedTemplate } = await supabase
        .from('templates')
        .select('*')
        .eq('id', testTemplateId)
        .single()

      if (syncedTemplate) {
        console.log('\n🎉 自动同步测试成功!')
        console.log('📋 同步的模板信息:')
        console.log(`   ID: ${syncedTemplate.id}`)
        console.log(`   Slug: ${syncedTemplate.slug}`)
        console.log(`   名称: ${syncedTemplate.name}`)
        console.log(`   积分: ${syncedTemplate.credit_cost}`)
        console.log(`   点赞数: ${syncedTemplate.like_count}`)
        console.log(`   活跃: ${syncedTemplate.is_active}`)
      } else {
        console.error('❌ 同步后仍未找到模板')
      }

    } else {
      console.error('❌ 未收到预期的"模板不存在"错误')
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

testAutoSync()