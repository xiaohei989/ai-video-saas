// 诊断R2缩略图加载失败的问题
console.log('🔍 诊断R2缩略图加载问题...')

const testUrl = 'https://cdn.veo3video.me/thumbnails/56717878-bb2e-4d67-a3d3-e9a5bf00f79a-v2.png'
console.log('测试URL:', testUrl)

// 1. 基本可访问性测试
console.log('\n📡 Step 1: 基本可访问性测试...')
try {
  const response = await fetch(testUrl, {
    method: 'HEAD',
    headers: {
      'Accept': 'image/*,*/*;q=0.8',
    },
    mode: 'cors'
  })
  
  console.log('HEAD请求结果:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length'),
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'cache-control': response.headers.get('cache-control')
    }
  })
} catch (error) {
  console.error('HEAD请求失败:', error.message)
}

// 2. 完整数据获取测试
console.log('\n📊 Step 2: 完整数据获取测试...')
try {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时
  
  const response = await fetch(testUrl, {
    method: 'GET',
    headers: {
      'Accept': 'image/*,*/*;q=0.8',
      'Cache-Control': 'no-cache'
    },
    signal: controller.signal,
    mode: 'cors',
    credentials: 'omit'
  })
  
  clearTimeout(timeoutId)
  
  console.log('GET请求响应状态:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    type: response.type,
    url: response.url
  })
  
  if (!response.ok) {
    throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`)
  }
  
  const blob = await response.blob()
  console.log('Blob数据:', {
    size: blob.size + ' bytes',
    sizeKB: (blob.size / 1024).toFixed(2) + ' KB',
    type: blob.type,
    isEmpty: blob.size === 0
  })
  
  if (blob.size > 0) {
    console.log('✅ 图片数据获取成功！')
    
    // 测试Base64转换
    console.log('\n🔄 Step 3: Base64转换测试...')
    
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    
    console.log('Base64转换结果:', {
      length: base64.length,
      lengthKB: (base64.length / 1024).toFixed(2) + ' KB',
      startsWithData: base64.startsWith('data:'),
      preview: base64.substring(0, 100) + '...'
    })
    
    console.log('✅ Base64转换成功！')
  } else {
    throw new Error('获取到空的图片数据')
  }
  
} catch (error) {
  console.error('GET请求失败:', {
    name: error.name,
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 3)
  })
  
  // 分析具体失败原因
  console.log('\n🔍 错误分析:')
  if (error.name === 'AbortError') {
    console.log('❌ 请求超时 - 可能是网络延迟问题')
  } else if (error.message.includes('CORS')) {
    console.log('❌ CORS错误 - 可能需要检查CDN配置')
  } else if (error.message.includes('network')) {
    console.log('❌ 网络错误 - 可能是连接问题')
  } else {
    console.log('❌ 其他错误:', error.message)
  }
}

// 3. 简化版本测试（不使用CORS）
console.log('\n🌐 Step 4: 简化版本测试（no-cors模式）...')
try {
  const response = await fetch(testUrl, {
    method: 'GET',
    mode: 'no-cors'
  })
  
  console.log('no-cors请求状态:', {
    status: response.status, // 可能总是0
    type: response.type,
    ok: response.ok
  })
  
  if (response.type === 'opaque') {
    console.log('⚠️ no-cors模式返回opaque响应，无法读取数据')
  }
} catch (error) {
  console.error('no-cors请求也失败:', error.message)
}

console.log('\n🎯 诊断总结:')
console.log('如果Step 1和2都成功，说明图片可以正常获取')
console.log('如果Step 2失败但Step 1成功，说明CORS或获取完整数据时有问题')
console.log('如果都失败，说明URL本身不可访问')