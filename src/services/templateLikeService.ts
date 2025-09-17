/**
 * Template Like Service
 * 管理模板点赞功能的服务类（统一UUID版本）
 */

import { supabase, ensureValidSession } from '@/lib/supabase'
import { likesCacheService } from '@/services/likesCacheService'

export interface TemplateWithLike {
  id: string
  name: string
  like_count: number
  is_liked: boolean
  author_id?: string
}

export interface LikeStatus {
  template_id: string
  is_liked: boolean
  like_count: number
}

export interface ToggleLikeResult {
  success: boolean
  is_liked: boolean
  like_count: number
  error?: string
}

class TemplateLikeService {
  private sessionValidated = false
  private sessionValidatedAt = 0
  private readonly SESSION_VALIDATION_TTL = 30 * 1000 // 30秒内不重复验证session

  /**
   * 优化的session验证（缓存验证结果）
   */
  private async ensureValidSessionCached(): Promise<boolean> {
    const now = Date.now()
    
    // 如果最近验证过且未过期，直接返回
    if (this.sessionValidated && (now - this.sessionValidatedAt) < this.SESSION_VALIDATION_TTL) {
      return true
    }

    try {
      await ensureValidSession()
      this.sessionValidated = true
      this.sessionValidatedAt = now
      return true
    } catch (error) {
      this.sessionValidated = false
      this.sessionValidatedAt = 0
      return false
    }
  }

