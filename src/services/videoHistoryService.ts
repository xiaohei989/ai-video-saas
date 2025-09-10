/**
 * Video History Service
 * 管理用户的视频生成历史记录
 */

export interface VideoRecord {
  id: string
  userId: string
  templateId: string
  templateName: string
  title?: string
  description?: string
  prompt: string
  parameters: Record<string, any>
  videoUrl?: string
  thumbnailUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  credits: number
  duration?: number
  resolution?: string
  fileSize?: number
  createdAt: Date
  completedAt?: Date
  error?: string
  isPublic: boolean
  views: number
  shares: number
  downloads: number
  metadata?: {
    model?: string
    aspectRatio?: string
    processingTime?: number
  }
}

export interface VideoFilter {
  userId?: string
  templateId?: string
  status?: VideoRecord['status']
  isPublic?: boolean
  startDate?: Date
  endDate?: Date
  searchTerm?: string
}

export interface PaginationOptions {
  page: number
  pageSize: number
  sortBy?: keyof VideoRecord
  sortOrder?: 'asc' | 'desc'
}

class VideoHistoryService {
  private records: Map<string, VideoRecord> = new Map()
  private userRecords: Map<string, Set<string>> = new Map()

  constructor() {
    // 加载持久化数据（如果有）
    this.loadFromStorage()
  }

  /**
   * 创建新的视频记录
   */
  createRecord(data: Partial<VideoRecord>): VideoRecord {
    const record: VideoRecord = {
      id: data.id || this.generateId(),
      userId: data.userId || '',
      templateId: data.templateId || '',
      templateName: data.templateName || '',
      prompt: data.prompt || '',
      parameters: data.parameters || {},
      status: data.status || 'pending',
      credits: data.credits || 0,
      createdAt: data.createdAt || new Date(),
      isPublic: data.isPublic || false,
      views: 0,
      shares: 0,
      downloads: 0,
      ...data
    }

    this.records.set(record.id, record)

    // 添加到用户记录索引
    if (record.userId) {
      if (!this.userRecords.has(record.userId)) {
        this.userRecords.set(record.userId, new Set())
      }
      this.userRecords.get(record.userId)!.add(record.id)
    }

    // 持久化
    this.saveToStorage()

    return record
  }

  /**
   * 更新视频记录
   */
  updateRecord(id: string, updates: Partial<VideoRecord>): VideoRecord | null {
    const record = this.records.get(id)
    if (!record) return null

    Object.assign(record, updates)

    // 如果状态变为完成，设置完成时间
    if (updates.status === 'completed' && !record.completedAt) {
      record.completedAt = new Date()
      
      // 计算处理时间
      if (record.createdAt) {
        const processingTime = record.completedAt.getTime() - record.createdAt.getTime()
        record.metadata = {
          ...record.metadata,
          processingTime: processingTime / 1000 // 转换为秒
        }
      }
    }

    this.saveToStorage()
    return record
  }

  /**
   * 获取单个记录
   */
  getRecord(id: string): VideoRecord | null {
    return this.records.get(id) || null
  }

  /**
   * 获取用户的所有记录
   */
  getUserRecords(
    userId: string,
    filter?: VideoFilter,
    pagination?: PaginationOptions
  ): {
    records: VideoRecord[]
    total: number
    page: number
    pageSize: number
  } {
    const userRecordIds = this.userRecords.get(userId) || new Set()
    let records = Array.from(userRecordIds)
      .map(id => this.records.get(id))
      .filter(Boolean) as VideoRecord[]

    // 应用过滤器
    if (filter) {
      records = this.applyFilter(records, filter)
    }

    // 排序
    if (pagination?.sortBy) {
      records = this.sortRecords(records, pagination.sortBy, pagination.sortOrder)
    } else {
      // 默认按创建时间倒序
      records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    // 分页
    const page = pagination?.page || 1
    const pageSize = pagination?.pageSize || 10
    const start = (page - 1) * pageSize
    const end = start + pageSize

    return {
      records: records.slice(start, end),
      total: records.length,
      page,
      pageSize
    }
  }

  /**
   * 搜索视频记录
   */
  searchRecords(
    filter: VideoFilter,
    pagination?: PaginationOptions
  ): {
    records: VideoRecord[]
    total: number
    page: number
    pageSize: number
  } {
    let records = Array.from(this.records.values())

    // 应用过滤器
    records = this.applyFilter(records, filter)

    // 排序
    if (pagination?.sortBy) {
      records = this.sortRecords(records, pagination.sortBy, pagination.sortOrder)
    }

    // 分页
    const page = pagination?.page || 1
    const pageSize = pagination?.pageSize || 10
    const start = (page - 1) * pageSize
    const end = start + pageSize

    return {
      records: records.slice(start, end),
      total: records.length,
      page,
      pageSize
    }
  }

  /**
   * 应用过滤器
   */
  private applyFilter(records: VideoRecord[], filter: VideoFilter): VideoRecord[] {
    return records.filter(record => {
      if (filter.userId && record.userId !== filter.userId) return false
      if (filter.templateId && record.templateId !== filter.templateId) return false
      if (filter.status && record.status !== filter.status) return false
      if (filter.isPublic !== undefined && record.isPublic !== filter.isPublic) return false
      
      if (filter.startDate && record.createdAt < filter.startDate) return false
      if (filter.endDate && record.createdAt > filter.endDate) return false
      
      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase()
        const searchable = [
          record.prompt,
          record.templateName,
          JSON.stringify(record.parameters)
        ].join(' ').toLowerCase()
        
        if (!searchable.includes(term)) return false
      }
      
      return true
    })
  }

