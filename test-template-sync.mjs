/**
 * 测试模板同步功能
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 测试模板同步功能...')

async function testTemplateSync() {
  try {
    // 1. 检查数据库中是否有templates表
    console.log('\n📊 检查数据库表结构...')
    const { data: tables, error: tableError } = await supabase
      .from('templates')
      .select('id')
      .limit(1)

    if (tableError) {
      console.error('❌ templates表不存在或访问失败:', tableError.message)
      return
    }

    console.log('✅ templates表存在')

    // 2. 查询现有模板数量
    const { count: templateCount, error: countError } = await supabase
      .from('templates')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('❌ 查询模板数量失败:', countError.message)
      return
    }

    console.log(`📋 数据库中现有模板数量: ${templateCount || 0}`)

    // 3. 查看前几个模板
    const { data: templates, error: fetchError } = await supabase
      .from('templates')
      .select('id, slug, name, credits, tags, created_at')
      .limit(5)

    if (fetchError) {
      console.error('❌ 获取模板列表失败:', fetchError.message)
      return
    }

    console.log('\n📄 数据库中的模板示例:')
    if (templates && templates.length > 0) {
      templates.forEach((template, index) => {
        console.log(`  ${index + 1}. ${template.slug}`)
        console.log(`     ID: ${template.id}`)
        console.log(`     名称: ${JSON.stringify(template.name)}`)
        console.log(`     积分: ${template.credits}`)
        console.log(`     标签: ${template.tags?.join(', ') || '无'}`)
        console.log(`     创建: ${template.created_at}`)
        console.log('')
      })
    } else {
      console.log('  📝 数据库中暂无模板')
    }

    // 4. 测试插入一个模板
    console.log('🔧 测试插入模板功能...')
    
    const testTemplate = {
      id: '5f7e8d9c-3b4a-5c6d-7e8f-9a0b1c2d3e4f',
      slug: 'fireplace-cozy-selfie',
      name: {
        en: 'Fireplace Cozy Selfie',
        zh: '壁炉温馨自拍'
      },
      description: {
        en: 'Cozy fireside selfie video',
        zh: '温馨炉边自拍视频'
      },
      icon: '🔥',
      credits: 8,
      tags: ['selfie', 'cozy', 'fireplace', 'asmr'],
      preview_url: 'https://cdn.veo3video.me/templates/videos/fireplace-seduction-selfie.mp4?v=1758008502567',
      like_count: 0,
      is_active: true,
      version: '1.0.0'
    }

    // 检查是否已存在
    const { data: existing } = await supabase
      .from('templates')
      .select('id')
      .eq('id', testTemplate.id)
      .single()

    if (existing) {
      console.log('✅ 测试模板已存在，跳过插入')
    } else {
      // 插入测试模板
      const { error: insertError } = await supabase
        .from('templates')
        .insert(testTemplate)

      if (insertError) {
        console.error('❌ 插入测试模板失败:', insertError.message)
      } else {
        console.log('✅ 成功插入测试模板')
      }
    }

    // 5. 验证插入结果
    const { data: inserted } = await supabase
      .from('templates')
      .select('*')
      .eq('id', testTemplate.id)
      .single()

    if (inserted) {
      console.log('✅ 验证成功，模板已存在于数据库中')
      console.log('   名称:', JSON.stringify(inserted.name))
      console.log('   积分:', inserted.credits)
      console.log('   标签:', inserted.tags)
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

testTemplateSync()