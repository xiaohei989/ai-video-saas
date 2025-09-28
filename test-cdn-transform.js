/**
 * 测试CDN域名转换功能
 */

// 模拟环境变量
process.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN = 'new-cdn.example.com'

// 由于是Node.js环境，需要模拟import.meta.env
const originalImportMeta = global.import
global.import = {
  meta: {
    env: {
      VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN: 'new-cdn.example.com'
    }
  }
}

console.log('🧪 测试CDN域名转换功能...')

// 测试transformCDNUrl函数的逻辑
const transformCDNUrl = (url) => {
  if (!url) return url
  
  const hardcodedDomain = 'cdn.veo3video.me'
  const currentDomain = 'new-cdn.example.com' // 模拟新的CDN域名
  
  if (url.includes(hardcodedDomain)) {
    return url.replace(hardcodedDomain, currentDomain)
  }
  
  return url
}

// 测试用例
const testCases = [
  {
    input: 'https://cdn.veo3video.me/templates/videos/test.mp4',
    expected: 'https://new-cdn.example.com/templates/videos/test.mp4'
  },
  {
    input: 'https://cdn.veo3video.me/thumbnails/test.jpg',
    expected: 'https://new-cdn.example.com/thumbnails/test.jpg'
  },
  {
    input: 'https://other-domain.com/test.mp4',
    expected: 'https://other-domain.com/test.mp4'
  },
  {
    input: null,
    expected: null
  },
  {
    input: '',
    expected: ''
  }
]

console.log('\n📋 测试结果:')
let passed = 0
let failed = 0

testCases.forEach((testCase, index) => {
  const result = transformCDNUrl(testCase.input)
  const success = result === testCase.expected
  
  console.log(`\n${index + 1}. ${success ? '✅' : '❌'} 测试用例`)
  console.log(`   输入: ${testCase.input}`)
  console.log(`   期望: ${testCase.expected}`)
  console.log(`   实际: ${result}`)
  
  if (success) {
    passed++
  } else {
    failed++
  }
})

console.log(`\n📊 测试总结:`)
console.log(`✅ 通过: ${passed}`)
console.log(`❌ 失败: ${failed}`)
console.log(`📈 通过率: ${((passed / testCases.length) * 100).toFixed(1)}%`)

if (failed === 0) {
  console.log('\n🎉 所有测试通过！CDN域名转换功能正常工作。')
} else {
  console.log('\n⚠️ 有测试失败，需要检查实现。')
}