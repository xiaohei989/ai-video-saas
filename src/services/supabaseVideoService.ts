/**
 * Supabase Video Service
 * 管理视频数据的 CRUD 操作，使用 Supabase 作为后端存储
 */

import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import type { VideoQuality } from '@/config/credits'

type Video = Database['public']['Tables']['videos']['Row']
type VideoInsert = Omit<Database['public']['Tables']['videos']['Row'], 
  'id' | 'created_at' | 'updated_at' | 'view_count' | 'download_count' | 
  'like_count' | 'comment_count' | 'share_count'>
type VideoUpdate = Partial<VideoInsert>

export interface VideoFilter {
  userId?: string
  templateId?: string
  status?: Video['status']
  isPublic?: boolean
  isDeleted?: boolean
  startDate?: Date
  endDate?: Date
  searchTerm?: string
}

export interface PaginationOptions {
  page: number
  pageSize: number
  sortBy?: keyof Video
  sortOrder?: 'asc' | 'desc'
}

class SupabaseVideoService {
  // 🚀 移动端优化：请求缓存和超时处理
  private requestCache = new Map<string, { data: any, timestamp: number }>()
  private readonly CACHE_DURATION = 30000 // 30秒缓存
  private readonly DEFAULT_TIMEOUT = 8000 // 8秒超时（移动端友好）
  
  // 🚀 网络请求优化：防抖动和去重
  private pendingRequests = new Map<string, Promise<any>>()
  private interactionDebounce = new Map<string, NodeJS.Timeout>()
  
  /**
   * 🚀 带超时的请求包装器
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number = this.DEFAULT_TIMEOUT): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`请求超时 (${timeout}ms)`))
        }, timeout)
      })
    ])
  }
  
  /**
   * 🚀 请求缓存机制
   */
  private getCacheKey(method: string, ...args: any[]): string {
    return `${method}_${JSON.stringify(args)}`
  }
  
