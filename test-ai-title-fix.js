/**
 * 测试AI标题超时修复效果
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testAITitleStatusField() {
  console.log('🧪 测试AI标题状态字段修复效果')
  console.log('='.repeat(50))
  
  try {
    // 1. 测试新字段是否存在
    console.log('1️⃣ 检查ai_title_status字段是否存在...')
    
    const { data: testData, error: testError } = await supabase
      .from('videos')
      .select('id, title, ai_title_status, created_at')
      .limit(5)
    
    if (testError) {
      console.error('❌ 字段测试失败:', testError.message)
      return
    }
    
    console.log('✅ ai_title_status字段正常工作')
    console.log('📊 样本数据:')
    testData?.forEach((video, index) => {
      console.log(`  ${index + 1}. ${video.id} - ${video.ai_title_status} - "${video.title?.substring(0, 40)}..."`)
    })
    
    // 2. 统计各状态的分布
    console.log('\n2️⃣ 统计AI标题状态分布...')
    
    const { data: statusStats, error: statsError } = await supabase
      .from('videos')
      .select('ai_title_status')
      .not('is_deleted', 'eq', true)
    
    if (statsError) {
      console.error('❌ 统计查询失败:', statsError.message)
      return
    }
    
    const statusCounts = statusStats?.reduce((acc, video) => {
      const status = video.ai_title_status || 'null'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {}) || {}
    
    console.log('📈 状态分布:')
    Object.entries(statusCounts).forEach(([status, count]) => {
      const percentage = ((count / (statusStats?.length || 1)) * 100).toFixed(1)
      console.log(`  ${status}: ${count} (${percentage}%)`)
    })
    
    // 3. 查找timeout_default状态的视频（需要异步更新的）
    console.log('\n3️⃣ 查找需要异步更新的视频...')
    
    const { data: timeoutVideos, error: timeoutError } = await supabase
      .from('videos')
      .select('id, title, description, ai_title_status, created_at')
      .eq('ai_title_status', 'timeout_default')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (timeoutError) {
      console.error('❌ 查询timeout视频失败:', timeoutError.message)
      return
    }
    
    if (timeoutVideos && timeoutVideos.length > 0) {
      console.log(`📋 找到 ${timeoutVideos.length} 个使用超时默认值的视频:`)
      timeoutVideos.forEach((video, index) => {
        const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
        console.log(`  ${index + 1}. ${video.id}`)
        console.log(`     标题: "${video.title}"`)
        console.log(`     创建时间: ${createdAt}`)
        console.log(`     简介: "${video.description?.substring(0, 60)}..."`)
        console.log()
      })
    } else {
      console.log('✅ 目前没有使用超时默认值的视频')
    }
    
    // 4. 测试创建一个测试记录
    console.log('4️⃣ 测试创建带AI状态的视频记录...')
    
    const testVideoData = {
      user_id: 'a196e594-3b96-4ed2-9066-2788dd41a79c', // 使用一个存在的用户ID
      title: 'AI标题状态测试视频',
      description: '这是一个测试AI标题状态字段的视频记录',
      ai_title_status: 'timeout_default',
      status: 'pending',
      credits_used: 0,
      parameters: { test: true },
      is_deleted: false
    }
    
    const { data: createdVideo, error: createError } = await supabase
      .from('videos')
      .insert(testVideoData)
      .select()
      .single()
    
    if (createError) {
      console.error('❌ 创建测试视频失败:', createError.message)
      return
    }
    
    console.log('✅ 测试视频创建成功:')
    console.log(`   ID: ${createdVideo.id}`)
    console.log(`   AI状态: ${createdVideo.ai_title_status}`)
    
    // 5. 测试更新AI状态
    console.log('\n5️⃣ 测试AI状态更新...')
    
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        ai_title_status: 'ai_generated',
        title: 'AI生成的优化标题 - 测试成功',
        updated_at: new Date().toISOString()
      })
      .eq('id', createdVideo.id)
    
    if (updateError) {
      console.error('❌ 更新测试视频失败:', updateError.message)
      return
    }
    
    console.log('✅ AI状态更新成功')
    
    // 6. 清理测试数据
    console.log('\n6️⃣ 清理测试数据...')
    
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', createdVideo.id)
    
    if (deleteError) {
      console.warn('⚠️ 清理测试数据失败:', deleteError.message)
    } else {
      console.log('✅ 测试数据清理完成')
    }
    
    console.log('\n🎉 AI标题状态字段修复测试完成!')
    console.log('✅ 所有功能正常工作')
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

// 运行测试
testAITitleStatusField()