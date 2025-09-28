// 直接测试getImageAsBase64函数，模拟浏览器环境
console.log('🔍 测试getImageAsBase64函数中的错误回退逻辑...')

const testUrl = 'https://cdn.veo3video.me/thumbnails/56717878-bb2e-4d67-a3d3-e9a5bf00f79a-v2.png'

// 模拟getImageAsBase64函数的主要逻辑
async function simulateGetImageAsBase64(url) {
    try {
        console.log(`[NewImageCache] 📡 获取图片数据:`, url.substring(0, 60) + '...')
        
        // 检查网络状态
        if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
            throw new Error('网络离线状态')
        }
        
        // 创建带超时的fetch请求
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时
        
        const response = await fetch(url, {
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
        
        // 响应状态检查
        console.log(`[NewImageCache] 📊 响应状态:`, {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
        })
        
        if (!response.ok) {
            throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`)
        }
        
        const blob = await response.blob()
        
        // 验证blob数据
        if (!blob || blob.size === 0) {
            throw new Error('获取到空的图片数据')
        }
        
        // 在Node.js中模拟FileReader
        console.log('[NewImageCache] 🔄 模拟Base64转换...')
        console.log('[NewImageCache] ⚠️ Node.js环境无法进行真实的FileReader转换')
        console.log('[NewImageCache] ✅ 假设Base64转换成功，返回模拟数据')
        
        const sizeKB = blob.size / 1024
        console.log('[NewImageCache] ✅ 图片数据获取成功:', {
            originalSize: `${sizeKB.toFixed(2)}KB`,
            mimeType: blob.type,
            quality: sizeKB > 50 ? '✅ 高质量' : sizeKB > 20 ? '🟡 中等质量' : '⚠️ 低质量'
        })
        
        // 返回模拟的Base64数据
        return `data:${blob.type};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`
        
    } catch (error) {
        const errorType = error instanceof Error ? error.name : 'UnknownError'
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        console.error(`[NewImageCache] ❌ 获取图片失败:`, {
            url: url.substring(0, 60) + '...',
            errorType,
            errorMessage
        })
        
        // 🚨 这里是问题所在：尝试视频截图回退
        console.log('[NewImageCache] 🔄 尝试视频截图回退机制...')
        console.log('[NewImageCache] ❌ 关键问题：将图片URL当作视频URL处理！')
        console.log('[NewImageCache] 💡 图片URL不是视频，不应该进入视频截图逻辑')
        
        // 之前的tryVideoScreenshot函数已被删除
        console.log('[NewImageCache] ❌ 视频截图回退已移除（图片URL不应被当作视频处理）')
        
        // 🎨 最终回退：SVG占位符
        console.log('[NewImageCache] 🎨 使用SVG占位符作为最终回退')
        return generateSVGPlaceholder(url)
    }
}

// 模拟SVG占位符生成
function generateSVGPlaceholder(url) {
    const svg = `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
            <rect width="960" height="540" fill="#f0f0f0"/>
            <text x="480" y="280" text-anchor="middle" fill="#666" font-size="16">
                缩略图加载失败
            </text>
        </svg>
    `)}`
    
    console.log('[NewImageCache] 🎨 生成SVG占位符:', svg.substring(0, 100) + '...')
    return svg
}

// 模拟在正常情况下的调用
console.log('\n🧪 Test 1: 正常情况（应该成功）')
try {
    const result1 = await simulateGetImageAsBase64(testUrl)
    console.log('✅ 结果:', result1.startsWith('data:image/svg+xml') ? '❌ 返回了SVG占位符' : '✅ 成功获取图片数据')
} catch (error) {
    console.log('❌ 异常:', error.message)
}

// 模拟在出错情况下的调用
console.log('\n🧪 Test 2: 模拟网络错误（应该触发错误的回退逻辑）')
async function simulateErrorCase() {
    try {
        throw new Error('模拟网络错误')
    } catch (error) {
        console.log('[NewImageCache] ❌ 模拟错误触发')
        console.log('[NewImageCache] 🔄 尝试视频截图回退机制...')
        console.log('[NewImageCache] 💥 问题根源：图片URL被误认为视频URL！')
        console.log(`[NewImageCache] 🎯 真正的问题：${testUrl} 是PNG图片，不是视频文件`)
        console.log('[NewImageCache] ❌ 视频截图必然失败，因为URL指向的是图片文件')
        console.log('[NewImageCache] 🎨 最终降级到SVG占位符')
        
        return generateSVGPlaceholder(testUrl)
    }
}

const result2 = await simulateErrorCase()
console.log('❌ 错误情况结果:', result2.startsWith('data:image/svg+xml') ? '🎯 确实返回了SVG占位符' : '意外结果')

console.log('\n📝 问题总结:')
console.log('1. getImageAsBase64函数在任何错误时都会尝试"视频截图"回退')
console.log('2. 但输入的是图片URL，不是视频URL')
console.log('3. 视频截图必然失败，最终返回SVG占位符')
console.log('4. 这解释了为什么远程图片存在但仍显示SVG占位符')
console.log('\n💡 解决方案:')
console.log('1. 移除错误的视频截图回退逻辑')
console.log('2. 对于图片加载失败，应该直接返回原URL或进行适当的重试')
console.log('3. 只有在确实是视频缩略图生成的场景才使用视频截图')