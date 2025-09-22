import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'
)

console.log('🔍 深度调查缩略图生成失败的具体原因...')

// 获取失败的视频，包含更多字段
const { data: failedVideos } = await supabase
  .from('videos')
  .select('id, title, video_url, thumbnail_generation_status, error_message, thumbnail_error_details, created_at, processing_completed_at')
  .eq('thumbnail_generation_status', 'failed')
  .order('created_at', { ascending: false })
  .limit(20)

console.log(`\n❌ 找到 ${failedVideos?.length || 0} 个失败的视频`)

if (failedVideos && failedVideos.length > 0) {
  console.log('\n🔍 失败视频详细分析:')
  console.log('=====================================')
  
  for (let i = 0; i < failedVideos.length; i++) {
    const video = failedVideos[i]
    console.log(`\n${i + 1}. ${video.title}`)
    console.log(`   ID: ${video.id}`)
    console.log(`   错误信息: ${video.error_message || '无'}`)
    console.log(`   详细错误: ${video.thumbnail_error_details || '无'}`)
    
    // 测试视频URL的可访问性
    if (video.video_url) {
      try {
        const response = await fetch(video.video_url, { 
          method: 'HEAD', 
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ThumbnailBot/1.0)'
          }
        })
        
        console.log(`   📊 视频可访问性: ${response.status} ${response.ok ? '✅' : '❌'}`)
        
        if (response.ok) {
          const contentType = response.headers.get('content-type')
          const contentLength = response.headers.get('content-length')
          const acceptRanges = response.headers.get('accept-ranges')
          
          console.log(`   📝 内容类型: ${contentType || '未知'}`)
          console.log(`   📏 文件大小: ${contentLength ? (Math.round(parseInt(contentLength) / 1024 / 1024 * 100) / 100) + 'MB' : '未知'}`)
          console.log(`   🎯 支持范围请求: ${acceptRanges || '未知'}`)
          
          // 检查是否是视频格式
          if (!contentType || !contentType.startsWith('video/')) {
            console.log(`   ⚠️  警告: 内容类型不是视频格式`)
          }
        } else {
          console.log(`   ❌ HTTP错误: ${response.status} ${response.statusText}`)
        }
        
      } catch (error) {
        console.log(`   ❌ 网络错误: ${error.message}`)
        
        // 检查是否是CORS错误
        if (error.message.includes('CORS') || error.message.includes('blocked')) {
          console.log(`   🚫 可能的CORS跨域问题`)
        }
        
        // 检查是否是超时错误
        if (error.message.includes('timeout') || error.message.includes('TimeoutError')) {
          console.log(`   ⏰ 可能的超时问题`)
        }
      }
      
      // 分析视频URL模式
      try {
        const url = new URL(video.video_url)
        console.log(`   🌐 视频域名: ${url.hostname}`)
        console.log(`   📍 URL路径: ${url.pathname.substring(0, 50)}...`)
        
        // 检查是否是已知的视频托管服务
        const knownHosts = ['veo3video.me', 'cdn.veo3video.me', 'storage.googleapis.com', 'amazonaws.com']
        const isKnownHost = knownHosts.some(host => url.hostname.includes(host))
        console.log(`   🏠 已知托管服务: ${isKnownHost ? '✅' : '❓'}`)
        
      } catch (urlError) {
        console.log(`   ❌ URL解析错误: ${urlError.message}`)
      }
    } else {
      console.log(`   ❌ 没有视频URL`)
    }
  }
  
  // 统计失败原因
  console.log('\n\n📈 失败原因统计:')
  console.log('=====================================')
  
  const errorMessages = {}
  const domains = {}
  
  failedVideos.forEach(video => {
    // 统计错误信息
    const error = video.error_message || '无错误信息'
    errorMessages[error] = (errorMessages[error] || 0) + 1
    
    // 统计域名
    if (video.video_url) {
      try {
        const domain = new URL(video.video_url).hostname
        domains[domain] = (domains[domain] || 0) + 1
      } catch {}
    }
  })
  
  console.log('🔤 错误信息分布:')
  Object.entries(errorMessages).forEach(([error, count]) => {
    console.log(`  "${error}": ${count}次`)
  })
  
  console.log('\n🌐 失败视频域名分布:')
  Object.entries(domains).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count}个`)
  })
}

// 对比：检查成功的视频
console.log('\n\n✅ 对比：成功视频的特征')
console.log('=====================================')

const { data: successVideos } = await supabase
  .from('videos')
  .select('id, title, video_url, thumbnail_url, created_at')
  .eq('thumbnail_generation_status', 'completed')
  .limit(10)

if (successVideos && successVideos.length > 0) {
  const successDomains = {}
  const thumbnailDomains = {}
  
  successVideos.forEach(video => {
    if (video.video_url) {
      try {
        const domain = new URL(video.video_url).hostname
        successDomains[domain] = (successDomains[domain] || 0) + 1
      } catch {}
    }
    
    if (video.thumbnail_url) {
      try {
        const domain = new URL(video.thumbnail_url).hostname
        thumbnailDomains[domain] = (thumbnailDomains[domain] || 0) + 1
      } catch {}
    }
  })
  
  console.log('🌐 成功视频域名分布:')
  Object.entries(successDomains).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count}个`)
  })
  
  console.log('\n🖼️ 成功缩略图域名分布:')
  Object.entries(thumbnailDomains).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count}个`)
  })
}