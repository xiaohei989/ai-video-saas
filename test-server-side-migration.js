/**
 * 测试服务端迁移功能
 * 验证新的Edge Function能否正确执行视频迁移并避免CORS问题
 */

import { createClient } from '@supabase/supabase-js'

// 配置
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  testUserId: '145ab853-3cc7-4d7b-a3f7-327d558dd950',
  testVideoUrl: 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/fba658c2-4ae0-4097-9f64-59a9575390c4_normal.mp4'
}

console.log('🚀 ========== 服务端迁移功能测试 ==========')
console.log('🎯 目标：验证Edge Function服务端迁移能否解决CORS问题')
console.log('🔧 配置检查:')
console.log(`  Supabase URL: ${config.supabaseUrl ? '✅' : '❌'}`)
console.log(`  Supabase Key: ${config.supabaseKey ? '✅' : '❌'}`)
console.log('')

const supabase = createClient(config.supabaseUrl, config.supabaseKey)

/**
 * 创建测试视频记录
 */
async function createTestVideo() {
  const testVideoId = crypto.randomUUID()
  
  console.log('📝 第1步：创建测试视频记录...')
  const { data: video, error } = await supabase
    .from('videos')
    .insert({
      id: testVideoId,
      user_id: config.testUserId,
      title: '服务端迁移测试视频',
      prompt: '测试视频迁移从第三方存储到R2存储',
      status: 'completed',
      video_url: config.testVideoUrl,
      migration_status: 'pending',
      original_video_url: config.testVideoUrl,
      processing_completed_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    throw new Error(`创建测试视频失败: ${error.message}`)
  }

  console.log(`✅ 测试视频创建成功: ${testVideoId}`)
  console.log(`🔗 原始URL: ${video.video_url}`)
  console.log('')
  
  return { testVideoId, video }
}

/**
 * 测试服务端迁移Edge Function
 */
async function testServerSideMigration(videoId) {
  console.log('🔄 第2步：调用服务端迁移Edge Function...')
  
  try {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/migrate-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: videoId,
        forceRemigrate: false
      })
    })

    console.log(`📞 HTTP响应状态: ${response.status}`)
    console.log(`📞 HTTP响应成功: ${response.ok}`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Edge Function调用失败: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    
    console.log('')
    console.log('📋 ========== 迁移结果 ==========')
    console.log(`✅ 成功: ${result.success ? 'Yes' : 'No'}`)
    console.log(`📹 视频ID: ${result.videoId}`)
    
    if (result.success) {
      if (result.skipped) {
        console.log(`ℹ️ 跳过原因: ${result.reason}`)
      } else {
        console.log(`🔗 R2 URL: ${result.r2Url}`)
        console.log(`🔑 R2 Key: ${result.r2Key}`)
      }
    } else {
      console.log(`💥 错误: ${result.error}`)
    }
    
    return result

  } catch (error) {
    console.error('💥 服务端迁移调用失败:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * 验证迁移后的数据库状态
 */
async function verifyMigrationResult(videoId) {
  console.log('')
  console.log('🔍 第3步：验证迁移后的数据库状态...')
  
  const { data: video } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single()

  if (!video) {
    console.error('❌ 无法读取视频记录')
    return false
  }

  console.log('📊 数据库状态:')
  console.log(`   ID: ${video.id}`)
  console.log(`   标题: ${video.title}`)
  console.log(`   状态: ${video.status}`)
  console.log(`   迁移状态: ${video.migration_status}`)
  console.log(`   video_url: ${video.video_url}`)
  console.log(`   r2_url: ${video.r2_url || 'NULL'}`)
  console.log(`   r2_key: ${video.r2_key || 'NULL'}`)
  console.log(`   R2上传时间: ${video.r2_uploaded_at || 'NULL'}`)
  console.log('')

  // 分析结果
  const isMigrated = video.migration_status === 'completed'
  const hasR2Url = !!video.r2_url
  const isUsingR2 = video.video_url?.includes('cdn.veo3video.me')
  
  console.log('📈 迁移分析:')
  console.log(`   ${isMigrated ? '✅' : '❌'} 迁移状态: ${isMigrated ? '已完成' : '未完成'}`)
  console.log(`   ${hasR2Url ? '✅' : '❌'} R2 URL: ${hasR2Url ? '存在' : '缺失'}`)
  console.log(`   ${isUsingR2 ? '✅' : '⚠️'} 当前存储: ${isUsingR2 ? 'R2存储' : '第三方存储'}`)
  console.log('')

  return { isMigrated, hasR2Url, isUsingR2, video }
}

/**
 * 测试R2存储的访问性
 */
async function testR2Access(r2Url) {
  if (!r2Url) {
    console.log('⚠️ 没有R2 URL需要测试')
    return false
  }

  console.log('🌐 第4步：测试R2存储访问性...')
  
  try {
    const response = await fetch(r2Url, { method: 'HEAD' })
    const accessible = response.ok
    
    console.log(`📞 访问测试结果: ${accessible ? '✅ 可访问' : '❌ 不可访问'}`)
    console.log(`📊 状态码: ${response.status}`)
    
    if (accessible) {
      const contentLength = response.headers.get('content-length')
      const contentType = response.headers.get('content-type')
      console.log(`📏 文件大小: ${contentLength ? `${Math.round(parseInt(contentLength) / 1024 / 1024 * 100) / 100} MB` : 'Unknown'}`)
      console.log(`📄 文件类型: ${contentType || 'Unknown'}`)
    }
    
    return accessible
    
  } catch (error) {
    console.error('💥 R2访问测试失败:', error.message)
    return false
  }
}

/**
 * 清理测试数据
 */
async function cleanup(videoId) {
  console.log('')
  console.log('🧹 第5步：清理测试数据...')
  
  try {
    await supabase
      .from('videos')
      .delete()
      .eq('id', videoId)
    console.log('✅ 测试数据清理完成')
  } catch (error) {
    console.log('⚠️ 清理测试数据时出错:', error.message)
  }
}

/**
 * 主测试流程
 */
async function runServerSideMigrationTest() {
  let testVideoId = null
  
  try {
    console.log('🚀 开始服务端迁移功能测试...')
    console.log('')
    
    // 第1步：创建测试视频
    const { testVideoId: createdVideoId } = await createTestVideo()
    testVideoId = createdVideoId
    
    // 第2步：执行服务端迁移
    const migrationResult = await testServerSideMigration(testVideoId)
    
    // 第3步：验证迁移结果
    const verificationResult = await verifyMigrationResult(testVideoId)
    
    // 第4步：测试R2访问性
    let accessibilityResult = false
    if (verificationResult.hasR2Url) {
      accessibilityResult = await testR2Access(verificationResult.video.r2_url)
    }
    
    // 总结测试结果
    console.log('')
    console.log('🎯 ========== 服务端迁移测试总结 ==========')
    
    const migrationSuccess = migrationResult.success && !migrationResult.error
    const dataIntegrity = verificationResult.isMigrated && verificationResult.hasR2Url
    const storageSwitch = verificationResult.isUsingR2
    
    console.log(`${migrationSuccess ? '✅' : '❌'} Edge Function调用: ${migrationSuccess ? '成功' : '失败'}`)
    console.log(`${dataIntegrity ? '✅' : '❌'} 数据完整性: ${dataIntegrity ? '正常' : '异常'}`)
    console.log(`${storageSwitch ? '✅' : '❌'} 存储切换: ${storageSwitch ? '已切换到R2' : '仍在第三方存储'}`)
    console.log(`${accessibilityResult ? '✅' : '⚠️'} R2可访问性: ${accessibilityResult ? '正常' : '需要验证'}`)
    
    const overallSuccess = migrationSuccess && dataIntegrity && storageSwitch
    
    if (overallSuccess) {
      console.log('')
      console.log('🎉 服务端迁移测试成功！')
      console.log('📌 CORS问题已解决')
      console.log('📌 迁移完全在服务端执行')
      console.log('📌 数据库状态正确更新')
      console.log('📌 视频已成功切换到R2存储')
    } else {
      console.log('')
      console.log('⚠️ 服务端迁移测试发现问题')
      if (!migrationSuccess) {
        console.log(`💥 迁移失败原因: ${migrationResult.error}`)
      }
      if (!dataIntegrity) {
        console.log('📊 数据完整性问题，需要检查数据库更新逻辑')
      }
      if (!storageSwitch) {
        console.log('🔄 存储未切换，需要检查video_url更新逻辑')
      }
    }
    
    return { 
      success: overallSuccess, 
      testVideoId,
      migrationResult,
      verificationResult,
      accessibilityResult
    }
    
  } catch (error) {
    console.error('💥 测试执行失败:', error.message)
    return { success: false, error: error.message, testVideoId }
  } finally {
    // 清理测试数据
    if (testVideoId) {
      await cleanup(testVideoId)
    }
  }
}

// 运行测试
runServerSideMigrationTest()
  .then(result => {
    console.log('')
    console.log(`📋 测试完成，退出码: ${result.success ? 0 : 1}`)
    process.exit(result.success ? 0 : 1)
  })
  .catch(error => {
    console.error('未捕获异常:', error)
    process.exit(1)
  })