  /**
   * 切换模板点赞状态（点赞/取消点赞）
   */
  async toggleLike(templateId: string): Promise<ToggleLikeResult> {
    try {
      // 确保Token有效
      const isValidSession = await this.ensureValidSessionCached()
      if (!isValidSession) {
        console.error('Token validation failed')
        return {
          success: false,
          is_liked: false,
          like_count: 0,
          error: 'Token已过期，请重新登录'
        }
      }

      // 检查用户是否已认证
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return {
          success: false,
          is_liked: false,
          like_count: 0,
          error: '请先登录'
        }
      }

      // 验证模板ID格式（现在直接使用UUID）
      if (!templateId || typeof templateId !== 'string') {
        return {
          success: false,
          is_liked: false,
          like_count: 0,
          error: '模板ID无效'
        }
      }

      // 检查当前点赞状态
      const { data: existingLike } = await supabase
        .from('template_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('template_id', templateId)
        .maybeSingle()

      // 先获取当前的点赞数量，以便准确计算新的数量
      const { data: currentTemplate } = await supabase
        .from('templates')
        .select('like_count')
        .eq('id', templateId)
        .single()

      let currentLikeCount = currentTemplate?.like_count || 0
      let isLiked: boolean
      let newLikeCount: number

      if (existingLike) {
        // 取消点赞
        const { error: deleteError } = await supabase
          .from('template_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('template_id', templateId)

        if (deleteError) {
          console.error('Error removing like:', deleteError)
          return {
            success: false,
            is_liked: true,
            like_count: currentLikeCount,
            error: '取消点赞失败'
          }
        }

        isLiked = false
        newLikeCount = Math.max(0, currentLikeCount - 1)
      } else {
        // 添加点赞
        const { error: insertError } = await supabase
          .from('template_likes')
          .insert({
            user_id: user.id,
            template_id: templateId
          })

        if (insertError) {
          console.error('Error adding like:', insertError)
          return {
            success: false,
            is_liked: false,
            like_count: currentLikeCount,
            error: '点赞失败'
          }
        }

        isLiked = true
        newLikeCount = currentLikeCount + 1
      }

      // 立即更新缓存
      likesCacheService.updateLikeStatus(templateId, isLiked, newLikeCount)

      return {
        success: true,
        is_liked: isLiked,
        like_count: newLikeCount
      }
    } catch (error) {
      console.error('Error toggling like:', error)
      return {
        success: false,
        is_liked: false,
        like_count: 0,
        error: '操作失败'
      }
    }
  }

  /**
   * 检查用户是否对特定模板点赞（优先使用缓存）
   * 未登录用户也能获取点赞数量，但is_liked始终为false
   */
  async checkLikeStatus(templateId: string): Promise<LikeStatus | null> {
    try {
      // 先检查缓存
      const cached = likesCacheService.get(templateId)
      if (cached) {
        console.log(`[TemplateLikeService] Using cached status for ${templateId}`)
        return {
          template_id: cached.template_id,
          is_liked: cached.is_liked,
          like_count: cached.like_count
        }
      }

      // 验证模板ID（现在直接使用UUID，无需转换）
      if (!templateId || typeof templateId !== 'string') {
        console.warn(`[TemplateLikeService] Invalid template ID: ${templateId}`)
        return null
      }

      // 获取当前用户信息（可能为null）
      const { data: { user } } = await supabase.auth.getUser()

      let isLiked = false
      
      // 只有登录用户才检查点赞状态
      if (user) {
        // 确保Token有效
        const isValidSession = await this.ensureValidSessionCached()
        if (isValidSession) {
          try {
            // 使用 maybeSingle() 替代 single() 避免严格模式问题
            const { data: like, error: likeError } = await supabase
              .from('template_likes')
              .select('id')
              .eq('user_id', user.id)
              .eq('template_id', templateId)
              .maybeSingle()
            
            if (likeError) {
              console.warn(`[TemplateLikeService] Like check failed for ${templateId}:`, likeError)
              // 406或其他权限错误时，默认为未点赞但不影响功能
              isLiked = false
            } else {
              isLiked = !!like
            }
          } catch (error) {
            console.warn(`[TemplateLikeService] Like check exception for ${templateId}:`, error)
            // 出现异常时默认为未点赞，不阻塞整个流程
            isLiked = false
          }
        }
      }

      // 获取模板点赞数（无论是否登录都获取）
      const { data: template } = await supabase
        .from('templates')
        .select('like_count')
        .eq('id', templateId)
        .single()

      const likeCount = template?.like_count || 0

      const status = {
        template_id: templateId,
        is_liked: isLiked,
        like_count: likeCount
      }

      // 缓存结果
      likesCacheService.set(templateId, status)

      return status
    } catch (error) {
      console.error('Error checking like status:', error)
      return null
    }
  }

  /**
   * 批量检查多个模板的点赞状态（优先使用缓存）
   */
  async checkMultipleLikeStatus(templateIds: string[]): Promise<LikeStatus[]> {
    try {
      if (templateIds.length === 0) return []

      // 先检查批量缓存
      const cachedBatch = likesCacheService.getBatch(templateIds)
      if (cachedBatch) {
        return templateIds.map(id => {
          const cached = cachedBatch.get(id)
          return cached ? {
            template_id: cached.template_id,
            is_liked: cached.is_liked,
            like_count: cached.like_count
          } : {
            template_id: id,
            is_liked: false,
            like_count: 0
          }
        })
      }

      // 检查哪些模板有单独的缓存
      const uncachedIds: string[] = []
      const cachedResults: LikeStatus[] = []

      templateIds.forEach(id => {
        const cached = likesCacheService.get(id)
        if (cached) {
          cachedResults.push({
            template_id: cached.template_id,
            is_liked: cached.is_liked,
            like_count: cached.like_count
          })
        } else {
          uncachedIds.push(id)
        }
      })

      // 如果所有数据都在缓存中
      if (uncachedIds.length === 0) {
        return cachedResults
      }


      const { data: { user } } = await supabase.auth.getUser()
      
      // 只有已登录用户才需要验证Token
      if (user) {
        const isValidSession = await this.ensureValidSessionCached()
        if (!isValidSession) {
          console.error('Token validation failed in checkMultipleLikeStatus for logged-in user')
          const defaultResults = uncachedIds.map(id => ({
            template_id: id,
            is_liked: false,
            like_count: 0
          }))
          return [...cachedResults, ...defaultResults]
        }
      }

      if (uncachedIds.length === 0) {
        return cachedResults
      }

      // 直接使用UUID查询，无需转换
      const uuids = uncachedIds

      // 批量查询用户的点赞记录（只有登录用户才查询）
      let likes: any[] = []
      if (user) {
        const { data: userLikes } = await supabase
          .from('template_likes')
          .select('template_id')
          .eq('user_id', user.id)
          .in('template_id', uuids)
        likes = userLikes || []
      }

      // 批量查询模板的点赞数（无论是否登录都查询）
      const { data: templates } = await supabase
        .from('templates')
        .select('id, like_count')
        .in('id', uuids)

      // 创建点赞状态映射
      const likedTemplateUuids = new Set(likes?.map(like => like.template_id) || [])
      const templateLikeCounts = new Map(
        templates?.map(template => [template.id, template.like_count]) || []
      )

      // 为未缓存的模板创建结果
      const freshResults = uncachedIds.map(templateId => {
        const result = {
          template_id: templateId,
          is_liked: likedTemplateUuids.has(templateId),
          like_count: Number(templateLikeCounts.get(templateId)) || 0
        }
        
        // 缓存新获取的结果
        likesCacheService.set(templateId, result)
        
        return result
      })

      // 合并缓存的结果和新获取的结果，保持原始顺序
      const allResults: LikeStatus[] = []
      templateIds.forEach(templateId => {
        const cachedResult = cachedResults.find(r => r.template_id === templateId)
        if (cachedResult) {
          allResults.push(cachedResult)
        } else {
          const freshResult = freshResults.find(r => r.template_id === templateId)
          if (freshResult) {
            allResults.push(freshResult)
          }
        }
      })

      // 缓存整个批量结果
      const allCachedStatuses = allResults.map(status => ({
        template_id: status.template_id,
        is_liked: status.is_liked,
        like_count: status.like_count,
        cached_at: Date.now(),
        ttl: 30 * 60 * 1000 // 30分钟缓存
      }))
      likesCacheService.setBatch(templateIds, allCachedStatuses)

      return allResults
    } catch (error) {
      console.error('Error checking multiple like status:', error)
      return []
    }
  }

  /**
   * 获取用户点赞的模板列表
   */
  async getUserLikedTemplates(
    userId?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    templates: TemplateWithLike[]
    total: number
    page: number
    pageSize: number
  }> {
    try {
      let targetUserId = userId
      
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          return { templates: [], total: 0, page, pageSize }
        }
        targetUserId = user.id
      }

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      // 查询用户点赞的模板
      const { data: likedTemplates, error, count } = await supabase
        .from('template_likes')
        .select(`
          template_id,
          templates!inner (
            id,
            name,
            like_count,
            author_id,
            created_at
          )
        `, { count: 'exact' })
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('Error fetching user liked templates:', error)
        return { templates: [], total: 0, page, pageSize }
      }

