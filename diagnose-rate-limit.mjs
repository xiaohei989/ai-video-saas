// 限流诊断脚本
console.log('🔍 限流系统诊断...')

// 模拟前端限流逻辑
class RateLimiter {
  constructor() {
    this.requests = new Map()
    this.blocked = new Map()
  }

  canMakeRequest(key, maxRequests, windowMs) {
    const now = Date.now()
    
    // 检查是否在阻塞期
    const blockUntil = this.blocked.get(key)
    if (blockUntil && now < blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockUntil,
        retryAfter: Math.ceil((blockUntil - now) / 1000),
        reason: 'blocked'
      }
    }

    // 获取当前窗口内的请求
    const requests = this.requests.get(key) || []
    const windowStart = now - windowMs
    
    // 清理过期请求
    const validRequests = requests.filter(time => time > windowStart)
    
    // 检查是否超过限制
    if (validRequests.length >= maxRequests) {
      // 计算下次重置时间
      const oldestRequest = Math.min(...validRequests)
      const resetTime = oldestRequest + windowMs
      
      // 如果频繁超限，临时阻塞
      if (validRequests.length > maxRequests * 1.5) {
        this.blocked.set(key, now + windowMs)
        console.log(`⚠️  触发临时阻塞: ${validRequests.length} > ${maxRequests * 1.5}`)
      }
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
        reason: 'rate_limited',
        currentRequests: validRequests.length
      }
    }

    return {
      allowed: true,
      remaining: maxRequests - validRequests.length,
      resetTime: Math.min(...validRequests) + windowMs,
      currentRequests: validRequests.length
    }
  }

  // 模拟添加历史请求（用于测试）
  simulateRequests(key, count, timeSpread = 3600000) {
    const now = Date.now()
    const requests = []
    
    for (let i = 0; i < count; i++) {
      // 在指定时间范围内随机分布请求
      const timeOffset = Math.random() * timeSpread
      requests.push(now - timeOffset)
    }
    
    this.requests.set(key, requests.sort((a, b) => a - b))
    console.log(`📝 模拟添加 ${count} 个历史请求`)
  }

  getStatus(key) {
    const requests = this.requests.get(key) || []
    const blocked = this.blocked.get(key)
    const now = Date.now()
    
    return {
      totalRequests: requests.length,
      validRequests: requests.filter(time => time > now - 3600000).length,
      isBlocked: blocked && now < blocked,
      blockUntil: blocked ? new Date(blocked).toLocaleString('zh-CN') : null
    }
  }
}

// 测试场景
const limiter = new RateLimiter()
const maxRequests = 100
const windowMs = 3600000 // 1小时

console.log('\n🧪 测试场景 1: 正常用户（无历史请求）')
const normalUserKey = 'user_8242424d-957c-4755-af2f-5e809cfa23f7:VIDEO_GENERATION'
const result1 = limiter.canMakeRequest(normalUserKey, maxRequests, windowMs)
console.log('结果:', result1)

console.log('\n🧪 测试场景 2: 被污染的用户数据（历史请求过多）')
const pollutedUserKey = 'user_fa38674f-1e5b-4132-9fb7-192940e52a32:VIDEO_GENERATION'
// 模拟污染：添加大量历史请求
limiter.simulateRequests(pollutedUserKey, 120, 3600000) // 1小时内120次请求
const result2 = limiter.canMakeRequest(pollutedUserKey, maxRequests, windowMs)
console.log('结果:', result2)
console.log('状态:', limiter.getStatus(pollutedUserKey))

console.log('\n🧪 测试场景 3: 匿名用户标识污染')
const anonKey = 'anon_shared_session:VIDEO_GENERATION'
limiter.simulateRequests(anonKey, 150, 3600000) // 1小时内150次请求，触发阻塞
const result3 = limiter.canMakeRequest(anonKey, maxRequests, windowMs)
console.log('结果:', result3)
console.log('状态:', limiter.getStatus(anonKey))

console.log('\n🔧 解决方案建议:')
console.log('1. 检查浏览器 localStorage/sessionStorage 中的限流数据')
console.log('2. 清除用户浏览器的限流历史记录')
console.log('3. 确保用户标识符的唯一性和正确性')
console.log('4. 考虑降低限流阈值检测的严格程度')

console.log('\n💡 临时解决方案:')
console.log('- 用户清除浏览器缓存和存储数据')
console.log('- 使用隐私模式/无痕模式测试')
console.log('- 开发者手动重置用户的限流状态')