/**
 * CDN连通性测试工具
 * 测试CDN是否可访问，为视频播放提供回退策略
 */

import { getR2PublicDomain, generateR2Url } from '@/config/cdnConfig'

interface ConnectivityTestResult {
  success: boolean
  responseTime: number
  error?: string
  fallbackUrl?: string
}

/**
 * 测试CDN连通性
 * @param testUrl 测试用的URL
 * @param timeout 超时时间（毫秒）
 */
export async function testCdnConnectivity(
  testUrl: string = generateR2Url('templates/videos/animal-skateboarding-street.mp4'),
  timeout: number = 10000
): Promise<ConnectivityTestResult> {
  const startTime = Date.now()
  
  try {
    console.log(`🔍 [CDN Test] 开始连通性测试: ${testUrl}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    const response = await fetch(testUrl, {
      method: 'HEAD', // 只获取响应头，不下载内容
      signal: controller.signal,
      cache: 'no-cache',
      headers: {
        'Range': 'bytes=0-1' // 只请求前2个字节
      }
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    if (response.ok || response.status === 206) { // 200或206都表示成功
      console.log(`✅ [CDN Test] CDN连通性正常: ${responseTime}ms`)
      return {
        success: true,
        responseTime
      }
    } else {
      console.warn(`⚠️ [CDN Test] CDN响应异常: ${response.status} ${response.statusText}`)
      return {
        success: false,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    
  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    
    console.error(`❌ [CDN Test] CDN连通性测试失败: ${errorMessage} (${responseTime}ms)`)
    
    return {
      success: false,
      responseTime,
      error: errorMessage
    }
  }
}

/**
 * 生成回退URL
 * @param originalUrl 原始URL
 */
export function generateFallbackUrl(originalUrl: string): string {
  // 如果是代理URL，转换为直接CDN访问
  if (originalUrl.startsWith('/api/r2/')) {
    return generateR2Url(originalUrl.replace('/api/r2', ''))
  }
  
  // 如果已经是CDN URL，尝试添加缓存破坏参数
  const r2Domain = getR2PublicDomain()
  if (originalUrl.includes(r2Domain)) {
    const separator = originalUrl.includes('?') ? '&' : '?'
    return `${originalUrl}${separator}_t=${Date.now()}`
  }
  
  return originalUrl
}

/**
 * 智能视频URL选择器
 * 根据连通性测试结果选择最佳的视频URL
 * @param originalUrl 原始视频URL
 * @param enableFallback 是否启用回退策略
 */
export async function getOptimalVideoUrl(
  originalUrl: string,
  enableFallback: boolean = true
): Promise<string> {
  // 开发环境默认使用代理
  if (import.meta.env.DEV) {
    const r2Domain = getR2PublicDomain()
    if (originalUrl.includes(r2Domain)) {
      const proxyUrl = originalUrl.replace(`https://${r2Domain}`, '/api/r2')
      
      // 如果启用回退，先测试代理连通性
      if (enableFallback) {
        try {
          const testResult = await testCdnConnectivity(proxyUrl, 5000)
          if (testResult.success) {
            console.log(`🚀 [URL选择] 使用代理URL: ${proxyUrl}`)
            return proxyUrl
          } else {
            console.log(`⚠️ [URL选择] 代理失败，使用直接CDN: ${originalUrl}`)
            return originalUrl
          }
        } catch (error) {
          console.log(`⚠️ [URL选择] 代理测试失败，使用直接CDN: ${originalUrl}`)
          return originalUrl
        }
      }
      
      return proxyUrl
    }
  }
  
  // 生产环境直接使用原始URL
  return originalUrl
}

/**
 * 缓存CDN测试结果
 */
class CdnTestCache {
  private cache = new Map<string, {result: ConnectivityTestResult, timestamp: number}>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

  async getOrTest(url: string): Promise<ConnectivityTestResult> {
    const cached = this.cache.get(url)
    const now = Date.now()
    
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      console.log(`📦 [CDN Test] 使用缓存结果: ${url}`)
      return cached.result
    }
    
    const result = await testCdnConnectivity(url)
    this.cache.set(url, { result, timestamp: now })
    
    // 清理过期缓存
    this.cleanup()
    
    return result
  }
  
  private cleanup() {
    const now = Date.now()
    for (const [url, cached] of this.cache.entries()) {
      if ((now - cached.timestamp) >= this.CACHE_DURATION) {
        this.cache.delete(url)
      }
    }
  }
}

// 导出缓存实例
export const cdnTestCache = new CdnTestCache()