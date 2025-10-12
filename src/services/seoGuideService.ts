/**
 * SEO Guide 服务层
 * 处理模板SEO指南的CRUD操作
 */

import { supabase } from './supabase'
import type {
  TemplateSEOGuide,
  TemplateSEOGuideInput,
  SEOGuidesStats,
  TemplateWithSEOStatus
} from '@/types/seo'

class SEOGuideService {
  /**
   * 获取所有SEO指南列表
   */
  async getAllGuides(filters?: {
    template_id?: string
    language?: string
    is_published?: boolean
    review_status?: string
  }): Promise<TemplateSEOGuide[]> {
    let query = supabase
      .from('template_seo_guides')
      .select(`
        *,
        template:templates(
          id,
          name,
          slug,
          thumbnail_url,
          category,
          tags
        )
      `)
      .order('updated_at', { ascending: false })

    if (filters?.template_id) {
      query = query.eq('template_id', filters.template_id)
    }
    if (filters?.language) {
      query = query.eq('language', filters.language)
    }
    if (filters?.is_published !== undefined) {
      query = query.eq('is_published', filters.is_published)
    }
    if (filters?.review_status) {
      query = query.eq('review_status', filters.review_status)
    }

    const { data, error } = await query

    if (error) {
      console.error('[SEOGuideService] 获取指南列表失败:', error)
      throw error
    }

    return (data || []) as any
  }

  /**
   * 获取单个SEO指南
   */
  async getGuideById(id: string): Promise<TemplateSEOGuide | null> {
    const { data, error } = await supabase
      .from('template_seo_guides')
      .select(`
        *,
        template:templates(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('[SEOGuideService] 获取指南详情失败:', error)
      throw error
    }

    return data as any
  }

  /**
   * 根据模板ID和语言获取指南
   */
  async getGuideByTemplateAndLanguage(
    templateId: string,
    language: string
  ): Promise<TemplateSEOGuide | null> {
    const { data, error } = await supabase
      .from('template_seo_guides')
      .select('*')
      .eq('template_id', templateId)
      .eq('language', language)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = 未找到记录，这是正常的
      console.error('[SEOGuideService] 获取指南失败:', error)
      throw error
    }

    return data as any
  }

  /**
   * 创建SEO指南
   */
  async createGuide(input: TemplateSEOGuideInput): Promise<TemplateSEOGuide> {
    const { data, error } = await supabase
      .from('template_seo_guides')
      .insert({
        ...input,
        generated_by: input.generated_by || 'manual',
        review_status: 'draft',
        is_published: false
      })
      .select()
      .single()

    if (error) {
      console.error('[SEOGuideService] 创建指南失败:', error)
      throw error
    }

    return data as any
  }

  /**
   * 更新SEO指南
   */
  async updateGuide(
    id: string,
    updates: Partial<TemplateSEOGuideInput>
  ): Promise<TemplateSEOGuide> {
    const { data, error } = await supabase
      .from('template_seo_guides')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[SEOGuideService] 更新指南失败:', error)
      throw error
    }

    return data as any
  }

  /**
   * 删除SEO指南
   */
  async deleteGuide(id: string): Promise<void> {
    const { error } = await supabase
      .from('template_seo_guides')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[SEOGuideService] 删除指南失败:', error)
      throw error
    }
  }

  /**
   * 发布SEO指南
   */
  async publishGuide(id: string): Promise<TemplateSEOGuide> {
    const { data, error } = await supabase
      .from('template_seo_guides')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
        review_status: 'approved'
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[SEOGuideService] 发布指南失败:', error)
      throw error
    }

    return data as any
  }

  /**
   * 取消发布SEO指南
   */
  async unpublishGuide(id: string): Promise<TemplateSEOGuide> {
    const { data, error } = await supabase
      .from('template_seo_guides')
      .update({
        is_published: false,
        unpublished_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[SEOGuideService] 取消发布失败:', error)
      throw error
    }

    return data as any
  }

  /**
   * 获取SEO指南统计信息
   */
  async getStats(): Promise<SEOGuidesStats> {
    const { data, error } = await supabase.rpc('get_seo_guides_stats')

    if (error) {
      console.error('[SEOGuideService] 获取统计信息失败:', error)
      throw error
    }

    return data as any
  }

  /**
   * 记录页面访问
   */
  async recordPageView(guideId: string, isUniqueVisitor: boolean = false): Promise<void> {
    const { error } = await supabase.rpc('record_guide_page_view', {
      p_guide_id: guideId,
      p_is_unique_visitor: isUniqueVisitor
    })

    if (error) {
      console.error('[SEOGuideService] 记录页面访问失败:', error)
    }
  }

  /**
   * 更新SEO评分
   */
  async updateSEOScore(
    guideId: string,
    keywordDensityScore: number,
    contentQualityScore: number,
    readabilityScore: number
  ): Promise<number> {
    const { data, error } = await supabase.rpc('update_seo_score', {
      p_guide_id: guideId,
      p_keyword_density_score: keywordDensityScore,
      p_content_quality_score: contentQualityScore,
      p_readability_score: readabilityScore
    })

    if (error) {
      console.error('[SEOGuideService] 更新SEO评分失败:', error)
      throw error
    }

    return data
  }

  /**
   * 获取所有模板及其SEO状态
   */
  async getTemplatesWithSEOStatus(): Promise<TemplateWithSEOStatus[]> {
    const { data, error } = await supabase
      .from('templates')
      .select(`
        id,
        name,
        slug,
        description,
        thumbnail_url,
        category,
        tags,
        seo_guides:template_seo_guides(
          id,
          language,
          seo_score,
          is_published,
          page_views
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[SEOGuideService] 获取模板SEO状态失败:', error)
      throw error
    }

    // 转换数据格式
    return (data || []).map((template: any) => ({
      ...template,
      seo_guides_count: template.seo_guides?.length || 0,
      seo_guides_published:
        template.seo_guides?.filter((g: any) => g.is_published).length || 0,
      languages_with_guides: template.seo_guides?.map((g: any) => g.language) || [],
      avg_seo_score:
        template.seo_guides?.length > 0
          ? Math.round(
              template.seo_guides.reduce((sum: number, g: any) => sum + g.seo_score, 0) /
                template.seo_guides.length
            )
          : 0,
      total_guide_views:
        template.seo_guides?.reduce((sum: number, g: any) => sum + g.page_views, 0) || 0
    }))
  }

  /**
   * 批量创建指南
   */
  async batchCreateGuides(
    templateIds: string[],
    languages: string[]
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    }

    for (const templateId of templateIds) {
      for (const language of languages) {
        try {
          // 检查是否已存在
          const existing = await this.getGuideByTemplateAndLanguage(templateId, language)
          if (existing) {
            console.log(`[SEOGuideService] 指南已存在: ${templateId} - ${language}`)
            continue
          }

          // 创建基础指南
          await this.createGuide({
            template_id: templateId,
            language,
            long_tail_keywords: [],
            primary_keyword: '',
            meta_title: '',
            meta_description: '',
            guide_content: '',
            generated_by: 'manual'
          })

          results.success++
        } catch (error) {
          results.failed++
          results.errors.push({
            template_id: templateId,
            language,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    return results
  }
}

export const seoGuideService = new SEOGuideService()
export default seoGuideService
