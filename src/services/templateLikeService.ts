/**
 * Template Like Service
 * 管理模板点赞功能的服务类（统一UUID版本）
 */

import { supabase, ensureValidSession } from '@/lib/supabase'
import { likesCacheService } from '@/services/likesCacheService'
import edgeCacheClient from '@/services/EdgeFunctionCacheClient'

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
  
  // 🚀 竞态条件保护：防止同一用户对同一模板的并发操作
  private readonly pendingOperations = new Map<string, Promise<ToggleLikeResult>>()
  private readonly operationLocks = new Set<string>()

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
    // 🚀 竞态条件保护：生成操作键，防止同一用户对同一模板的并发操作
    const { data: { user } } = await supabase.auth.getUser()
    const operationKey = `${user?.id}-${templateId}`
    
    // 检查是否有正在进行的操作
    const existingOperation = this.pendingOperations.get(operationKey)
    if (existingOperation) {
      console.log(`[TemplateLikeService] 检测到并发操作，等待现有操作完成: ${templateId}`)
      return await existingOperation
    }

    // 创建新的操作Promise
    const operationPromise = this.executeToggleLike(templateId)
    this.pendingOperations.set(operationKey, operationPromise)

    try {
      const result = await operationPromise
      return result
    } finally {
      // 清理操作记录
      this.pendingOperations.delete(operationKey)
    }
  }

  /**
   * 🚀 Ultra重构：极简点赞切换操作
   * 基于一致性优先架构，最小化查询次数，直接信任数据库结果
   */
  private async executeToggleLike(templateId: string): Promise<ToggleLikeResult> {
    try {
      console.log(`[TemplateLikeService] 🎯 Ultra重构点赞操作: ${templateId}`)

      // 🚀 步骤1：快速认证检查
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return {
          success: false,
          is_liked: false,
          like_count: 0,
          error: '请先登录'
        }
      }

      // 是否启用RPC（默认关闭以避免会话/策略导致的静默失败）
      const useRpc = (import.meta as any).env?.VITE_USE_LIKE_RPC === 'true'

      if (useRpc) {
        // 🚀 路径A：调用数据库RPC，原子化切换并返回最终状态
        console.log(`[TemplateLikeService] ⚡ 调用RPC: toggle_template_like`)
        const { data: rpcResult, error: rpcError } = await supabase.rpc('toggle_template_like', {
          p_template_id: templateId
        })

        if (rpcError) {
          console.warn(`[TemplateLikeService] ⚠️ RPC 调用失败，回退到直接DB路径:`, rpcError)
        } else {
          const resultRow = Array.isArray(rpcResult) ? (rpcResult[0] || {}) : (rpcResult as any || {})
          const finalIsLiked = Boolean(resultRow.is_liked)
          const finalLikeCount = Number(resultRow.like_count || 0)

          console.log(`[TemplateLikeService] ✅ RPC 完成: ${finalIsLiked ? '已点赞' : '未点赞'}, 点赞数: ${finalLikeCount}`)

          // 🚀 缓存更新由useLike统一管理，避免双重更新冲突

          // 🚀 失效Redis统计缓存键
          try { await edgeCacheClient.delete(`template:${templateId}:stats`) } catch {}

          return { success: true, is_liked: finalIsLiked, like_count: finalLikeCount }
        }
      }

      // 🚀 路径B：回退到直接数据库操作（默认）
      {
        if (useRpc) {
          console.warn(`[TemplateLikeService] ⚠️ RPC 调用失败或未返回有效结果，回退到直接DB路径`)
        } else {
          console.log(`[TemplateLikeService] 使用直接DB路径进行点赞切换`)
        }
        // 🚀 改进的原子化操作：先查询当前状态，再进行相应的操作和更新
        try {
          // 步骤1：查询当前用户的点赞状态和模板点赞总数
          const [userLikeResult, templateResult] = await Promise.all([
            supabase
              .from('template_likes')
              .select('id')
              .eq('user_id', user.id)
              .eq('template_id', templateId)
              .maybeSingle(),
            supabase
              .from('templates')
              .select('like_count')
              .eq('id', templateId)
              .single()
          ])

          if (templateResult.error) throw templateResult.error
          
          const currentUserLiked = !!userLikeResult.data
          const currentLikeCount = templateResult.data?.like_count || 0
          
          console.log(`[TemplateLikeService] 🔍 当前状态: 用户${currentUserLiked ? '已点赞' : '未点赞'}, 总点赞数: ${currentLikeCount}`)

          let finalIsLiked: boolean
          let finalLikeCount: number

          if (currentUserLiked) {
            // 用户当前已点赞 -> 取消点赞
            const { error: deleteError } = await supabase
              .from('template_likes')
              .delete()
              .eq('user_id', user.id)
              .eq('template_id', templateId)

            if (deleteError) throw deleteError

            finalIsLiked = false
            finalLikeCount = Math.max(0, currentLikeCount - 1)
            
            console.log(`[TemplateLikeService] ✅ 取消点赞成功: ${currentLikeCount} -> ${finalLikeCount}`)
          } else {
            // 用户当前未点赞 -> 添加点赞
            const { error: insertError } = await supabase
              .from('template_likes')
              .insert({ user_id: user.id, template_id: templateId })
            
            if (insertError && insertError.code !== '23505') { // 忽略唯一冲突
              throw insertError
            }

            finalIsLiked = true
            finalLikeCount = currentLikeCount + 1
            
            console.log(`[TemplateLikeService] ✅ 添加点赞成功: ${currentLikeCount} -> ${finalLikeCount}`)
          }

          // 步骤2：更新模板的点赞总数（确保数据一致性）
          const { error: updateError } = await supabase
            .from('templates')
            .update({ like_count: finalLikeCount })
            .eq('id', templateId)

          if (updateError) {
            console.warn(`[TemplateLikeService] ⚠️ 更新模板点赞数失败:`, updateError)
            // 不抛出错误，因为主要操作（点赞/取消点赞）已经成功
          } else {
            console.log(`[TemplateLikeService] ✅ 模板点赞数已更新: ${finalLikeCount}`)
          }

          // 🚀 缓存更新由useLike统一管理，避免双重更新冲突
          try { await edgeCacheClient.delete(`template:${templateId}:stats`) } catch {}

          return {
            success: true,
            is_liked: finalIsLiked,
            like_count: finalLikeCount
          }
        } catch (fallbackErr) {
          console.error('[TemplateLikeService] 回退路径失败:', fallbackErr)
          return {
            success: false,
            is_liked: false,
            like_count: 0,
            error: '操作失败'
          }
        }
      }
    } catch (error) {
      console.error(`[TemplateLikeService] 💥 操作异常:`, error)
      return {
        success: false,
        is_liked: false,
        like_count: 0,
        error: '网络错误，请重试'
      }
    }
  }

  /**
   * 🚀 Ultra重构：简化点赞状态检查
   * 优先使用缓存，简化查询逻辑，移除复杂同步机制
   */
  async checkLikeStatus(templateId: string, options?: { forceRefresh?: boolean; silent?: boolean }): Promise<LikeStatus | null> {
    try {
      // 🚀 步骤1：优先使用缓存（可通过 forceRefresh 强制绕过）
      if (!options?.forceRefresh) {
        const cached = likesCacheService.get(templateId)
        if (cached) {
          console.log(`[TemplateLikeService] 💾 使用缓存: ${templateId}`)
          return {
            template_id: cached.template_id,
            is_liked: cached.is_liked,
            like_count: cached.like_count
          }
        }
      }

      // 🚀 步骤2：快速验证
      if (!templateId || typeof templateId !== 'string') {
        return null
      }

      // 🚀 步骤3：并行查询用户状态和模板信息（减少等待时间）
      const { data: { user } } = await supabase.auth.getUser()
      
      const queries = []
      
      // 查询模板信息（必需）
      queries.push(
        supabase
          .from('templates')
          .select('like_count')
          .eq('id', templateId)
          .single()
      )
      
      // 如果用户已登录，查询点赞状态（可选）
      if (user) {
        queries.push(
          supabase
            .from('template_likes')
            .select('id')
            .eq('user_id', user.id)
            .eq('template_id', templateId)
            .maybeSingle()
        )
      }

      // 🚀 步骤4：并行执行查询
      const results = await Promise.all(queries)
      const templateResult = results[0]
      const likeResult = user ? results[1] : null

      // 🚀 步骤5：简化结果处理
      let likeCount = 0
      let isLiked = false

      // 处理模板信息
      if (templateResult.error) {
        console.warn(`[TemplateLikeService] ⚠️ 模板 ${templateId} 不存在或查询失败`)
        likeCount = 0
      } else {
        likeCount = templateResult.data?.like_count || 0
      }

      // 处理点赞状态
      if (user && likeResult && !likeResult.error) {
        isLiked = !!likeResult.data
      }

      const status = {
        template_id: templateId,
        is_liked: isLiked,
        like_count: likeCount
      }

      // 🚀 步骤6：可选缓存结果（silent 时不写入缓存，避免覆盖乐观/最终状态）
      if (!options?.silent) {
        likesCacheService.set(templateId, status, 'api')
      }

      return status
    } catch (error) {
      console.error(`[TemplateLikeService] ❌ 检查点赞状态失败:`, error)
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

      // 🚀 优化：分批并行查询，避免单次查询数据量过大
      const BATCH_SIZE = 10 // 每批查询10个模板，平衡性能和并发数
      const uuids = uncachedIds
      
      // 分批处理未缓存的ID
      const batches = []
      for (let i = 0; i < uuids.length; i += BATCH_SIZE) {
        batches.push(uuids.slice(i, i + BATCH_SIZE))
      }
      
      console.log(`[TemplateLikeService] 🔄 分批查询: ${batches.length}批，每批${BATCH_SIZE}个，总计${uuids.length}个模板`)

      // 并行执行所有批次查询
      const batchPromises = batches.map(async (batch, batchIndex) => {
        const batchStartTime = performance.now()
        
        try {
          // 批量查询用户的点赞记录（只有登录用户才查询）
          let batchUserLikes: any[] = []
          if (user) {
            const { data: userLikes } = await supabase
              .from('template_likes')
              .select('template_id')
              .eq('user_id', user.id)
              .in('template_id', batch)
            batchUserLikes = userLikes || []
          }

          // 批量查询模板的点赞数（无论是否登录都查询）
          const { data: batchTemplates } = await supabase
            .from('templates')
            .select('id, like_count')
            .in('id', batch)
            
          const batchEndTime = performance.now()
          console.log(`[TemplateLikeService] ✅ 批次${batchIndex + 1}完成: ${batch.length}个模板，耗时${(batchEndTime - batchStartTime).toFixed(1)}ms`)
          
          return {
            userLikes: batchUserLikes,
            templates: batchTemplates || []
          }
        } catch (error) {
          console.error(`[TemplateLikeService] ❌ 批次${batchIndex + 1}失败:`, error)
          return {
            userLikes: [],
            templates: []
          }
        }
      })

      // 等待所有批次完成
      const batchResults = await Promise.all(batchPromises)
      
      // 合并所有批次的结果
      const likes = batchResults.flatMap(result => result.userLikes)
      const templates = batchResults.flatMap(result => result.templates)

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
        likesCacheService.set(templateId, result, 'api')
        
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
        like_count: status.like_count
      }))
      likesCacheService.setBatch(templateIds, allCachedStatuses, 'api')

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
