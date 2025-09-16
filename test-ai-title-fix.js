/**
 * 测试AI标题异步更新修复效果
 * 用于验证超时后异步生成的标题是否能正确替换默认标题
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的环境变量:')
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl)
  console.error('   VITE_SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testAITitleFix() {
  console.log('🧪 开始测试AI标题异步更新修复效果')
  console.log('='.repeat(50))
  
  try {
    // 1. 查找最近的视频记录，特别是那些可能使用了默认标题的
    console.log('1️⃣ 查找最近的视频记录...')
    
    const { data: recentVideos, error: fetchError } = await supabase
      .from('videos')
      .select('id, title, description, status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (fetchError) {
      console.error('❌ 获取视频记录失败:', fetchError.message)
      return
    }
    
    console.log(`📊 找到 ${recentVideos.length} 个最近的视频记录`)
    
    // 2. 分析标题类型
    console.log('\n2️⃣ 分析标题类型:')
    
    const defaultKeywords = [
      'Epic', 'Amazing', 'Incredible', 'Stunning', 'Creative', 'Unique', 'Fantastic',
      'Adventure', 'Magical', 'Urban', 'Showcase', 'Story'
    ]
    
    const fallbackKeywords = ['精彩', '创意', '有趣的', '精选', 'Video', 'Generated']
    
    const videoAnalysis = recentVideos.map(video => {
      const title = video.title || ''
      const titleLower = title.toLowerCase()
      
      const hasDefault = defaultKeywords.some(k => titleLower.includes(k.toLowerCase()))
      const hasFallback = fallbackKeywords.some(k => titleLower.includes(k.toLowerCase()))
      const isTooShort = title.trim().length < 10
      const isLikelyAI = title.length > 15 && !hasDefault && !hasFallback && !isTooShort
      
      return {
        id: video.id,
        title: title.substring(0, 60) + (title.length > 60 ? '...' : ''),
        status: video.status,
        createdAt: new Date(video.created_at).toLocaleString('zh-CN'),
        updatedAt: new Date(video.updated_at).toLocaleString('zh-CN'),
        analysis: {
          hasDefault,
          hasFallback,
          isTooShort,
          isLikelyAI,
          needsUpdate: hasDefault || hasFallback || isTooShort
        }
      }
    })
    
    console.table(videoAnalysis.map(v => ({
      ID: v.id.substring(0, 8) + '...',
      标题: v.title,
      状态: v.status,
      创建时间: v.createdAt,
      更新时间: v.updatedAt,
      包含默认词: v.analysis.hasDefault ? '✅' : '❌',
      包含回退词: v.analysis.hasFallback ? '✅' : '❌', 
      标题太短: v.analysis.isTooShort ? '✅' : '❌',
      疑似AI生成: v.analysis.isLikelyAI ? '✅' : '❌',
      需要更新: v.analysis.needsUpdate ? '🔄' : '✅'
    })))
    
    // 3. 统计分析
    const needsUpdateCount = videoAnalysis.filter(v => v.analysis.needsUpdate).length
    const hasDefaultCount = videoAnalysis.filter(v => v.analysis.hasDefault).length
    const isAIGeneratedCount = videoAnalysis.filter(v => v.analysis.isLikelyAI).length
    
    console.log('\n3️⃣ 统计分析:')
    console.log(`📈 总视频数: ${videoAnalysis.length}`)
    console.log(`🔄 需要更新的视频: ${needsUpdateCount} (${(needsUpdateCount/videoAnalysis.length*100).toFixed(1)}%)`)
    console.log(`🎭 使用智能默认标题: ${hasDefaultCount} (${(hasDefaultCount/videoAnalysis.length*100).toFixed(1)}%)`)
    console.log(`🤖 疑似AI生成标题: ${isAIGeneratedCount} (${(isAIGeneratedCount/videoAnalysis.length*100).toFixed(1)}%)`)
    
    // 4. 建议和结论
    console.log('\n4️⃣ 修复效果评估:')
    
    if (needsUpdateCount === 0) {
      console.log('✅ 优秀! 所有最近的视频都有高质量标题')
    } else if (needsUpdateCount < videoAnalysis.length * 0.3) {
      console.log('🟡 良好! 大部分视频有高质量标题，但仍有少量需要改进')
    } else {
      console.log('🔴 需要关注! 较多视频仍在使用默认标题，异步更新可能存在问题')
    }
    
    if (hasDefaultCount > 0) {
      console.log(`\n💡 建议: 有 ${hasDefaultCount} 个视频使用智能默认标题，可以观察它们是否会被异步更新替换`)
      
      // 显示需要关注的视频ID
      const problemVideos = videoAnalysis.filter(v => v.analysis.needsUpdate)
      if (problemVideos.length > 0) {
        console.log('\n🔍 需要关注的视频ID:')
        problemVideos.forEach(v => {
          console.log(`  - ${v.id}: "${v.title}"`)
        })
      }
    }
    
    console.log('\n✅ AI标题修复效果测试完成')
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  testAITitleFix()
}

export { testAITitleFix }