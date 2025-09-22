/**
 * Templates API Service
 * 轻量级模板数据获取服务 - 专为列表页面优化
 */

import { supabase } from '@/lib/supabase'

// 轻量级模板数据类型（仅列表页面需要的字段）
export interface TemplateListItem {
  id: string
  slug: string
  name: any // JSON object for multilingual
  description?: any // JSON object for multilingual  
  thumbnail_url?: string
  preview_url?: string
  category?: string
  credit_cost: number
  tags: string[]
  like_count: number // 从template_likes表实时计算
  is_active: boolean
  is_public: boolean
  version: string
  created_at: string
  updated_at: string
  audit_status: 'pending' | 'approved' | 'rejected' | 'needs_revision'
}

// 详细模板数据类型（创建页面需要的完整数据）
export interface TemplateDetails extends TemplateListItem {
  parameters?: any
  prompt_template?: string
  veo3_settings?: any
  admin_notes?: string
  reviewed_by?: string
  reviewed_at?: string
}

// 查询参数
export interface TemplateListParams {
  page?: number
  pageSize?: number
  category?: string
  tags?: string[]
  sort?: 'latest' | 'popular' | 'credits'
  search?: string
  auditStatus?: string
  isActive?: boolean
}

// 查询结果
export interface TemplateListResponse {
  data: TemplateListItem[]
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
}

class TemplatesApiService {
  /**
   * 简化的模板数据处理（直接使用like_count字段）
   */
  private async processTemplatesData(templates: any[]): Promise<TemplateListItem[]> {
    // 直接返回模板数据，like_count字段已经在数据库中维护
    return templates.map(template => ({
      ...template,
      like_count: template.like_count || 0 // 使用数据库中的like_count字段
    }))
  }

  /**
   * 获取模板列表（轻量级数据，用于列表页面）
   */
  async getTemplateList(params: TemplateListParams = {}): Promise<TemplateListResponse> {
    const {
      page = 1,
      pageSize = 12,
      category,
      tags = [],
      sort = 'latest',
      search,
      auditStatus = 'approved',
      isActive = true
    } = params

    try {
      // 构建查询 - 通过子查询获取实时点赞数
      let query = supabase
        .from('templates')
        .select(`
          id,
          slug,
          name,
          description,
          thumbnail_url,
          preview_url,
          category,
          credit_cost,
          tags,
          like_count,
          is_active,
          is_public,
          version,
          created_at,
          updated_at,
          audit_status
        `, { count: 'exact' })

      // 应用筛选条件
      if (auditStatus) {
        query = query.eq('audit_status', auditStatus)
      }
      
      if (isActive !== undefined) {
        query = query.eq('is_active', isActive)
      }

      query = query.eq('is_public', true) // 只显示公开模板

      if (category) {
        query = query.eq('category', category)
      }

      if (tags.length > 0) {
        query = query.contains('tags', tags)
      }

      if (search) {
        // 在name或description的JSON字段中搜索
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

      // 应用排序
      switch (sort) {
        case 'popular':
          query = query.order('like_count', { ascending: false })
          break
        case 'credits':
          query = query.order('credit_cost', { ascending: true })
          break
        case 'latest':
        default:
          query = query.order('created_at', { ascending: false })
          break
      }

      // 应用分页
      const startIndex = (page - 1) * pageSize
      query = query.range(startIndex, startIndex + pageSize - 1)

      const { data, error, count } = await query

      if (error) {
        console.error('[TemplatesApiService] 获取模板列表失败:', error)
        throw new Error(`获取模板列表失败: ${error.message}`)
      }

      // 处理模板数据（like_count已包含在查询结果中，排序已在数据库层面完成）
      const finalData = await this.processTemplatesData(data || [])

      const totalCount = count || 0
      const totalPages = Math.ceil(totalCount / pageSize)

      console.log(`[TemplatesApiService] 获取模板列表成功: ${finalData?.length || 0}/${totalCount} 个模板`)

      return {
        data: finalData,
        totalCount,
        totalPages,
        currentPage: page,
        pageSize
      }
    } catch (error) {
      console.error('[TemplatesApiService] 获取模板列表异常:', error)
      throw error
    }
  }

  /**
   * 获取模板详细信息（用于创建页面）
   */
  async getTemplateDetails(templateId: string): Promise<TemplateDetails | null> {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*') // 获取完整数据
        .eq('id', templateId)
        .eq('is_active', true)
        .eq('is_public', true)
        .eq('audit_status', 'approved')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // 记录未找到
          return null
        }
        console.error('[TemplatesApiService] 获取模板详情失败:', error)
        throw new Error(`获取模板详情失败: ${error.message}`)
      }

