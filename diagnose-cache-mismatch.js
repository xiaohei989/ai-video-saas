/**
 * 诊断缓存不匹配问题
 * 找出为什么日志显示缓存命中但统计显示0KB的原因
 */

console.log('🔍 开始诊断缓存不匹配问题...\n')

// 1. 检查所有localStorage键
console.log('📦 localStorage中的所有键:')
const allKeys = []
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  allKeys.push(key)
}
console.log(`总共 ${allKeys.length} 个键`)

// 2. 按前缀分类
const keysByPrefix = {}
allKeys.forEach(key => {
  const prefix = key.split('_')[0] + '_'
  if (!keysByPrefix[prefix]) {
    keysByPrefix[prefix] = []
  }
  keysByPrefix[prefix].push(key)
})

console.log('\n📊 按前缀分类:')
Object.entries(keysByPrefix).forEach(([prefix, keys]) => {
  console.log(`  ${prefix}: ${keys.length} 个键`)
})

// 3. 专门检查图片缓存
console.log('\n🖼️ 图片缓存分析:')
const imageCacheKeys = allKeys.filter(key => key.startsWith('cached_img_'))
console.log(`  cached_img_ 前缀: ${imageCacheKeys.length} 个键`)

if (imageCacheKeys.length > 0) {
  // 分析第一个缓存项
  const firstKey = imageCacheKeys[0]
  const firstValue = localStorage.getItem(firstKey)
  
  try {
    const data = JSON.parse(firstValue)
    console.log(`\n  示例缓存项 (${firstKey}):`)
    console.log(`    - timestamp: ${new Date(data.timestamp).toLocaleString('zh-CN')}`)
    console.log(`    - size: ${data.size}KB`)
    console.log(`    - dimensions: ${data.dimensions}`)
    console.log(`    - deviceType: ${data.deviceType}`)
    console.log(`    - quality: ${data.quality}`)
    console.log(`    - processTime: ${data.processTime}ms`)
    console.log(`    - base64长度: ${data.base64 ? data.base64.length : 0}`)
  } catch (e) {
    console.log('  ❌ 无法解析缓存数据:', e.message)
  }
  
  // 计算总大小
  let totalSize = 0
  imageCacheKeys.forEach(key => {
    try {
      const value = localStorage.getItem(key)
      const data = JSON.parse(value)
      totalSize += (data.size || 0)
    } catch (e) {
      // 忽略解析错误
    }
  })
  
  console.log(`\n  💾 图片缓存总大小: ${totalSize.toFixed(1)}KB`)
} else {
  console.log('  ⚠️ 没有找到以 cached_img_ 开头的缓存项')
}

// 4. 检查可能的其他图片缓存格式
console.log('\n🔎 查找可能的图片缓存 (包含base64数据):')
let suspectedImageCaches = 0
let suspectedImageSize = 0

allKeys.forEach(key => {
  try {
    const value = localStorage.getItem(key)
    // 检查是否包含base64图片数据
    if (value && value.includes('data:image/')) {
      suspectedImageCaches++
      
      // 尝试解析JSON
      try {
        const data = JSON.parse(value)
        if (data.base64 && data.base64.startsWith('data:image/')) {
          console.log(`  ✅ 发现图片缓存: ${key}`)
          suspectedImageSize += (data.size || (value.length * 0.75 / 1024))
        }
      } catch {
        // 可能不是JSON格式，直接检查
        if (value.startsWith('data:image/')) {
          console.log(`  ✅ 发现直接存储的图片: ${key}`)
          suspectedImageSize += (value.length * 0.75 / 1024)
        }
      }
    }
  } catch (e) {
    // 忽略错误
  }
})

console.log(`  发现 ${suspectedImageCaches} 个疑似图片缓存`)
console.log(`  疑似图片缓存总大小: ${suspectedImageSize.toFixed(1)}KB`)

// 5. 检查缩略图缓存
console.log('\n🖼️ 缩略图缓存分析:')
const thumbKeys = allKeys.filter(key => key.includes('thumb') || key.includes('thumbnail'))
console.log(`  包含thumb的键: ${thumbKeys.length} 个`)
if (thumbKeys.length > 0) {
  console.log('  示例键:')
  thumbKeys.slice(0, 3).forEach(key => {
    console.log(`    - ${key}`)
  })
}

// 6. 模拟cacheStatsService的逻辑
console.log('\n📈 模拟cacheStatsService逻辑:')
const CACHE_PREFIXES = [
  'veo3_video_cache_',
  'cached_img_',
  'template_cache_',
  'template:',
  'user:',
  'video:',
  'stats:',
  'thumb:',
  'sub:',
  'credits:'
]

const IMAGE_CACHE_PREFIXES = [
  'cached_img_',
  'thumb:'
]

let imageTotalSize = 0
let imageTotalItems = 0
const imageFoundPrefixes = new Set()

for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (!key) continue

  const item = localStorage.getItem(key)
  if (!item) continue
  
  const itemSize = item.length * 2 // UTF-16字符估算

  // 检查是否是图片缓存
  const matchedImagePrefix = IMAGE_CACHE_PREFIXES.find(prefix => key.startsWith(prefix))
  if (matchedImagePrefix) {
    imageTotalSize += itemSize
    imageTotalItems++
    imageFoundPrefixes.add(matchedImagePrefix)
    console.log(`  ✓ 匹配到图片缓存: ${key} (${(itemSize/1024).toFixed(1)}KB)`)
  }
}

console.log(`\n  📊 统计结果:`)
console.log(`    - 图片缓存项: ${imageTotalItems} 个`)
console.log(`    - 图片缓存大小: ${(imageTotalSize/1024).toFixed(1)}KB`)
console.log(`    - 找到的前缀: ${Array.from(imageFoundPrefixes).join(', ') || '无'}`)

// 7. 建议
console.log('\n💡 诊断结果:')
if (imageTotalItems === 0 && suspectedImageCaches > 0) {
  console.log('❗ 问题: 存在图片缓存但键名不匹配预期的前缀格式')
  console.log('   建议: 检查CachedImage.tsx中getCacheKey函数生成的键名格式')
} else if (imageTotalItems > 0) {
  console.log('✅ 缓存键名格式正确，统计服务应该能检测到')
  console.log('   可能是统计服务的计算逻辑问题')
} else {
  console.log('⚠️ 没有检测到任何图片缓存')
  console.log('   建议: 检查图片缓存是否正常工作')
}

// 8. 实时测试getCacheKey函数逻辑
console.log('\n🧪 测试getCacheKey逻辑:')
const testUrl = 'https://cdn.veo3video.me/templates/thumbnails/animal-skateboarding-street-thumbnail.jpg'
const cacheKey = `cached_img_${btoa(testUrl).slice(0, 20)}`
console.log(`  测试URL: ${testUrl}`)
console.log(`  生成的键: ${cacheKey}`)
console.log(`  是否存在: ${localStorage.getItem(cacheKey) ? '✅ 存在' : '❌ 不存在'}`)

// 导出诊断结果供进一步分析
window.cacheDignosisResult = {
  totalKeys: allKeys.length,
  imageCacheKeys: imageCacheKeys.length,
  suspectedImageCaches,
  imageTotalSize,
  imageTotalItems,
  keysByPrefix
}

console.log('\n✅ 诊断完成！结果已保存到 window.cacheDignosisResult')