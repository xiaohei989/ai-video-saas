/**
 * 模板缓存服务 - 优化模板页面加载性能
 * 提供多层缓存：内存缓存 + 统一缓存系统(IndexedDB)，避免重复API请求
 */

import type { TemplateListItem, TemplateListParams, TemplateListResponse } from './templatesApiService'
import { unifiedCache } from './UnifiedCacheService'

export interface CacheOptions {
  maxAge?: number        // 缓存最大有效期（毫秒）
  maxItems?: number      // 最大缓存项数
}

export interface CachedTemplateData {
  templates: TemplateListItem[]
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
  timestamp: number
  params: TemplateListParams
}

class TemplatesCacheService {
  private memoryCache = new Map<string, CachedTemplateData>()
  private accessOrder = new Map<string, number>() // LRU访问顺序跟踪
  private accessCounter = 0 // 访问计数器
  private readonly DEFAULT_MAX_AGE = 3 * 60 * 1000 // 3分钟（比视频缓存稍短，模板数据更新频率较高）
  private readonly DEFAULT_MAX_ITEMS = 50  // 模板缓存项数量
  private readonly STORAGE_PREFIX = 'veo3_template_cache_'
  private readonly STORAGE_CLEANUP_INTERVAL = 5 * 60 * 1000 // 5分钟节流
  private lastStorageCleanup = 0
  private storageWriteCounter = 0
  
  /**
   * 生成稳定的缓存键（解决JSON.stringify键顺序不稳定问题）
   */
  private getCacheKey(params: TemplateListParams = {}): string {
    const normalizedParams = {
      page: params.page || 1,
      pageSize: params.pageSize || 12,
      sort: params.sort || 'latest',
      category: params.category || '',
      tags: (params.tags || []).sort().join(','), // 排序tags确保一致性
      search: params.search || '',
      auditStatus: params.auditStatus || 'approved',
      isActive: params.isActive !== undefined ? params.isActive : true
    }
    
    return this.stableStringify(normalizedParams)
  }

