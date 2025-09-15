/**
 * LRU缓存实现 - 针对移动端优化的内存管理
 */

import { log } from '@/utils/logger'

interface CacheItem<T> {
  key: string
  value: T
  prev: CacheItem<T> | null
  next: CacheItem<T> | null
  timestamp: number
  size: number // 估算的内存大小（字节）
}

export interface LRUCacheOptions {
  maxSize: number // 最大缓存项数量
  maxMemory?: number // 最大内存使用量（字节），可选
  ttl?: number // 生存时间（毫秒），可选
  onEvict?: (key: string, value: any) => void // 驱逐回调
}

export class LRUCache<T> {
  private capacity: number
  private maxMemory?: number
  private ttl?: number
  private onEvict?: (key: string, value: T) => void
  
  private cache = new Map<string, CacheItem<T>>()
  private head: CacheItem<T> | null = null
  private tail: CacheItem<T> | null = null
  private currentMemoryUsage = 0
  
  // 性能统计
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryEvictions: 0,
    timeEvictions: 0
  }

  constructor(options: LRUCacheOptions) {
    this.capacity = Math.max(1, options.maxSize)
    this.maxMemory = options.maxMemory
    this.ttl = options.ttl
    this.onEvict = options.onEvict

    log.debug('LRU缓存初始化', {
      maxSize: this.capacity,
      maxMemory: this.maxMemory,
      ttl: this.ttl
    })

    // 定期清理过期项
    if (this.ttl) {
      setInterval(() => this.cleanExpiredItems(), Math.min(this.ttl / 2, 60000))
    }
  }

  /**
   * 获取缓存项
   */
  get(key: string): T | undefined {
    const item = this.cache.get(key)
    
    if (!item) {
      this.stats.misses++
      return undefined
    }

    // 检查TTL
    if (this.ttl && Date.now() - item.timestamp > this.ttl) {
      this.delete(key)
      this.stats.misses++
      this.stats.timeEvictions++
      return undefined
    }

    // 移动到头部（最近使用）
    this.moveToHead(item)
    this.stats.hits++
    
    return item.value
  }

  /**
   * 设置缓存项
   */
  set(key: string, value: T, estimatedSize?: number): void {
    const existingItem = this.cache.get(key)
    const itemSize = estimatedSize || this.estimateSize(value)

    if (existingItem) {
      // 更新现有项
      this.currentMemoryUsage -= existingItem.size
      existingItem.value = value
      existingItem.timestamp = Date.now()
      existingItem.size = itemSize
      this.currentMemoryUsage += itemSize
      this.moveToHead(existingItem)
      return
    }

    // 创建新项
    const newItem: CacheItem<T> = {
      key,
      value,
      prev: null,
      next: null,
      timestamp: Date.now(),
      size: itemSize
    }

    // 检查内存限制
    if (this.maxMemory && this.currentMemoryUsage + itemSize > this.maxMemory) {
      this.evictByMemory(itemSize)
    }

    // 检查数量限制
    if (this.cache.size >= this.capacity) {
      this.evictLRU()
    }

    // 添加新项
    this.cache.set(key, newItem)
    this.currentMemoryUsage += itemSize
    this.addToHead(newItem)
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return false

    this.cache.delete(key)
    this.currentMemoryUsage -= item.size
    this.removeNode(item)
    
    if (this.onEvict) {
      this.onEvict(key, item.value)
    }

    return true
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return false

    // 检查TTL
    if (this.ttl && Date.now() - item.timestamp > this.ttl) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * 清空缓存
   */
  clear(): void {
    if (this.onEvict) {
      for (const [key, item] of this.cache) {
        this.onEvict(key, item.value)
      }
    }

    this.cache.clear()
    this.head = null
    this.tail = null
    this.currentMemoryUsage = 0

    log.debug('LRU缓存已清空')
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size
  }

  /**
   * 获取内存使用量
   */
  memoryUsage(): number {
    return this.currentMemoryUsage
  }

  /**
   * 获取缓存键列表
   */
  keys(): string[] {
    const keys: string[] = []
    let current = this.head
    while (current) {
      keys.push(current.key)
      current = current.next
    }
    return keys
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    size: number
    capacity: number
    memoryUsage: number
    maxMemory?: number
    hitRate: number
    hits: number
    misses: number
    evictions: number
    memoryEvictions: number
    timeEvictions: number
  } {
    const total = this.stats.hits + this.stats.misses
    return {
      size: this.cache.size,
      capacity: this.capacity,
      memoryUsage: this.currentMemoryUsage,
      maxMemory: this.maxMemory,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      memoryEvictions: this.stats.memoryEvictions,
      timeEvictions: this.stats.timeEvictions
    }
  }

  /**
   * 移动节点到头部
   */
  private moveToHead(item: CacheItem<T>): void {
    this.removeNode(item)
    this.addToHead(item)
  }

  /**
   * 添加节点到头部
   */
  private addToHead(item: CacheItem<T>): void {
    item.prev = null
    item.next = this.head

    if (this.head) {
      this.head.prev = item
    }
    this.head = item

    if (!this.tail) {
      this.tail = item
    }
  }

  /**
   * 移除节点
   */
  private removeNode(item: CacheItem<T>): void {
    if (item.prev) {
      item.prev.next = item.next
    } else {
      this.head = item.next
    }

    if (item.next) {
      item.next.prev = item.prev
    } else {
      this.tail = item.prev
    }
  }

  /**
   * 驱逐最久未使用的项
   */
  private evictLRU(): void {
    if (!this.tail) return

    const evictedKey = this.tail.key
    const evictedValue = this.tail.value
    
    this.cache.delete(evictedKey)
    this.currentMemoryUsage -= this.tail.size
    this.removeNode(this.tail)
    
    this.stats.evictions++

    if (this.onEvict) {
      this.onEvict(evictedKey, evictedValue)
    }

    log.debug('LRU缓存驱逐项', { key: evictedKey })
  }

  /**
   * 按内存使用量驱逐项
   */
  private evictByMemory(requiredSpace: number): void {
    let freedSpace = 0
    
    while (this.tail && freedSpace < requiredSpace) {
      const evictedKey = this.tail.key
      const evictedValue = this.tail.value
      const evictedSize = this.tail.size
      
      this.cache.delete(evictedKey)
      this.currentMemoryUsage -= evictedSize
      this.removeNode(this.tail)
      
      freedSpace += evictedSize
      this.stats.memoryEvictions++

      if (this.onEvict) {
        this.onEvict(evictedKey, evictedValue)
      }
    }

    log.debug('内存驱逐释放空间', { freedSpace, requiredSpace })
  }

  /**
   * 清理过期项
   */
  private cleanExpiredItems(): void {
    if (!this.ttl) return

    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, item] of this.cache) {
      if (now - item.timestamp > this.ttl) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.delete(key)
      this.stats.timeEvictions++
    }

    if (expiredKeys.length > 0) {
      log.debug('清理过期缓存项', { count: expiredKeys.length })
    }
  }

  /**
   * 估算值的内存大小
   */
  private estimateSize(value: T): number {
    if (typeof value === 'string') {
      return value.length * 2 // Unicode字符大约2字节
    } else if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2
      } catch {
        return 1024 // 默认1KB
      }
    } else {
      return 64 // 其他类型默认64字节
    }
  }
}

/**
 * 创建适用于移动端的LRU缓存配置
 */
export function createMobileLRUCache<T>(
  baseOptions: Partial<LRUCacheOptions> = {}
): LRUCache<T> {
  // 检测设备类型
  const isMobile = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  
  // 检测内存情况
  const memoryInfo = (performance as any).memory
  const estimatedTotalMemory = memoryInfo ? memoryInfo.jsMemoryLimit : 100 * 1024 * 1024 // 100MB default

  // 移动端配置
  const mobileConfig: LRUCacheOptions = {
    maxSize: isMobile ? 20 : 50, // 移动端减少缓存项数量
    maxMemory: isMobile ? 
      Math.min(10 * 1024 * 1024, estimatedTotalMemory * 0.1) : // 移动端最多10MB或总内存的10%
      Math.min(50 * 1024 * 1024, estimatedTotalMemory * 0.2),  // 桌面端最多50MB或总内存的20%
    ttl: 30 * 60 * 1000, // 30分钟过期
    ...baseOptions
  }

  return new LRUCache<T>(mobileConfig)
}