      const templates: TemplateWithLike[] = likedTemplates?.map(item => ({
        id: item.template_id,
        name: (item.templates as any).name,
        like_count: (item.templates as any).like_count || 0,
        is_liked: true,
        author_id: (item.templates as any).author_id
      })) || []

      return {
        templates,
        total: count || 0,
        page,
        pageSize
      }
    } catch (error) {
      console.error('Error fetching user liked templates:', error)
      return { templates: [], total: 0, page, pageSize }
    }
  }

  /**
   * 获取模板的点赞用户列表
   */
  async getTemplateLikers(
    templateId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    users: any[]
    total: number
    page: number
    pageSize: number
  }> {
    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data: likers, error, count } = await supabase
        .from('template_likes')
        .select(`
          user_id,
          created_at,
          profiles!inner (
            id,
            username,
            full_name,
            avatar_url,
            is_verified
          )
        `, { count: 'exact' })
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('Error fetching template likers:', error)
        return { users: [], total: 0, page, pageSize }
      }

      const users = likers?.map(liker => ({
        id: liker.user_id,
        username: (liker.profiles as any).username,
        full_name: (liker.profiles as any).full_name,
        avatar_url: (liker.profiles as any).avatar_url,
        is_verified: (liker.profiles as any).is_verified,
        liked_at: liker.created_at
      })) || []

      return {
        users,
        total: count || 0,
        page,
        pageSize
      }
    } catch (error) {
      console.error('Error fetching template likers:', error)
      return { users: [], total: 0, page, pageSize }
    }
  }

  /**
   * 获取热门模板（按点赞数排序）
   */
  async getPopularTemplates(
    limit: number = 10,
    timeframe?: 'day' | 'week' | 'month' | 'all'
  ): Promise<TemplateWithLike[]> {
    try {
      let query = supabase
        .from('templates')
        .select('id, name, like_count, author_id, created_at')
        .eq('is_public', true)
        .order('like_count', { ascending: false })
        .limit(limit)

      // 根据时间范围过滤
      if (timeframe && timeframe !== 'all') {
        let startDate: Date
        const now = new Date()
        
        switch (timeframe) {
          case 'day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            break
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
          default:
            startDate = new Date(0)
        }
        
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data: templates, error } = await query

      if (error) {
        console.error('Error fetching popular templates:', error)
        return []
      }

      // 检查当前用户的点赞状态
      const { data: { user } } = await supabase.auth.getUser()
      let userLikedTemplateIds: Set<string> = new Set()

      if (user && templates?.length) {
        const templateIds = templates.map(t => t.id)
        const { data: likes } = await supabase
          .from('template_likes')
          .select('template_id')
          .eq('user_id', user.id)
          .in('template_id', templateIds)
        
        userLikedTemplateIds = new Set(likes?.map(like => like.template_id) || [])
      }

      return templates?.map(template => ({
        id: template.id,
        name: template.name,
        like_count: template.like_count || 0,
        is_liked: userLikedTemplateIds.has(template.id),
        author_id: template.author_id
      })) || []
    } catch (error) {
      console.error('Error fetching popular templates:', error)
      return []
    }
  }

  /**
   * 获取用户的点赞统计
   */
  async getUserLikeStats(userId?: string): Promise<{
    totalLiked: number
    totalReceived: number
    recentLikes: number
  }> {
    try {
      let targetUserId = userId
      
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          return { totalLiked: 0, totalReceived: 0, recentLikes: 0 }
        }
        targetUserId = user.id
      }

      // 用户点赞的总数
      const { count: totalLiked } = await supabase
        .from('template_likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId)

      // 用户创作的模板收到的点赞总数
      const { data: userTemplates } = await supabase
        .from('templates')
        .select('like_count')
        .eq('author_id', targetUserId)

      const totalReceived = userTemplates?.reduce((sum, template) => 
        sum + (template.like_count || 0), 0
      ) || 0

      // 最近7天的点赞数
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const { count: recentLikes } = await supabase
        .from('template_likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId)
        .gte('created_at', sevenDaysAgo.toISOString())

      return {
        totalLiked: totalLiked || 0,
        totalReceived,
        recentLikes: recentLikes || 0
      }
    } catch (error) {
      console.error('Error fetching user like stats:', error)
      return { totalLiked: 0, totalReceived: 0, recentLikes: 0 }
    }
  }
}

// 导出单例实例
export const templateLikeService = new TemplateLikeService()
export default templateLikeService