  /**
   * 稳定的JSON序列化（键按字母排序）
   */
  private stableStringify(obj: any): string {
    if (obj === null || obj === undefined) return 'null'
    if (typeof obj !== 'object') return String(obj)
    if (Array.isArray(obj)) return `[${obj.map(item => this.stableStringify(item)).join(',')}]`
    
    const sortedKeys = Object.keys(obj).sort()
    const pairs = sortedKeys.map(key => `"${key}":${this.stableStringify(obj[key])}`)
    return `{${pairs.join(',')}}`
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(timestamp: number, maxAge: number = this.DEFAULT_MAX_AGE): boolean {
    return Date.now() - timestamp < maxAge
  }

  /**
   * 从内存缓存获取（LRU优化）
   */
  private getFromMemory(cacheKey: string): CachedTemplateData | null {
    const cached = this.memoryCache.get(cacheKey)
    if (cached && this.isCacheValid(cached.timestamp)) {
      // 更新LRU访问顺序
      this.accessOrder.set(cacheKey, ++this.accessCounter)
      
      return cached
    }
    
    // 清理过期的内存缓存
    if (cached) {
      this.memoryCache.delete(cacheKey)
      this.accessOrder.delete(cacheKey)
    }
    
    return null
  }

  /**
   * 存储到内存缓存（LRU淘汰策略）
   */
  private setToMemory(cacheKey: string, data: CachedTemplateData): void {
    // LRU缓存大小限制和淘汰
    if (this.memoryCache.size >= this.DEFAULT_MAX_ITEMS) {
      // 找到最少使用的缓存项
      let lruKey = ''
      let minAccessTime = Infinity
      
      for (const [key, accessTime] of this.accessOrder) {
        if (accessTime < minAccessTime) {
          minAccessTime = accessTime
          lruKey = key
        }
      }
      
      if (lruKey) {
        this.memoryCache.delete(lruKey)
        this.accessOrder.delete(lruKey)
      }
    }
    
    this.memoryCache.set(cacheKey, data)
    this.accessOrder.set(cacheKey, ++this.accessCounter)
  }

  /**
   * 从统一缓存系统获取
   */
  private async getFromStorage(cacheKey: string): Promise<CachedTemplateData | null> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${cacheKey}`
      const cached = await unifiedCache.get<CachedTemplateData>(storageKey, {
        category: 'template'
      })
      
      if (cached) {
        if (this.isCacheValid(cached.timestamp, this.DEFAULT_MAX_AGE * 2)) { // 统一缓存时间更长
          // 同时加载到内存缓存
          this.setToMemory(cacheKey, cached)
          
          return cached
        } else {
        }
      }
    } catch (error) {
      console.warn('[TemplateCache] 统一缓存读取失败:', error)
    }
    
    return null
  }

  /**
   * 存储到统一缓存系统
   */
  private async setToStorage(cacheKey: string, data: CachedTemplateData): Promise<void> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${cacheKey}`
      await unifiedCache.set(storageKey, data, {
        category: 'template',
        ttl: this.DEFAULT_MAX_AGE * 2 / 1000 // 转换为秒
      })
    } catch (error) {
      console.warn('[TemplateCache] 统一缓存存储失败:', error)
    }
  }

  // 统一缓存系统会自动处理清理，移除旧的localStorage清理逻辑

  /**
   * 获取缓存数据（优先级：内存 > 统一缓存）
   */
  async getCachedTemplates(params: TemplateListParams = {}): Promise<CachedTemplateData | null> {
    const cacheKey = this.getCacheKey(params)
    
    // 1. 尝试从内存获取
    const memoryResult = this.getFromMemory(cacheKey)
    if (memoryResult) {
      return memoryResult
    }
    
    // 2. 尝试从统一缓存获取
    const storageResult = await this.getFromStorage(cacheKey)
    if (storageResult) {
      return storageResult
    }
    
    return null
  }

  /**
   * 缓存模板数据
   */
  async cacheTemplates(response: TemplateListResponse, params: TemplateListParams = {}): Promise<void> {
    const cacheKey = this.getCacheKey(params)
    const sanitizedTemplates = response.data.map(template => this.sanitizeTemplate(template))

    const data: CachedTemplateData = {
      templates: sanitizedTemplates,
      totalCount: response.totalCount,
      totalPages: response.totalPages,
      currentPage: response.currentPage,
      pageSize: response.pageSize,
      timestamp: Date.now(),
      params
    }

    // 同时存储到内存和统一缓存
    this.setToMemory(cacheKey, data)
    await this.setToStorage(cacheKey, data)
  }

  /**
   * 立即从缓存显示，后台更新数据
   */
  async getCacheFirstThenUpdate(
    params: TemplateListParams = {},
    updateFn?: () => Promise<TemplateListResponse>
  ): Promise<{ 
    cached: CachedTemplateData | null, 
    fresh?: TemplateListResponse 
  }> {
    const cached = await this.getCachedTemplates(params)
    
    // 立即返回缓存数据
    let result: { cached: CachedTemplateData | null, fresh?: TemplateListResponse } = { cached }
    
    // 后台更新（如果提供了更新函数）
    if (updateFn) {
      try {
        result.fresh = await updateFn()
        
        // 如果获得了新数据且与缓存不同，更新缓存
        if (result.fresh) {
          await this.cacheTemplates(result.fresh, params)
        }
      } catch (error) {
        console.warn('[TemplateCache] 后台更新失败:', error)
      }
    }
    
    return result
  }

  /**
   * 清理模板数据，移除不必要的大字段
   */
  private sanitizeTemplate(template: TemplateListItem): TemplateListItem {
    // 模板数据相对较小，暂时不需要特殊处理
    // 未来如果有大字段可以在这里移除
    return template
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache(): Promise<void> {
    // 清理内存缓存
    this.memoryCache.clear()
    this.accessOrder.clear()
    this.accessCounter = 0
    
    // 清理统一缓存系统中的模板数据
    try {
      // 使用统一缓存系统清理所有模板相关缓存
      await unifiedCache.clearAll()
      
      
    } catch (error) {
      console.warn('[TemplateCache] 清理缓存失败:', error)
    }
  }

  /**
   * 使缓存失效（强制重新加载）
   */
  async invalidateCache(params?: TemplateListParams): Promise<void> {
    if (params) {
      // 失效特定参数的缓存
      const cacheKey = this.getCacheKey(params)
      this.memoryCache.delete(cacheKey)
      this.accessOrder.delete(cacheKey)
      
      try {
        const storageKey = `${this.STORAGE_PREFIX}${cacheKey}`
        // 使用统一缓存系统删除特定缓存
        await unifiedCache.set(storageKey, null, { category: 'template', ttl: 0 })
      } catch (error) {
        console.warn('[TemplateCache] 清理统一缓存失败:', error)
      }
    } else {
      // 失效所有缓存
      await this.clearAllCache()
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    memorySize: number
    storageSize: number
    totalItems: number
    unifiedCacheStats?: any
  } {
    // 从统一缓存系统获取模板相关统计
    const unifiedStats = unifiedCache.getCategoryStats()
    const templateStats = unifiedStats.find(stat => stat.name === 'template')
    
    const memorySize = this.memoryCache.size
    const storageSize = templateStats?.count || 0
    
    
    return {
      memorySize,
      storageSize,
      totalItems: memorySize + storageSize,
      unifiedCacheStats: templateStats
    }
  }
}

// 导出单例实例
export const templatesCacheService = new TemplatesCacheService()