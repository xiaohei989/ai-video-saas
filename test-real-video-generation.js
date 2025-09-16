/**
 * 测试真实的视频生成和迁移流程
 * 使用模拟模式生成视频，然后测试迁移到R2
 */

import { createClient } from '@supabase/supabase-js'

// 配置
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  testUserId: '145ab853-3cc7-4d7b-a3f7-327d558dd950'
}

console.log('🎬 ========== 真实视频生成和迁移测试 ==========')
console.log('🎯 目标：端到端测试视频生成 -> R2迁移完整流程')
console.log(`👤 测试用户ID: ${config.testUserId}`)
console.log('')

const supabase = createClient(config.supabaseUrl, config.supabaseKey)

/**
 * 创建视频生成请求
 */
async function createVideoRequest() {
  const videoId = crypto.randomUUID()
  
  console.log('📝 第1步：创建视频生成请求...')
  const { data: video, error } = await supabase
    .from('videos')
    .insert({
      id: videoId,
      user_id: config.testUserId,
      title: '真实生成测试视频',
      prompt: '一只可爱的仓鼠在城市街道上滑滑板',
      status: 'pending',
      migration_status: 'pending',
      template_id: null,
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    throw new Error(`创建视频请求失败: ${error.message}`)
  }

  console.log(`✅ 视频请求创建成功: ${videoId}`)
  console.log(`📝 提示词: ${video.prompt}`)
  console.log('')
  
  return { videoId, video }
}

/**
 * 模拟视频生成过程（使用开发环境的模拟生成）
 */
async function simulateVideoGeneration(videoId) {
  console.log('🎬 第2步：模拟视频生成过程...')
  
  // 更新状态为处理中
  await supabase
    .from('videos')
    .update({
      status: 'processing',
      processing_started_at: new Date().toISOString(),
      veo3_job_id: `mock-job-${Date.now()}`
    })
    .eq('id', videoId)
  
  console.log('⏳ 视频生成中...')
  
  // 模拟生成延迟
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // 模拟生成完成，使用一个实际存在的视频URL
  const mockVideoUrl = 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/fba658c2-4ae0-4097-9f64-59a9575390c4_normal.mp4'
  
  await supabase
    .from('videos')
    .update({
      status: 'completed',
      video_url: mockVideoUrl,
      processing_completed_at: new Date().toISOString(),
      migration_status: 'downloading'  // 准备开始迁移
    })
    .eq('id', videoId)
  
  console.log('✅ 视频生成完成!')
  console.log(`🔗 生成的视频URL: ${mockVideoUrl}`)
  console.log('')
  
  return mockVideoUrl
}

/**
 * 执行R2迁移
 */
async function executeR2Migration(videoId) {
  console.log('🚀 第3步：执行R2迁移...')
  
  try {
    // 动态导入真实的迁移服务
    const { videoMigrationService } = await import('./src/services/videoMigrationService.js')
    
    console.log('🔄 开始迁移到R2存储...')
    const migrationResult = await videoMigrationService.migrateVideoWithPresignedUrl(videoId)
    
    console.log('📊 迁移结果:', {
      success: migrationResult.success,
      skipped: migrationResult.skipped,
      r2Url: migrationResult.r2Url,
      error: migrationResult.error
    })
    
    return migrationResult
    
  } catch (error) {
    console.error('💥 迁移执行失败:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * 验证最终结果
 */
async function verifyFinalResult(videoId) {
  console.log('🔍 第4步：验证最终结果...')
  
  const { data: finalVideo } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single()
  
  if (!finalVideo) {
    console.error('❌ 无法读取最终视频记录')
    return false
  }
  
  console.log('📊 最终数据库状态:')
  console.log(`   ID: ${finalVideo.id}`)
  console.log(`   标题: ${finalVideo.title}`)
  console.log(`   状态: ${finalVideo.status}`)
  console.log(`   video_url: ${finalVideo.video_url}`)
  console.log(`   r2_url: ${finalVideo.r2_url || 'NULL'}`)
  console.log(`   migration_status: ${finalVideo.migration_status}`)
  console.log(`   处理完成时间: ${finalVideo.processing_completed_at}`)
  console.log(`   R2上传时间: ${finalVideo.r2_uploaded_at || 'NULL'}`)
  console.log('')
  
  // 分析结果
  const isCompleted = finalVideo.status === 'completed'
  const hasVideoUrl = !!finalVideo.video_url
  const isMigrated = finalVideo.migration_status === 'completed' && !!finalVideo.r2_url
  const isR2Storage = finalVideo.video_url?.includes('cdn.veo3video.me')
  
  console.log('📈 结果分析:')
  console.log(`   ✅ 视频生成: ${isCompleted ? '成功' : '失败'}`)
  console.log(`   ✅ 视频URL: ${hasVideoUrl ? '存在' : '缺失'}`)
  console.log(`   ${isMigrated ? '✅' : '❌'} R2迁移: ${isMigrated ? '成功' : '失败/未完成'}`)
  console.log(`   ${isR2Storage ? '✅' : '⚠️'} 存储类型: ${isR2Storage ? 'R2存储' : '第三方存储'}`)
  console.log('')
  
  return { isCompleted, hasVideoUrl, isMigrated, isR2Storage, finalVideo }
}

/**
 * 主测试流程
 */
async function runCompleteTest() {
  let videoId = null
  
  try {
    console.log('🚀 开始完整的视频生成和迁移测试...')
    console.log('')
    
    // 第1步：创建视频请求
    const { videoId: createdVideoId } = await createVideoRequest()
    videoId = createdVideoId
    
    // 第2步：模拟视频生成
    const videoUrl = await simulateVideoGeneration(videoId)
    
    // 第3步：执行R2迁移
    const migrationResult = await executeR2Migration(videoId)
    
    // 第4步：验证最终结果
    const verificationResult = await verifyFinalResult(videoId)
    
    console.log('🎯 ========== 完整测试总结 ==========')
    
    if (verificationResult.isCompleted && verificationResult.hasVideoUrl) {
      console.log('✅ 视频生成流程 - 成功')
    } else {
      console.log('❌ 视频生成流程 - 失败')
    }
    
    if (migrationResult.success && verificationResult.isMigrated) {
      console.log('✅ R2迁移流程 - 成功')
      console.log(`🔗 最终R2 URL: ${verificationResult.finalVideo.r2_url}`)
    } else {
      console.log('❌ R2迁移流程 - 失败或未完成')
      if (migrationResult.error) {
        console.log(`💥 迁移错误: ${migrationResult.error}`)
      }
    }
    
    if (verificationResult.isR2Storage) {
      console.log('✅ 视频已成功迁移到R2存储')
    } else {
      console.log('⚠️ 视频仍在第三方存储')
    }
    
    console.log('')
    
    const overallSuccess = verificationResult.isCompleted && 
                          verificationResult.hasVideoUrl && 
                          migrationResult.success
    
    if (overallSuccess) {
      console.log('🎉 完整测试成功！修复的迁移系统工作正常')
    } else {
      console.log('⚠️ 测试发现问题，需要进一步调试')
    }
    
    return { success: overallSuccess, videoId, result: verificationResult }
    
  } catch (error) {
    console.error('💥 测试执行失败:', error.message)
    return { success: false, error: error.message, videoId }
  }
}

/**
 * 清理测试数据
 */
async function cleanup(videoId) {
  if (videoId) {
    console.log('')
    console.log('🧹 清理测试数据...')
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
}

// 运行测试
runCompleteTest()
  .then(async result => {
    await cleanup(result.videoId)
    process.exit(result.success ? 0 : 1)
  })
  .catch(async error => {
    console.error('未捕获异常:', error)
    process.exit(1)
  })