  private getCachedResult<T>(cacheKey: string): T | null {
    const cached = this.requestCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data as T
    }
    return null
  }
  
  private setCachedResult<T>(cacheKey: string, data: T): void {
    this.requestCache.set(cacheKey, { data, timestamp: Date.now() })
    
    // 限制缓存大小
    if (this.requestCache.size > 50) {
      const oldestKey = this.requestCache.keys().next().value
      this.requestCache.delete(oldestKey)
    }
  }

  /**
   * 创建新的视频记录
   */
  async createVideo(data: {
    userId: string
    templateId?: string  // This is the string template ID, will be stored in metadata
    title?: string
    description?: string
    prompt?: string
    parameters?: Record<string, any>
    creditsUsed: number
    status?: Video['status']
    isPublic?: boolean
    veo3JobId?: string
    aspectRatio?: '16:9' | '9:16'
    quality?: VideoQuality
    // apiProvider 已移除 - 统一由环境变量控制
    aiTitleStatus?: 'pending' | 'ai_generated' | 'timeout_default' | 'user_provided' | 'error_fallback'
  }): Promise<Video | null> {
    try {
      // Store template ID and other parameters in metadata since they're not direct DB fields
      const metadata: Record<string, any> = {
        templateId: data.templateId || null,
        aspectRatio: data.aspectRatio || '16:9',
        quality: data.quality || 'veo3'
        // apiProvider 已移除 - 不再存储到数据库
      }

      const { data: video, error } = await supabase
        .from('videos')
        .insert({
          user_id: data.userId,
          template_id: null,  // Keep null since we don't have UUID templates in DB
          title: data.title || null,
          description: data.description || null,
          prompt: data.prompt || null,
          parameters: {
            ...data.parameters || {},
            // 也在parameters中存储一份，方便后续使用
            aspectRatio: data.aspectRatio || '16:9',
            quality: data.quality || 'veo3'
            // apiProvider 已移除 - 不再存储
          },
          credits_used: data.creditsUsed,
          status: data.status || 'pending',
          is_public: data.isPublic || false,
          veo3_job_id: data.veo3JobId || null,
          is_deleted: false,
          view_count: 0,
          download_count: 0,
          like_count: 0,
          comment_count: 0,
          share_count: 0,
          version: 1,
          tags: [],
          metadata: metadata,
          ai_title_status: data.aiTitleStatus || 'pending'
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating video:', error)
        return null
      }

      return video
    } catch (error) {
      console.error('Failed to create video:', error)
      return null
    }
  }

  /**
   * 更新视频记录（用户操作，受 RLS 限制）
   */
  async updateVideo(id: string, updates: VideoUpdate): Promise<Video | null> {
    try {
      // 如果状态变为完成，设置完成时间
      const updateData: any = { ...updates }
      if (updates.status === 'completed') {
        updateData.processing_completed_at = new Date().toISOString()
      } else if (updates.status === 'processing' && !updates.processing_started_at) {
        // 只在没有开始时间时才设置，避免重复更新
        updateData.processing_started_at = new Date().toISOString()
        console.log('[UPDATE VIDEO] Setting processing_started_at for first time')
      }

      const { data: video, error } = await supabase
        .from('videos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating video:', error)
        return null
      }

      return video
    } catch (error) {
      console.error('Failed to update video:', error)
      return null
    }
  }

  /**
   * 系统级更新视频记录（统一使用Edge Function）
   */
  async updateVideoAsSystem(id: string, updates: VideoUpdate): Promise<Video | null> {
    try {
      console.log('[SYSTEM UPDATE] ========== 系统级更新开始 ==========')
      console.log('[SYSTEM UPDATE] 🎯 更新ID:', id)
      console.log('[SYSTEM UPDATE] 📦 更新参数:', JSON.stringify(updates, null, 2))
      console.log('[SYSTEM UPDATE] 🔗 video_url 存在:', !!updates.video_url)
      console.log('[SYSTEM UPDATE] 📏 video_url 长度:', updates.video_url ? updates.video_url.length : 'N/A')
      console.log('[SYSTEM UPDATE] 💬 video_url 内容:', updates.video_url || 'N/A')
      console.log('[SYSTEM UPDATE] Using Edge Function for secure update')
      
      const result = await this.updateViaEdgeFunction(id, updates)
      
      return result
      
    } catch (error) {
      console.error('[SYSTEM UPDATE] ========== 系统级更新失败 ==========')
      console.error('[SYSTEM UPDATE] Update failed:', error)
      
      // 回退：尝试普通客户端更新（可能因 RLS 失败）
      console.warn('[SYSTEM UPDATE] Falling back to regular client (will likely fail due to RLS)')
      return this.updateVideo(id, updates)
    }
  }


  /**
   * 通过 Edge Function 更新（生产环境推荐）
   */
  private async updateViaEdgeFunction(id: string, updates: VideoUpdate): Promise<Video | null> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    const payload = {
      videoId: id,
      updates
    }
    
    console.log('[EDGE FUNCTION] ========== Edge Function 调用开始 ==========')
    console.log('[EDGE FUNCTION] 🌐 Supabase URL:', supabaseUrl)
    console.log('[EDGE FUNCTION] 📦 完整载荷:', JSON.stringify(payload, null, 2))
    console.log('[EDGE FUNCTION] 🔗 载荷中video_url:', updates.video_url || 'N/A')
    console.log('[EDGE FUNCTION] 📏 载荷video_url长度:', updates.video_url ? updates.video_url.length : 'N/A')
    
    const response = await fetch(`${supabaseUrl}/functions/v1/update-video-status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    console.log('[EDGE FUNCTION] 📞 HTTP响应状态:', response.status)
    console.log('[EDGE FUNCTION] 📞 HTTP响应成功:', response.ok)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[EDGE FUNCTION] ❌ HTTP错误响应文本:', errorText)
      
      let errorData = {}
      try {
        errorData = JSON.parse(errorText)
      } catch (parseError) {
        console.error('[EDGE FUNCTION] ❌ 无法解析错误响应为JSON')
      }
      
      console.error('[EDGE FUNCTION] HTTP error:', response.status, errorData)
      throw new Error(`Edge Function error: ${errorData.error || 'Unknown error'}`)
    }

    const responseText = await response.text()
    
    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('[EDGE FUNCTION] ❌ JSON解析失败:', parseError)
      throw new Error('Failed to parse Edge Function response')
    }
    
    if (!result.success) {
      console.error('[EDGE FUNCTION] ❌ Function逻辑错误:', result.error)
      throw new Error(result.error || 'Edge function failed')
    }

    console.log('[EDGE FUNCTION] ✅ Edge Function执行成功')
    console.log('[EDGE FUNCTION] 📊 返回数据概要:', {
      id: result.data?.id,
      status: result.data?.status,
      hasVideoUrl: !!result.data?.video_url,
      videoUrlLength: result.data?.video_url ? result.data.video_url.length : 'N/A',
      videoUrlPreview: result.data?.video_url ? result.data.video_url.substring(0, 100) + '...' : 'N/A'
    })
    console.log('[EDGE FUNCTION] 🔗 返回的完整video_url:', result.data?.video_url || 'N/A')
    return result.data
  }

  /**
   * 获取单个视频记录
   */
  async getVideo(id: string): Promise<Video | null> {
    try {
      const { data: videos, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
      
      // 不使用 .single()，避免0行时报错
      if (error) {
        console.error('Error fetching video:', error)
        return null
      }
      
      // 手动处理结果
      if (!videos || videos.length === 0) {
        // 视频不存在，正常返回null（不记录错误）
        return null
      }
      
      return videos[0]
    } catch (error) {
      console.error('Failed to fetch video:', error)
      return null
    }
  }

  /**
   * 🚀 获取用户的视频列表 - 移动端优化版
   */
  async getUserVideos(
    userId: string,
    filter?: VideoFilter,
    pagination?: PaginationOptions
  ): Promise<{
    videos: Video[]
    total: number
    page: number
    pageSize: number
  }> {
    const cacheKey = this.getCacheKey('getUserVideos', userId, filter, pagination)
    
    // 🚀 尝试从缓存获取
    const cached = this.getCachedResult<{
      videos: Video[], total: number, page: number, pageSize: number
    }>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      // 🚀 使用超时包装
      const result = await this.withTimeout(
        this.fetchUserVideosInternal(userId, filter, pagination),
        // 移动端网络环境不稳定，适当加长超时
        pagination?.pageSize && pagination.pageSize <= 10 ? 6000 : this.DEFAULT_TIMEOUT
      )
      
      // 🚀 缓存结果
      this.setCachedResult(cacheKey, result)
      
      
      return result
    } catch (error) {
      console.error('获取用户视频失败:', error)
      
      // 返回空结果但不缓存错误
      return {
        videos: [],
        total: 0,
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || 10
      }
    }
  }
  
  /**
   * 内部获取方法 - 封装实际的数据库查询逻辑
   */
  private async fetchUserVideosInternal(
    userId: string,
    filter?: VideoFilter,
    pagination?: PaginationOptions
  ) {
    let query = supabase
      .from('videos')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_deleted', false)

    // 应用过滤器
    if (filter) {
      if (filter.status) {
        query = query.eq('status', filter.status)
      }
      if (filter.templateId) {
        query = query.contains('metadata', { templateId: filter.templateId })
      }
      if (filter.isPublic !== undefined) {
        query = query.eq('is_public', filter.isPublic)
      }
      if (filter.searchTerm) {
        query = query.or(`title.ilike.%${filter.searchTerm}%,prompt.ilike.%${filter.searchTerm}%`)
      }
      if (filter.startDate) {
        query = query.gte('created_at', filter.startDate.toISOString())
      }
      if (filter.endDate) {
        query = query.lte('created_at', filter.endDate.toISOString())
      }
    }

    // 排序
    const sortBy = pagination?.sortBy || 'created_at'
    const sortOrder = pagination?.sortOrder || 'desc'
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // 分页
    const page = pagination?.page || 1
    const pageSize = pagination?.pageSize || 10
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data: videos, error, count } = await query

    if (error) {
      console.error('Error fetching user videos:', error)
      throw new Error(`数据库查询失败: ${error.message}`)
    }

    return {
      videos: videos || [],
      total: count || 0,
      page,
      pageSize
    }
  }

  /**
   * 获取公开视频列表
   */
  async getPublicVideos(
    pagination?: PaginationOptions
  ): Promise<{
    videos: Video[]
    total: number
    page: number
    pageSize: number
  }> {
    try {
      let query = supabase
        .from('videos')
        .select('*', { count: 'exact' })
        .eq('is_public', true)
        .eq('is_deleted', false)
        .eq('status', 'completed')

      // 排序（默认按观看次数）
      const sortBy = pagination?.sortBy || 'view_count'
      const sortOrder = pagination?.sortOrder || 'desc'
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      // 分页
      const page = pagination?.page || 1
      const pageSize = pagination?.pageSize || 10
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data: videos, error, count } = await query

      if (error) {
        console.error('Error fetching public videos:', error)
        return {
          videos: [],
          total: 0,
          page,
          pageSize
        }
      }

      return {
        videos: videos || [],
        total: count || 0,
        page,
        pageSize
      }
    } catch (error) {
      console.error('Failed to fetch public videos:', error)
      return {
        videos: [],
        total: 0,
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || 10
      }
    }
  }

  /**
   * 软删除视频
   */
  async softDeleteVideo(id: string, userId: string): Promise<boolean> {
    try {
      console.log('[supabaseVideoService] 开始软删除视频:', { id, userId })
      
      // 首先检查用户是否已认证
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('[supabaseVideoService] 获取用户认证失败:', userError)
        return false
      }
      
      if (!user) {
        console.error('[supabaseVideoService] 用户未认证')
        return false
      }
      
      if (user.id !== userId) {
        console.error('[supabaseVideoService] 用户ID不匹配:', { authUserId: user.id, providedUserId: userId })
        return false
      }
      
      console.log('[supabaseVideoService] 用户认证验证成功:', user.id)

      // 先检查视频是否存在且属于该用户
      const { data: existingVideo, error: fetchError } = await supabase
        .from('videos')
        .select('id, user_id, title, is_deleted')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        console.error('[supabaseVideoService] 获取视频信息失败:', fetchError)
        return false
      }

      if (!existingVideo) {
        console.error('[supabaseVideoService] 视频不存在或不属于该用户')
        return false
      }

      if (existingVideo.is_deleted) {
        console.warn('[supabaseVideoService] 视频已经被删除')
        return true // 已经删除，返回成功
      }

      console.log('[supabaseVideoService] 找到视频，准备删除:', existingVideo.title)

      // 执行软删除
      const { data, error } = await supabase
        .from('videos')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: userId
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select('id, is_deleted, deleted_at')

      if (error) {
        console.error('[supabaseVideoService] 软删除操作失败:', {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        return false
      }

      if (!data || data.length === 0) {
        console.error('[supabaseVideoService] 删除操作没有影响任何行')
        return false
      }

      console.log('[supabaseVideoService] 软删除成功:', data[0])
      return true
    } catch (error) {
      console.error('[supabaseVideoService] 软删除过程出错:', error)
      return false
    }
  }

  /**
   * 硬删除视频（永久删除）
   * 警告：此操作不可逆，将完全从数据库中删除视频记录
   */
  async hardDeleteVideo(id: string, userId: string): Promise<boolean> {
    try {
      console.log('[supabaseVideoService] 开始硬删除视频:', { id, userId })
      
      // 首先检查用户是否已认证
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('[supabaseVideoService] 获取用户认证失败:', userError)
        return false
      }
      
      if (!user) {
        console.error('[supabaseVideoService] 用户未认证')
        return false
      }
      
      if (user.id !== userId) {
        console.error('[supabaseVideoService] 用户ID不匹配:', { authUserId: user.id, providedUserId: userId })
        return false
      }
      
      console.log('[supabaseVideoService] 用户认证验证成功:', user.id)

      // 先获取视频信息用于清理相关资源
      const { data: existingVideo, error: fetchError } = await supabase
        .from('videos')
        .select('id, user_id, title, video_url, thumbnail_url')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        console.error('[supabaseVideoService] 获取视频信息失败:', fetchError)
        return false
      }

      if (!existingVideo) {
        console.error('[supabaseVideoService] 视频不存在或不属于该用户')
        return false
      }

      console.log('[supabaseVideoService] 找到视频，准备永久删除:', existingVideo.title)

      // 删除视频相关的存储文件（如果存在）
      try {
        const filesToDelete: string[] = []
        
        if (existingVideo.video_url) {
          // 提取存储路径
          const videoPath = this.extractStoragePath(existingVideo.video_url)
          if (videoPath) filesToDelete.push(videoPath)
        }
        
        if (existingVideo.thumbnail_url) {
          // 提取存储路径
          const thumbnailPath = this.extractStoragePath(existingVideo.thumbnail_url)
          if (thumbnailPath) filesToDelete.push(thumbnailPath)
        }
        
        if (filesToDelete.length > 0) {
          console.log('[supabaseVideoService] 删除存储文件:', filesToDelete)
          const { error: storageError } = await supabase.storage
            .from('videos')
            .remove(filesToDelete)
            
          if (storageError) {
            console.warn('[supabaseVideoService] 删除存储文件失败:', storageError)
            // 继续执行数据库删除，不让存储文件删除失败阻止整个操作
          }
        }
      } catch (storageError) {
        console.warn('[supabaseVideoService] 清理存储文件时出错:', storageError)
      }

      // 执行硬删除：从数据库中完全删除记录
      // 添加.select()以返回被删除的数据，用于验证删除是否真正执行
      const { data: deletedData, error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select() // 关键：返回被删除的记录

      if (deleteError) {
        console.error('[supabaseVideoService] 硬删除操作失败:', {
          error: deleteError,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint,
          code: deleteError.code
        })
        return false
      }

      // 检查是否真正删除了记录
      if (!deletedData || deletedData.length === 0) {
        console.error('[supabaseVideoService] 删除操作未找到匹配的记录或权限不足')
        console.error('[supabaseVideoService] 可能的原因：1. RLS策略阻止删除 2. 记录不存在 3. 权限不足')
        return false
      }

      console.log('[supabaseVideoService] 硬删除成功，删除了', deletedData.length, '条记录:', id)
      return true
    } catch (error) {
      console.error('[supabaseVideoService] 硬删除过程出错:', error)
      return false
    }
  }

  /**
   * 从存储URL中提取文件路径
   */
  private extractStoragePath(url: string): string | null {
    try {
      if (!url) return null
      
      // 如果是Supabase存储URL，提取路径部分
      const supabaseStoragePattern = /\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/
      const match = url.match(supabaseStoragePattern)
      
      if (match && match[1]) {
        return match[1]
      }
      
      // 如果不是标准的Supabase存储URL，可能是相对路径
      if (!url.startsWith('http')) {
        return url
      }
      
      return null
    } catch (error) {
      console.error('[supabaseVideoService] 解析存储路径失败:', error)
      return null
    }
  }

  /**
   * 恢复已删除的视频
   */
  async restoreVideo(id: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('videos')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_by: null
        })
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_deleted', true)

      if (error) {
        console.error('Error restoring video:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to restore video:', error)
      return false
    }
  }

  /**
   * 永久删除视频
   */
  async permanentlyDeleteVideo(id: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_deleted', true)

      if (error) {
        console.error('Error permanently deleting video:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to permanently delete video:', error)
      return false
    }
  }

  /**
   * 增加视频交互计数 - 优化版本，防抖动和去重
   */
  async incrementInteraction(
    id: string,
    type: 'view_count' | 'download_count' | 'share_count'
  ): Promise<boolean> {
    const requestKey = `increment_${id}_${type}`
    
    // 防抖动：view_count 2秒内只处理一次，其他类型1秒内只处理一次
    const debounceTime = type === 'view_count' ? 2000 : 1000
    
    // 清除之前的防抖定时器
    if (this.interactionDebounce.has(requestKey)) {
      clearTimeout(this.interactionDebounce.get(requestKey)!)
    }
    
    return new Promise((resolve) => {
      this.interactionDebounce.set(requestKey, setTimeout(async () => {
        try {
          // 清理防抖记录
          this.interactionDebounce.delete(requestKey)
          
          // 检查是否有相同的请求正在进行
          if (this.pendingRequests.has(requestKey)) {
            const result = await this.pendingRequests.get(requestKey)
            resolve(result)
            return
          }
          
          // 创建新的请求并记录
          const requestPromise = this.performIncrementInteraction(id, type)
          this.pendingRequests.set(requestKey, requestPromise)
          
          try {
            const result = await requestPromise
            resolve(result)
          } finally {
            // 清理请求记录
            this.pendingRequests.delete(requestKey)
          }
        } catch (error) {
          console.error(`${type}计数更新失败:`, error)
          resolve(false)
        }
      }, debounceTime))
    })
  }
  
  /**
   * 执行实际的交互计数更新
   */
  private async performIncrementInteraction(
    id: string,
    type: 'view_count' | 'download_count' | 'share_count'
  ): Promise<boolean> {
    try {
      
      // 使用带超时的请求
      const fetchResult = await this.withTimeout(
        supabase
          .from('videos')
          .select(type)
          .eq('id', id)
          .single(),
        5000 // 5秒超时
      )

      if (fetchResult.error || !fetchResult.data) {
        console.error(`获取视频失败 ${id}:`, fetchResult.error)
        return false
      }

      // 更新计数 - 使用原子操作
      const currentCount = fetchResult.data[type] || 0
      const updateData: any = { [type]: currentCount + 1 }
      
      // 如果是观看，同时更新最后观看时间
      if (type === 'view_count') {
        updateData.last_viewed_at = new Date().toISOString()
      }
      
      const updateResult = await this.withTimeout(
        supabase
          .from('videos')
          .update(updateData)
          .eq('id', id),
        5000 // 5秒超时
      )

      if (updateResult.error) {
        console.error(`更新${type}失败:`, updateResult.error)
        return false
      }

      return true
    } catch (error) {
      // 检查是否是网络错误，可以重试
      if (error instanceof Error && (
        error.message.includes('网络') || 
        error.message.includes('超时') ||
        error.message.includes('fetch')
      )) {
        console.warn(`网络错误，${type}更新失败: ${id}`, error.message)
      } else {
        console.error(`${type}更新异常: ${id}`, error)
      }
      return false
    }
  }

  /**
   * 获取用户视频统计
   */
  async getUserStatistics(userId: string): Promise<{
    total: number
    completed: number
    failed: number
    pending: number
    processing: number
    totalCredits: number
    totalViews: number
    totalShares: number
    totalDownloads: number
  }> {
    try {
      const { data: videos, error } = await supabase
        .from('videos')
        .select('status, credits_used, view_count, share_count, download_count')
        .eq('user_id', userId)
        .eq('is_deleted', false)

      if (error || !videos) {
        console.error('Error fetching statistics:', error)
        return {
          total: 0,
          completed: 0,
          failed: 0,
          pending: 0,
          processing: 0,
          totalCredits: 0,
          totalViews: 0,
          totalShares: 0,
          totalDownloads: 0
        }
      }

      const stats = {
        total: videos.length,
        completed: 0,
        failed: 0,
        pending: 0,
        processing: 0,
        totalCredits: 0,
        totalViews: 0,
        totalShares: 0,
        totalDownloads: 0
      }

      for (const video of videos) {
        // 状态统计
        if (video.status === 'completed') stats.completed++
        else if (video.status === 'failed') stats.failed++
        else if (video.status === 'pending') stats.pending++
        else if (video.status === 'processing') stats.processing++

        // 积分和互动统计
        if (video.status === 'completed') {
          stats.totalCredits += video.credits_used || 0
        }
        stats.totalViews += video.view_count || 0
        stats.totalShares += video.share_count || 0
        stats.totalDownloads += video.download_count || 0
      }

      return stats
    } catch (error) {
      console.error('Failed to fetch user statistics:', error)
      return {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        processing: 0,
        totalCredits: 0,
        totalViews: 0,
        totalShares: 0,
        totalDownloads: 0
      }
    }
  }

  /**
   * 批量删除用户视频
   */
  async deleteUserVideos(userId: string): Promise<number> {
    try {
      const { data: videos, error } = await supabase
        .from('videos')
        .delete()
        .eq('user_id', userId)
        .select()

      if (error) {
        console.error('Error deleting user videos:', error)
        return 0
      }

      return videos?.length || 0
    } catch (error) {
      console.error('Failed to delete user videos:', error)
      return 0
    }
  }

  /**
   * 订阅视频状态更新
   */
  subscribeToVideoUpdates(
    videoId: string,
    onUpdate: (video: Video) => void
  ): () => void {
    const subscription = supabase
      .channel(`video-${videoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${videoId}`
        },
        (payload) => {
          onUpdate(payload.new as Video)
        }
      )
      .subscribe()

    // 返回取消订阅函数
    return () => {
      subscription.unsubscribe()
    }
  }

  /**
   * 订阅用户的新视频
   */
  subscribeToUserVideos(
    userId: string,
    onNewVideo: (video: Video) => void
  ): () => void {
    const subscription = supabase
      .channel(`user-videos-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          onNewVideo(payload.new as Video)
        }
      )
      .subscribe()

    // 返回取消订阅函数
    return () => {
      subscription.unsubscribe()
    }
  }

  /**
   * 订阅用户的所有视频更新（包括新建和状态变化）
   */
  subscribeToAllUserVideoUpdates(
    userId: string,
    onVideoUpdate: (video: Video) => void
  ): () => void {
    const channelName = `user-all-videos-${userId}`
    console.log(`[SUPABASE Realtime] 🔔 开始订阅频道: ${channelName}`)
    console.log('[SUPABASE Realtime] 📋 配置检查清单：')
    console.log('  1. Supabase Dashboard -> Database -> Replication -> 确认 "videos" 表已启用')
    console.log('  2. Supabase Dashboard -> Database -> Replication -> 确认相关字段已勾选')
    console.log('  3. 检查 RLS 策略是否允许用户读取自己的视频')
    console.log('  4. 查看下方订阅状态日志，确认连接是否成功')

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[SUPABASE Realtime] ➕ 收到 INSERT 事件:', payload.new)
          onVideoUpdate(payload.new as Video)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[SUPABASE Realtime] 🔄 收到 UPDATE 事件:', payload.new)
          // 特别标记 AI 标题更新
          const video = payload.new as Video
          if (video.ai_title_status === 'ai_generated') {
            console.log('[SUPABASE Realtime] ✨ 检测到 AI 标题生成完成:', video.id, video.title)
          }
          onVideoUpdate(video)
        }
      )
      .subscribe((status, err) => {
        // 订阅状态回调
        console.log(`[SUPABASE Realtime] 📡 订阅状态变化: ${status}`)

        if (status === 'SUBSCRIBED') {
          console.log('[SUPABASE Realtime] ✅ 订阅成功建立')
        } else if (status === 'CLOSED') {
          console.log('[SUPABASE Realtime] 🔴 订阅连接关闭')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[SUPABASE Realtime] ❌ 订阅频道错误:', err)
        } else if (status === 'TIMED_OUT') {
          console.error('[SUPABASE Realtime] ⏱️ 订阅连接超时')
        }
      })

    // 定期检查订阅状态
    const statusCheckInterval = setInterval(() => {
      const state = subscription.state
      if (state !== 'joined') {
        console.warn(`[SUPABASE Realtime] ⚠️ 订阅状态异常: ${state}`)
      }
    }, 30000) // 每 30 秒检查一次

    // 返回取消订阅函数
    return () => {
      console.log('[SUPABASE Realtime] 🔕 取消订阅')
      clearInterval(statusCheckInterval)
      subscription.unsubscribe()
    }
  }

  /**
   * 🚀 当视频完成时自动生成并上传缩略图
   * @param video 视频记录
   * @returns Promise<boolean> 是否成功生成缩略图
   */
  async autoGenerateThumbnailOnComplete(video: Video): Promise<boolean> {
    try {
      // 检查是否启用前端缩略图生成
      const enableFrontendThumbnail = import.meta.env.VITE_ENABLE_FRONTEND_THUMBNAIL !== 'false'
      if (!enableFrontendThumbnail) {
        console.log('[Thumbnail] 前端缩略图生成已禁用，依赖后端自动生成')
        return false
      }

      // 检查是否需要生成缩略图
      if (video.status !== 'completed' || !video.video_url) {
        return false
      }

      // 检查是否已有缩略图
      if (video.thumbnail_url && !video.thumbnail_url.startsWith('data:image/svg+xml')) {
        return false
      }


      // 动态导入避免循环依赖
      const { extractAndUploadThumbnail } = await import('../utils/videoThumbnail')

      // 🎯 从视频参数中获取 aspectRatio,默认为 16:9
      const aspectRatio = (video.parameters?.aspectRatio || '16:9') as '16:9' | '9:16'
      console.log(`[Thumbnail] 生成缩略图 - 视频ID: ${video.id}, aspectRatio: ${aspectRatio}`)

      // 先生成并上传高清缩略图（R2）
      const fullUrl = await extractAndUploadThumbnail(video.video_url, video.id, { aspectRatio })

      // 再由服务端生成模糊图（Edge Function，避免CORS）
      let blurUrl: string | null = null
      try {
        const { data, error } = await supabase.functions.invoke('generate-blur-thumbnail', {
          body: { videoId: video.id, thumbnailUrl: fullUrl, width: 48, quality: 30 }
        })
        if (error) {
          console.warn(`[Thumbnail] ⚠️ 模糊图生成失败 (Edge Function 错误): ${error.message}`)
        } else if (!data?.success) {
          console.warn(`[Thumbnail] ⚠️ 模糊图生成失败: ${data?.error || '未知错误'}`)
        } else {
          blurUrl = data.data.publicUrl as string
          console.log(`[Thumbnail] ✅ 模糊图生成成功: ${blurUrl}`)
        }
      } catch (e) {
        console.warn(`[Thumbnail] ⚠️ 模糊图生成异常:`, e)
      }

      // 更新视频记录的缩略图URL（含模糊图，失败时只写高清）
      const updateResult = await this.updateVideoAsSystem(video.id, {
        thumbnail_url: fullUrl,
        ...(blurUrl ? { thumbnail_blur_url: blurUrl } : {}),
        thumbnail_generated_at: new Date().toISOString()
      } as any)

      if (updateResult) {
        return true
      } else {
        return false
      }

    } catch (error) {
      
      // 生成失败时不更新数据库状态，仅记录日志
      
      return false
    }
  }

  /**
   * 强制重生成指定视频的缩略图（覆盖同名文件）
   * - 忽略已存在的 thumbnail_url，直接重新截帧并上传
   * - 默认将帧位从 0.1s 提前到 1.5s，规避黑/暗场
   */
  async regenerateThumbnail(
    videoId: string,
    options: { frameTime?: number } = {}
  ): Promise<{ success: boolean; url?: string; message?: string }> {
    try {
      // 检查是否启用前端缩略图生成
      const enableFrontendThumbnail = import.meta.env.VITE_ENABLE_FRONTEND_THUMBNAIL !== 'false'
      if (!enableFrontendThumbnail) {
        return {
          success: false,
          message: '前端缩略图生成已禁用，请使用后端自动生成功能'
        }
      }

      const { data: v, error } = await supabase
        .from('videos')
        .select('id, video_url, title, status, thumbnail_url')
        .eq('id', videoId)
        .single()

      if (error) {
        throw new Error(`查询视频失败: ${error.message}`)
      }

      if (!v) {
        throw new Error('未找到视频记录')
      }

      if (!v.video_url) {
        throw new Error('该视频无可用视频URL，无法生成缩略图')
      }

      // 动态导入以避免循环依赖
      const { extractAndUploadThumbnail } = await import('../utils/videoThumbnail')

      const frameTime = typeof options.frameTime === 'number' ? options.frameTime : 1.5

      // 🎯 从视频参数中获取 aspectRatio,默认为 16:9
      const aspectRatio = (v.parameters?.aspectRatio || '16:9') as '16:9' | '9:16'
      console.log(`[RegenerateThumbnail] 重新生成缩略图 - 视频ID: ${v.id}, aspectRatio: ${aspectRatio}, frameTime: ${frameTime}`)

      // 仅生成高清（R2）
      const fullUrl = await extractAndUploadThumbnail(v.video_url, v.id, { frameTime, aspectRatio })

      // Edge Function 生成模糊图
      let blurUrl: string | null = null
      try {
        const { data, error } = await supabase.functions.invoke('generate-blur-thumbnail', {
          body: { videoId: v.id, thumbnailUrl: fullUrl, width: 48, quality: 30 }
        })
        if (!error && data?.success) {
          blurUrl = data.data.publicUrl as string
        }
      } catch (e) {
        console.warn('[RegenerateThumbnail] 生成模糊图（Edge）失败:', e)
      }

      // 写回数据库
      const updated = await this.updateVideoAsSystem(v.id, { 
        thumbnail_url: fullUrl,
        ...(blurUrl ? { thumbnail_blur_url: blurUrl } : {}),
        thumbnail_generated_at: new Date().toISOString()
      } as any)
      if (!updated) {
        throw new Error('数据库更新缩略图URL失败')
      }

      return { success: true, url: fullUrl }
    } catch (e: any) {
      console.error('[SupabaseVideoService] 强制重生成缩略图失败:', e)
      return { success: false, message: e?.message || String(e) }
    }
  }

  /**
   * 🚀 批量为现有已完成视频生成缩略图
   * @param userId 用户ID（可选，不传则处理所有用户）
   * @param limit 一次处理的数量限制
   * @returns Promise<{processed: number, succeeded: number, failed: number}>
   */
  async batchGenerateThumbnails(userId?: string, limit: number = 10): Promise<{
    processed: number
    succeeded: number
    failed: number
  }> {
    console.log(`[BatchThumbnail] 开始批量生成缩略图 - 用户: ${userId || 'all'}, 限制: ${limit}`)
    
    const stats = { processed: 0, succeeded: 0, failed: 0 }
    
    try {
      // 查询需要生成缩略图的视频
      let query = supabase
        .from('videos')
        .select('id, video_url, title, status, thumbnail_url')
        .eq('status', 'completed')
        .not('video_url', 'is', null)
        .or('thumbnail_url.is.null,thumbnail_url.like.data:image/svg+xml%')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data: videos, error } = await query

      if (error) {
        throw new Error(`查询视频失败: ${error.message}`)
      }

      if (!videos || videos.length === 0) {
        console.log('[BatchThumbnail] 没有找到需要生成缩略图的视频')
        return stats
      }

      console.log(`[BatchThumbnail] 找到 ${videos.length} 个需要处理的视频`)

      // 逐个处理视频（避免并发过多）
      for (const video of videos) {
        console.log(`[BatchThumbnail] 处理视频: ${video.id} - ${video.title}`)
        
        const success = await this.autoGenerateThumbnailOnComplete(video as Video)
        
        stats.processed++
        if (success) {
          stats.succeeded++
        } else {
          stats.failed++
        }

        // 添加短暂延迟避免过载
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      console.log(`[BatchThumbnail] 批量处理完成:`, stats)
      return stats

    } catch (error) {
      console.error('[BatchThumbnail] 批量生成失败:', error)
      return stats
    }
  }
}

// 导出单例实例
export const supabaseVideoService = new SupabaseVideoService()
export default supabaseVideoService
