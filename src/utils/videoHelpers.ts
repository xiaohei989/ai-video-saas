/**
 * 视频相关工具函数
 * 包含设备检测、自动缩略图填充等功能
 */

import { autoThumbnailService } from '@/services/AutoThumbnailService'
import type { DeviceType } from '@/types/video.types'

/**
 * 检测设备类型
 */
export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop'

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    ? 'mobile'
    : 'desktop'
}

/**
 * 检测是否为低性能设备
 */
export function isLowPerformanceDevice(): boolean {
  if (typeof navigator === 'undefined') return false

  // CPU核心数少于等于4的设备认为是低性能设备
  return navigator.hardwareConcurrency <= 4
}

/**
 * 获取最佳页面大小（根据设备类型）
 */
export function getOptimalPageSize(): number {
  if (typeof window === 'undefined') return 12

  const viewportWidth = window.innerWidth
  if (viewportWidth < 640) return 6      // 手机：6个视频
  if (viewportWidth < 1024) return 9     // 平板：9个视频
  return 12                              // 桌面：12个视频
}

/**
 * 获取快速加载页面大小
 */
export function getQuickLoadPageSize(): number {
  const deviceType = getDeviceType()
  return deviceType === 'mobile' ? 6 : 9
}

/**
 * 获取更新间隔（根据设备性能）
 */
export function getUpdateInterval(): number {
  const deviceType = getDeviceType()
  const isLowPerformance = isLowPerformanceDevice()

  // 根据设备性能调整更新频率：移动端10秒，低性能设备8秒，正常设备5秒
  if (deviceType === 'mobile') return 10000
  if (isLowPerformance) return 8000
  return 5000
}

/**
 * 自动补充缺失的缩略图
 */
export async function triggerAutoThumbnailFill(userId: string): Promise<void> {
  try {

    // 调用自动缩略图服务
    const result = await autoThumbnailService.autoFillMissingThumbnails(userId)


    if (result.failed > 0) {
    }
  } catch (error) {
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化缓存大小信息
 */
export function formatCacheSize(size: number): { bytes: number; kb: string; mb: string } {
  return {
    bytes: size,
    kb: (size / 1024).toFixed(2) + 'KB',
    mb: (size / (1024 * 1024)).toFixed(2) + 'MB'
  }
}

/**
 * 检查页面可见性
 */
export function isPageVisible(): boolean {
  if (typeof document === 'undefined') return true
  return !document.hidden
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout | null = null
  let previous = 0

  return ((...args: Parameters<T>) => {
    const now = Date.now()
    const remaining = wait - (now - previous)

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      return func.apply(null, args)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now()
        timeout = null
        return func.apply(null, args)
      }, remaining)
    }
  }) as T
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout | null = null

  return ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      func.apply(null, args)
    }, wait)
  }) as T
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries: number
    delay: number
    exponentialBackoff?: boolean
  }
): Promise<T> {
  const { retries, delay, exponentialBackoff = false } = options

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries) {
        throw error
      }

      const waitTime = exponentialBackoff ? delay * Math.pow(2, i) : delay
      await sleep(waitTime)
    }
  }

  throw new Error('Retry failed')
}

/**
 * 安全的JSON解析
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json)
  } catch {
    return defaultValue
  }
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15)
}

/**
 * 检查是否为有效的URL
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}

/**
 * 提取视频ID（从URL或其他来源）
 */
export function extractVideoId(input: string): string | null {
  // 如果已经是ID格式，直接返回
  if (input.match(/^[a-f0-9-]{36}$/)) {
    return input
  }

  // 尝试从URL中提取
  try {
    const url = new URL(input)
    const pathSegments = url.pathname.split('/')

    // 查找UUID格式的段
    for (const segment of pathSegments) {
      if (segment.match(/^[a-f0-9-]{36}$/)) {
        return segment
      }
    }
  } catch {
    // 不是有效URL，继续其他尝试
  }

  return null
}

/**
 * 清理缓存键
 */
export function sanitizeCacheKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9-_]/g, '_')
}

/**
 * 计算字符串哈希
 */
export function hashString(str: string): number {
  let hash = 0
  if (str.length === 0) return hash

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }

  return hash
}

/**
 * 检查是否支持Web Workers
 */
export function supportsWebWorkers(): boolean {
  return typeof Worker !== 'undefined'
}

/**
 * 检查是否支持IndexedDB
 */
export function supportsIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined'
}

/**
 * 检查是否支持Service Workers
 */
export function supportsServiceWorkers(): boolean {
  return 'serviceWorker' in navigator
}

/**
 * 获取浏览器信息
 */
export function getBrowserInfo(): {
  name: string
  version: string
  engine: string
} {
  const userAgent = navigator.userAgent

  let name = 'Unknown'
  let version = 'Unknown'
  let engine = 'Unknown'

  if (userAgent.includes('Chrome')) {
    name = 'Chrome'
    engine = 'Blink'
    const match = userAgent.match(/Chrome\/(\d+)/)
    if (match) version = match[1]
  } else if (userAgent.includes('Firefox')) {
    name = 'Firefox'
    engine = 'Gecko'
    const match = userAgent.match(/Firefox\/(\d+)/)
    if (match) version = match[1]
  } else if (userAgent.includes('Safari')) {
    name = 'Safari'
    engine = 'WebKit'
    const match = userAgent.match(/Version\/(\d+)/)
    if (match) version = match[1]
  }

  return { name, version, engine }
}