      console.log(`[TemplatesApiService] 获取模板详情成功: ${templateId}`)
      return data
    } catch (error) {
      console.error('[TemplatesApiService] 获取模板详情异常:', error)
      throw error
    }
  }

  /**
   * 获取模板分类列表
   */
  async getTemplateCategories(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('category')
        .eq('is_active', true)
        .eq('is_public', true)
        .eq('audit_status', 'approved')
        .not('category', 'is', null)

      if (error) {
        console.error('[TemplatesApiService] 获取分类列表失败:', error)
        throw new Error(`获取分类列表失败: ${error.message}`)
      }

      // 去重并排序
      const categories = [...new Set(data?.map(item => item.category).filter(Boolean) || [])]
      categories.sort()

      console.log(`[TemplatesApiService] 获取分类列表成功: ${categories.length} 个分类`)
      return categories
    } catch (error) {
      console.error('[TemplatesApiService] 获取分类列表异常:', error)
      throw error
    }
  }

  /**
   * 获取热门标签
   */
  async getPopularTags(limit: number = 20): Promise<Array<{ tag: string; count: number }>> {
    try {
      // 由于PostgreSQL中处理数组需要特殊查询，这里先简化实现
      const { data, error } = await supabase
        .from('templates')
        .select('tags')
        .eq('is_active', true)
        .eq('is_public', true)
        .eq('audit_status', 'approved')
        .not('tags', 'is', null)

      if (error) {
        console.error('[TemplatesApiService] 获取标签列表失败:', error)
        throw new Error(`获取标签列表失败: ${error.message}`)
      }

      // 在客户端统计标签频次
      const tagCounts = new Map<string, number>()
      
      data?.forEach(item => {
        if (Array.isArray(item.tags)) {
          item.tags.forEach(tag => {
            if (typeof tag === 'string') {
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
            }
          })
        }
      })

      // 转换为数组并按频次排序
      const sortedTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)

      console.log(`[TemplatesApiService] 获取热门标签成功: ${sortedTags.length} 个标签`)
      return sortedTags
    } catch (error) {
      console.error('[TemplatesApiService] 获取热门标签异常:', error)
      throw error
    }
  }

  /**
   * 搜索模板
   */
  async searchTemplates(
    searchTerm: string, 
    params: Omit<TemplateListParams, 'search'> = {}
  ): Promise<TemplateListResponse> {
    return this.getTemplateList({
      ...params,
      search: searchTerm
    })
  }

  /**
   * 获取推荐模板（基于点赞数和最新程度）
   */
  async getRecommendedTemplates(limit: number = 6): Promise<TemplateListItem[]> {
    try {
      // 先获取基础模板数据
      const { data, error } = await supabase
        .from('templates')
        .select(`
          id,
          slug,
          name,
          description,
          thumbnail_url,
          preview_url,
          category,
          credit_cost,
          tags,
          like_count,
          is_active,
          is_public,
          version,
          created_at,
          updated_at,
          audit_status
        `)
        .eq('is_active', true)
        .eq('is_public', true)
        .eq('audit_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50) // 获取较多数据以便筛选

      if (error) {
        console.error('[TemplatesApiService] 获取推荐模板失败:', error)
        throw new Error(`获取推荐模板失败: ${error.message}`)
      }

      // 处理模板数据（like_count已包含在查询结果中）
      const templatesWithLikes = await this.processTemplatesData(data || [])

      // 筛选至少有一定点赞数的模板，按点赞数排序
      const recommendedTemplates = templatesWithLikes
        .filter(template => template.like_count >= 1) // 至少1个赞
        .sort((a, b) => b.like_count - a.like_count)
        .slice(0, limit)

      console.log(`[TemplatesApiService] 获取推荐模板成功: ${recommendedTemplates?.length || 0} 个模板`)
      return recommendedTemplates
    } catch (error) {
      console.error('[TemplatesApiService] 获取推荐模板异常:', error)
      throw error
    }
  }

  /**
   * 获取模板统计信息
   */
  async getTemplateStats(): Promise<{
    totalTemplates: number
    totalCategories: number
    totalTags: number
    averageCredits: number
  }> {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('category, tags, credit_cost')
        .eq('is_active', true)
        .eq('is_public', true)
        .eq('audit_status', 'approved')

      if (error) {
        console.error('[TemplatesApiService] 获取统计信息失败:', error)
        throw new Error(`获取统计信息失败: ${error.message}`)
      }

      const totalTemplates = data?.length || 0
      const categories = new Set(data?.map(item => item.category).filter(Boolean))
      const allTags = new Set<string>()
      let totalCredits = 0

      data?.forEach(item => {
        if (Array.isArray(item.tags)) {
          item.tags.forEach(tag => {
            if (typeof tag === 'string') {
              allTags.add(tag)
            }
          })
        }
        totalCredits += item.credit_cost || 0
      })

      const stats = {
        totalTemplates,
        totalCategories: categories.size,
        totalTags: allTags.size,
        averageCredits: totalTemplates > 0 ? Math.round(totalCredits / totalTemplates * 10) / 10 : 0
      }

      console.log(`[TemplatesApiService] 获取统计信息成功:`, stats)
      return stats
    } catch (error) {
      console.error('[TemplatesApiService] 获取统计信息异常:', error)
      throw error
    }
  }
}

// 导出单例实例
export const templatesApiService = new TemplatesApiService()
export default templatesApiService