  /**
   * 排序记录
   */
  private sortRecords(
    records: VideoRecord[],
    sortBy: keyof VideoRecord,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): VideoRecord[] {
    return records.sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      
      if (aVal === undefined || aVal === null) return 1
      if (bVal === undefined || bVal === null) return -1
      
      let comparison = 0
      if (aVal < bVal) comparison = -1
      if (aVal > bVal) comparison = 1
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }

  /**
   * 获取统计信息
   */
  getStatistics(userId?: string): {
    total: number
    completed: number
    failed: number
    pending: number
    processing: number
    totalCredits: number
    totalViews: number
    totalShares: number
    totalDownloads: number
    averageProcessingTime: number
    templateUsage: Record<string, number>
  } {
    let records = userId
      ? this.getUserRecords(userId).records
      : Array.from(this.records.values())

    const stats = {
      total: records.length,
      completed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
      totalCredits: 0,
      totalViews: 0,
      totalShares: 0,
      totalDownloads: 0,
      averageProcessingTime: 0,
      templateUsage: {} as Record<string, number>
    }

    const processingTimes: number[] = []

    for (const record of records) {
      // 状态统计
      stats[record.status]++
      
      // 积分统计
      if (record.status === 'completed') {
        stats.totalCredits += record.credits
      }
      
      // 互动统计
      stats.totalViews += record.views
      stats.totalShares += record.shares
      stats.totalDownloads += record.downloads
      
      // 模板使用统计
      if (record.templateId) {
        stats.templateUsage[record.templateId] = 
          (stats.templateUsage[record.templateId] || 0) + 1
      }
      
      // 处理时间统计
      if (record.metadata?.processingTime) {
        processingTimes.push(record.metadata.processingTime)
      }
    }

    // 计算平均处理时间
    if (processingTimes.length > 0) {
      const sum = processingTimes.reduce((a, b) => a + b, 0)
      stats.averageProcessingTime = sum / processingTimes.length
    }

    return stats
  }

  /**
   * 增加视频互动计数
   */
  incrementInteraction(
    id: string,
    type: 'views' | 'shares' | 'downloads'
  ): void {
    const record = this.records.get(id)
    if (record) {
      record[type]++
      this.saveToStorage()
    }
  }

  /**
   * 删除记录
   */
  deleteRecord(id: string): boolean {
    const record = this.records.get(id)
    if (!record) return false

    // 从用户索引中移除
    if (record.userId) {
      const userRecordIds = this.userRecords.get(record.userId)
      if (userRecordIds) {
        userRecordIds.delete(id)
      }
    }

    // 删除记录
    this.records.delete(id)
    this.saveToStorage()
    
    return true
  }

  /**
   * 批量删除记录
   */
  deleteUserRecords(userId: string): number {
    const userRecordIds = this.userRecords.get(userId) || new Set()
    let deletedCount = 0

    for (const id of userRecordIds) {
      if (this.records.delete(id)) {
        deletedCount++
      }
    }

    this.userRecords.delete(userId)
    this.saveToStorage()
    
    return deletedCount
  }

  /**
   * 获取公开视频
   */
  getPublicVideos(
    pagination?: PaginationOptions
  ): {
    records: VideoRecord[]
    total: number
    page: number
    pageSize: number
  } {
    return this.searchRecords(
      { isPublic: true, status: 'completed' },
      pagination
    )
  }

  /**
   * 获取热门视频
   */
  getTrendingVideos(limit: number = 10): VideoRecord[] {
    return Array.from(this.records.values())
      .filter(r => r.isPublic && r.status === 'completed')
      .sort((a, b) => {
        // 综合评分：浏览量50% + 分享25% + 下载25%
        const scoreA = a.views * 0.5 + a.shares * 0.25 + a.downloads * 0.25
        const scoreB = b.views * 0.5 + b.shares * 0.25 + b.downloads * 0.25
        return scoreB - scoreA
      })
      .slice(0, limit)
  }

  /**
   * 生成ID
   */
  private generateId(): string {
    return `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 持久化到存储
   */
  private saveToStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const data = {
          records: Array.from(this.records.entries()),
          userRecords: Array.from(this.userRecords.entries()).map(([userId, ids]) => [
            userId,
            Array.from(ids)
          ])
        }
        localStorage.setItem('videoHistory', JSON.stringify(data))
      } catch (error) {
        console.error('Failed to save video history:', error)
      }
    }
  }

  /**
   * 从存储加载
   */
  private loadFromStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem('videoHistory')
        if (stored) {
          const data = JSON.parse(stored)
          
          // 恢复记录
          this.records = new Map(data.records.map(([id, record]: [string, any]) => [
            id,
            {
              ...record,
              createdAt: new Date(record.createdAt),
              completedAt: record.completedAt ? new Date(record.completedAt) : undefined
            }
          ]))
          
          // 恢复用户索引
          this.userRecords = new Map(data.userRecords.map(([userId, ids]: [string, string[]]) => [
            userId,
            new Set(ids)
          ]))
        }
      } catch (error) {
        console.error('Failed to load video history:', error)
      }
    }
  }
}

// 导出单例
export const videoHistoryService = new VideoHistoryService()
export default videoHistoryService