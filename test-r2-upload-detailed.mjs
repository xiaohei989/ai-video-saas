import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// 使用Service Role Key获取更多权限
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)

console.log('🧪 测试R2上传流程详细诊断...')

async function main() {
  try {
    // 先尝试获取一个实际的视频ID
    const { data: videos } = await supabase
      .from('videos')
      .select('id, title, status')
      .order('created_at', { ascending: false })
      .limit(5)

    console.log('📊 找到的视频:', videos?.length || 0)
    if (videos && videos.length > 0) {
      console.log('📹 视频列表:')
      videos.forEach(v => {
        console.log(`  - ${v.title} (${v.id}) [${v.status}]`)
      })
    }

    // 使用第一个视频，如果没有就使用硬编码的测试ID
    const video = videos?.[0] || { 
      id: 'test-thumbnail-' + Date.now(), 
      title: '测试缩略图上传' 
    }

    console.log('📹 使用测试视频:', video.title, '(ID:', video.id, ')')

    // 1. 测试获取预签名URL
    console.log('\n🔗 1. 测试获取预签名URL...')
    
    const uploadResponse = await fetch(`${SUPABASE_URL}/functions/v1/upload-thumbnail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        videoId: video.id,
        contentType: 'image/webp',
        fileSize: 5000
      })
    })
    
    console.log('📊 获取预签名URL响应状态:', uploadResponse.status)
    console.log('📊 响应头:')
    for (const [key, value] of uploadResponse.headers.entries()) {
      console.log(`  ${key}: ${value}`)
    }
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.log('❌ 获取预签名URL失败:', errorText)
      return
    }
    
    const responseData = await uploadResponse.json()
    console.log('✅ 预签名URL获取成功')
    console.log('🔑 签名URL长度:', responseData.data.signedUrl.length)
    console.log('🔑 签名URL域名:', new URL(responseData.data.signedUrl).hostname)
    console.log('🌐 公开URL:', responseData.data.publicUrl)
    
    // 2. 创建测试图片数据
    console.log('\n🖼️ 2. 创建测试图片数据...')
    
    // 创建一个简单的WebP格式图片数据（1x1像素的透明图片）
    const testImageBase64 = 'UklGRkIAAABXRUJQVlA4IDYAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v89WAAAAA=='
    const testImageBuffer = Buffer.from(testImageBase64, 'base64')
    
    console.log('📏 测试图片大小:', testImageBuffer.length, '字节')
    console.log('📝 测试图片类型: image/webp')
    
    // 3. 测试上传到预签名URL
    console.log('\n📤 3. 测试上传到预签名URL...')
    console.log('🔗 上传URL:', responseData.data.signedUrl.substring(0, 100) + '...')
    
    const uploadStartTime = Date.now()
    
    try {
      const uploadResult = await fetch(responseData.data.signedUrl, {
        method: 'PUT',
        body: testImageBuffer,
        headers: {
          'Content-Type': 'image/webp',
        }
      })
      
      const uploadEndTime = Date.now()
      
      console.log('📊 上传响应状态:', uploadResult.status)
      console.log('⏱️ 上传耗时:', uploadEndTime - uploadStartTime, 'ms')
      console.log('📊 上传响应头:')
      for (const [key, value] of uploadResult.headers.entries()) {
        console.log(`  ${key}: ${value}`)
      }
      
      if (!uploadResult.ok) {
        const errorText = await uploadResult.text()
        console.log('❌ 上传失败响应内容:', errorText)
        
        // 如果是CORS错误，尝试简化的请求
        if (uploadResult.status === 0 || uploadResult.status === 500) {
          console.log('\n🔄 尝试简化的请求（可能是CORS问题）...')
          
          try {
            const simpleUpload = await fetch(responseData.data.signedUrl, {
              method: 'PUT',
              body: testImageBuffer,
              mode: 'cors'
            })
            
            console.log('📊 简化请求状态:', simpleUpload.status)
          } catch (corsError) {
            console.log('❌ CORS错误确认:', corsError.message)
          }
        }
        
      } else {
        console.log('✅ 上传成功!')
        
        // 4. 测试访问上传的文件
        console.log('\n🌐 4. 测试访问上传的文件...')
        
        // 等待一下让文件传播
        console.log('⏳ 等待2秒让文件传播...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        const accessTest = await fetch(responseData.data.publicUrl, {
          method: 'HEAD'
        })
        
        console.log('📊 文件访问状态:', accessTest.status)
        
        if (accessTest.ok) {
          console.log('✅ 文件可以正常访问!')
          console.log('📏 文件大小:', accessTest.headers.get('content-length'))
          console.log('📝 内容类型:', accessTest.headers.get('content-type'))
        } else {
          console.log('❌ 文件无法访问')
          console.log('🔍 访问错误头信息:')
          for (const [key, value] of accessTest.headers.entries()) {
            console.log(`  ${key}: ${value}`)
          }
        }
      }
      
    } catch (fetchError) {
      console.log('❌ 网络请求失败:', fetchError.message)
      console.log('🔍 错误类型:', fetchError.name)
      console.log('🔍 错误详情:', fetchError)
      
      // 检查是否是网络连接问题
      console.log('\n🌐 测试基本网络连接...')
      try {
        const pingTest = await fetch('https://httpbin.org/status/200', { method: 'HEAD' })
        console.log('✅ 基本网络连接正常，状态:', pingTest.status)
      } catch (pingError) {
        console.log('❌ 基本网络连接失败:', pingError.message)
      }
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error.message)
    console.error('🔍 错误详情:', error)
  }
}

main()