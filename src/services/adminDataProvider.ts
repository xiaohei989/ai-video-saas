import { DataProvider } from 'react-admin'
import { supabase } from '@/lib/supabase'
import {
  uploadThumbnail,
  uploadPreviewVideo,
  parseTemplateJson,
  validateTemplateConfig,
  deleteTemplateFiles
} from './templateFileService'
// Note: calculateSEOScore 不再使用，保存时使用快速的基础评分
// AI 智能评分通过用户点击按钮调用本地服务 API (localhost:3030)


const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

interface AdminApiRequest {
  endpoint: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
}

const adminApiCall = async ({ endpoint, method = 'GET', body }: AdminApiRequest) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      throw new Error('Not authenticated')
    }

    console.log(`[ADMIN API] Calling ${endpoint} with method ${method}`, body)

    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    console.log(`[ADMIN API] Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[ADMIN API] Error response:`, errorText)
      let error
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { error: errorText || 'API request failed' }
      }
      throw new Error(error.error || `HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log(`[ADMIN API] Success response:`, result)
    
    if (!result.success) {
      throw new Error(result.error || 'API request failed')
    }

    return result.data
  } catch (error) {
    console.error(`[ADMIN API] Call failed:`, error)
    throw error
  }
}

export const adminDataProvider: DataProvider = {
  // 获取列表数据
  getList: async (resource, params) => {
    try {
      console.log(`[DataProvider] getList called for ${resource}`, params)
      
      const { page, perPage } = params.pagination || { page: 1, perPage: 10 }
      const { field, order } = params.sort || { field: 'created_at', order: 'DESC' }
      // 销毁未使用的变量以避免警告
      void field; void order;

      // 对于logs资源，使用Supabase直接查询
      if (resource === 'logs') {
        const { data, error, count } = await supabase
          .from('admin_operations_log')
          .select(`
            *,
            admin:profiles!admin_id(username, email),
            target_user:profiles!target_id(username, email)
          `, { count: 'exact' })
          .range((page - 1) * perPage, page * perPage - 1)
          .order('created_at', { ascending: false })

        if (error) throw error

        return {
          data: data || [],
          total: count || 0,
        }
      }

      // 对于settings资源，使用Supabase直接查询
      if (resource === 'settings') {
        const { data, error, count } = await supabase
          .from('system_settings')
          .select('*', { count: 'exact' })
          .range((page - 1) * perPage, page * perPage - 1)
          .order('category', { ascending: true })

        if (error) throw error

        return {
          data: data || [],
          total: count || 0,
        }
      }

      // 对于template_seo_guides资源，使用Supabase直接查询
      if (resource === 'template_seo_guides') {
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
          `, { count: 'exact' })

        // 应用过滤器
        if (params.filter?.template_id) {
          query = query.eq('template_id', params.filter.template_id)
        }
        if (params.filter?.language) {
          query = query.eq('language', params.filter.language)
        }
        if (params.filter?.is_published) {
          query = query.eq('is_published', params.filter.is_published === 'true')
        }

        const { data, error, count } = await query
          .range((page - 1) * perPage, page * perPage - 1)
          .order('created_at', { ascending: false })

        if (error) throw error

        return {
          data: data || [],
          total: count || 0,
        }
      }

      let endpoint = ''
      let body: any = {
        pagination: { page, pageSize: perPage }
      }

      switch (resource) {
        case 'users':
          endpoint = 'admin-users'
          body.action = 'list'
          body.filters = params.filter
          break
        case 'tickets':
          endpoint = 'admin-tickets'
          body.action = 'list'
          body.filters = params.filter
          break
        case 'templates':
          endpoint = 'admin-templates'
          body.action = 'list'
          body.filters = params.filter
          console.log(`[DataProvider] Templates API call:`, { endpoint, body })
          break
        case 'faqs':
          endpoint = 'admin-tickets'
          body.action = 'list_faqs'
          body.filters = params.filter
          break
        default:
          console.warn(`[DataProvider] Unsupported resource: ${resource}, returning empty data`)
          return {
            data: [],
            total: 0,
          }
      }

      const result = await adminApiCall({ endpoint, method: 'POST', body })

      // 根据不同的resource获取正确的数据字段
      let data = []
      let total = 0

      console.log(`[DataProvider] Raw API result for ${resource}:`, result)

      if (resource === 'users' && result.users) {
        data = result.users
        total = result.pagination?.total || 0
      } else if (resource === 'tickets' && result.tickets) {
        data = result.tickets
        total = result.pagination?.total || 0
      } else if (resource === 'templates') {
        // 检查数据结构：可能是result.templates或result本身包含templates
        if (result.templates) {
          data = result.templates
          total = result.pagination?.total || result.templates.length || 0
          console.log(`[DataProvider] Templates data found:`, { 
            templatesLength: result.templates.length, 
            paginationTotal: result.pagination?.total,
            finalTotal: total 
          })
        } else if (Array.isArray(result)) {
          data = result
          total = result.length
        } else {
          console.error(`[DataProvider] Unexpected templates data structure:`, result)
        }
      } else if (resource === 'faqs' && result.faqs) {
        data = result.faqs
        total = result.pagination?.total || 0
      } else {
        console.warn(`[DataProvider] No data found for resource ${resource}`, result)
      }

      console.log(`[DataProvider] Returning data for ${resource}:`, { dataLength: data.length, total, sampleData: data[0] })

      return {
        data,
        total,
      }
    } catch (error) {
      console.error(`[DataProvider] getList error for ${resource}:`, error)
      // 返回空数据而不是抛出错误，避免白屏
      return {
        data: [],
        total: 0,
      }
    }
  },

  // 获取单个资源
  getOne: async (resource, params) => {
    try {
      console.log(`[DataProvider] getOne called for ${resource} with id:`, params.id)
      
      // 对于直接查询的资源
      if (resource === 'templates' || resource === 'settings' || resource === 'logs' || resource === 'template_seo_guides') {
        const table = resource === 'templates' ? 'templates' :
                     resource === 'settings' ? 'system_settings' :
                     resource === 'template_seo_guides' ? 'template_seo_guides' : 'admin_operations_log'

        let selectQuery = '*'
        if (resource === 'templates') {
          // 为模板添加关联查询
          selectQuery = `
            *,
            author:profiles!author_id(username, email, avatar_url),
            reviewed_by_admin:profiles!reviewed_by(username, email)
          `
        } else if (resource === 'template_seo_guides') {
          // 为SEO指南添加模板信息
          selectQuery = `
            *,
            template:templates(*)
          `
        }

        const { data, error } = await supabase
          .from(table)
          .select(selectQuery)
          .eq('id', params.id)
          .single()

        if (error) {
          console.error(`[DataProvider] getOne error for ${resource}:`, error)
          throw error
        }

        console.log(`[DataProvider] getOne result for ${resource}:`, data)
        return { data }
      }

      let endpoint = ''
      let body: any = {}

      switch (resource) {
        case 'users':
          endpoint = 'admin-users'
          body.action = 'get_details'
          body.userId = params.id
          break
        case 'tickets':
          endpoint = 'admin-tickets'
          body.action = 'get_details'
          body.ticketId = params.id
          break
        case 'faqs':
          const { data: faq } = await supabase
            .from('faq_items')
            .select('*')
            .eq('id', params.id)
            .single()
          return { data: faq }
        default:
          throw new Error(`Unsupported resource: ${resource}`)
      }

      const result = await adminApiCall({ endpoint, method: 'POST', body })
      
      // 处理不同API的响应格式
      if (resource === 'users' && result.data) {
        return { data: result.data }
      } else if (resource === 'tickets' && result.data) {
        return { data: result.data }
      }
      
      return { data: result }
    } catch (error) {
      console.error(`[DataProvider] getOne error for ${resource}:`, error)
      throw error
    }
  },

  // 创建资源
  create: async (resource, params) => {
    try {
      // 对于直接操作的资源
      if (resource === 'settings') {
        const { data, error } = await supabase
          .from('system_settings')
          .insert(params.data)
          .select()

        if (error) throw error
        return { data: data[0] }
      }

      if (resource === 'faqs') {
        const { data, error } = await supabase
          .from('faq_items')
          .insert(params.data)
          .select()

        if (error) throw error
        return { data: data[0] }
      }

      if (resource === 'template_seo_guides') {
        // 使用基础评分（快速），不使用AI评分（避免30-60秒等待）
        // 用户可以点击"AI 智能评分"按钮获取详细分析
        const contentLength = (params.data.guide_content || '').length
        const hasKeyword = params.data.target_keyword &&
          (params.data.meta_title || '').toLowerCase().includes(params.data.target_keyword.toLowerCase())
        const faqCount = (params.data.faq_items || []).length

        const contentScore = Math.min(Math.floor(contentLength / 50), 25)
        const keywordScore = hasKeyword ? 15 : 5
        const readabilityScore = contentLength > 500 ? 12 : 8
        const performanceScore = 5

        const scoreResult = {
          total_score: contentScore + keywordScore + readabilityScore + performanceScore,
          content_quality_score: contentScore,
          keyword_optimization_score: keywordScore,
          readability_score: readabilityScore,
          performance_score: performanceScore,
          keyword_density: {},
          recommendations: [
            '💡 基础评分已完成，点击"AI 智能评分"按钮获取详细的 AI 分析',
            `内容长度: ${contentLength} 字${contentLength < 1000 ? '（建议增加到1500字以上）' : ''}`,
            `Meta标题${hasKeyword ? '已包含' : '缺少'}主关键词`,
            `FAQ数量: ${faqCount} 个${faqCount < 5 ? '（建议增加到5个以上）' : ''}`
          ]
        }
        console.log('[SEO Score] 基础评分完成 - 新指南:', scoreResult)

        const { data, error } = await supabase
          .from('template_seo_guides')
          .insert({
            ...params.data,
            generated_by: params.data.generated_by || 'manual',
            review_status: 'draft',
            is_published: params.data.is_published !== undefined ? params.data.is_published : true, // 默认发布
            published_at: params.data.is_published !== false ? new Date().toISOString() : null,
            // 添加SEO评分数据
            seo_score: scoreResult.total_score,
            content_quality_score: scoreResult.content_quality_score,
            keyword_optimization_score: scoreResult.keyword_optimization_score,
            readability_score: scoreResult.readability_score,
            performance_score: scoreResult.performance_score,
            keyword_density: scoreResult.keyword_density,
            seo_recommendations: scoreResult.recommendations
          })
          .select()

        if (error) throw error
        return { data: data[0] }
      }

      let endpoint = ''
      let body: any = {}

      switch (resource) {
        case 'templates':
          // 验证模板配置
          const validation = validateTemplateConfig(params.data)
          if (!validation.valid) {
            throw new Error(`配置验证失败: ${validation.errors.join(', ')}`)
          }

          // 处理文件上传
          const templateData = { ...params.data }
          
          // 如果有缩略图文件，先上传
          if (params.data.thumbnail_file && params.data.thumbnail_file.rawFile) {
            try {
              const thumbnailUrl = await uploadThumbnail(params.data.thumbnail_file.rawFile, templateData.slug)
              templateData.thumbnail_url = thumbnailUrl
              console.log('[Templates] Thumbnail uploaded:', thumbnailUrl)
            } catch (error) {
              console.error('[Templates] Thumbnail upload failed:', error)
              throw new Error('缩略图上传失败')
            }
          }
          
          // 如果有预览视频文件，先上传
          if (params.data.preview_file && params.data.preview_file.rawFile) {
            try {
              const videoUrl = await uploadPreviewVideo(params.data.preview_file.rawFile, templateData.slug)
              templateData.preview_url = videoUrl
              console.log('[Templates] Preview video uploaded:', videoUrl)
            } catch (error) {
              console.error('[Templates] Preview video upload failed:', error)
              throw new Error('预览视频上传失败')
            }
          }

          // 如果有JSON配置文件，解析并合并
          if (params.data.config_file && params.data.config_file.rawFile) {
            try {
              const jsonConfig = await parseTemplateJson(params.data.config_file.rawFile)
              // 合并JSON配置，表单数据优先
              Object.assign(templateData, jsonConfig, params.data)
              console.log('[Templates] JSON config parsed and merged')
            } catch (error) {
              console.error('[Templates] JSON parsing failed:', error)
              throw new Error('JSON配置解析失败')
            }
          }

          // 处理JSON字符串参数
          if (typeof templateData.parameters === 'string') {
            try {
              templateData.parameters = JSON.parse(templateData.parameters)
            } catch (e) {
              console.error('Invalid parameters JSON:', e)
              throw new Error('参数配置JSON格式错误')
            }
          }

          if (typeof templateData.veo3_settings === 'string') {
            try {
              templateData.veo3_settings = JSON.parse(templateData.veo3_settings)
            } catch (e) {
              console.error('Invalid veo3_settings JSON:', e)
              throw new Error('Veo3设置JSON格式错误')
            }
          }

          // 设置默认的审核状态
          templateData.audit_status = templateData.audit_status || 'pending'
          templateData.is_active = templateData.is_active !== false
          templateData.is_public = templateData.is_public !== false

          endpoint = 'admin-templates'
          body.action = 'create'
          body.templateData = templateData
          break
        case 'tickets':
          endpoint = 'admin-tickets'
          body.action = 'create'
          body = { ...body, ...params.data }
          break
        case 'ticket-replies':
          endpoint = 'admin-tickets'
          body.action = 'reply'
          body.ticketId = params.data.ticketId
          body.content = params.data.content
          body.isInternal = params.data.isInternal
          break
        default:
          throw new Error(`Unsupported resource creation: ${resource}`)
      }

      const result = await adminApiCall({ endpoint, method: 'POST', body })
      
      // 对于回复操作，后端只返回成功消息，不返回数据
      if (resource === 'ticket-replies') {
        return { data: { id: new Date().getTime().toString(), ...params.data } }
      }
      
      return { data: { id: result?.id || new Date().getTime().toString(), ...params.data } }
    } catch (error) {
      console.error(`[DataProvider] create error for ${resource}:`, error)
      throw error
    }
  },

  // 更新资源
  update: async (resource, params) => {
    try {
      // 对于直接操作的资源
      if (resource === 'settings') {
        const { data, error } = await supabase
          .from('system_settings')
          .update(params.data)
          .eq('id', params.id)
          .select()

        if (error) throw error
        return { data: data[0] }
      }

      if (resource === 'faqs') {
        const { data, error } = await supabase
          .from('faq_items')
          .update(params.data)
          .eq('id', params.id)
          .select()

        if (error) throw error
        return { data: data[0] }
      }

      if (resource === 'template_seo_guides') {
        // 只更新基础字段和评分字段，不包含关联数据
        const updatePayload: any = {}

        // 检查是否前端已经传入了评分数据（来自AI智能评分）
        const hasScoreData = 'seo_score' in params.data ||
                           'content_quality_score' in params.data ||
                           'keyword_optimization_score' in params.data

        if (hasScoreData) {
          // 前端已提供评分数据（AI评分），直接使用
          console.log('[SEO Score] 使用前端传入的评分数据（AI智能评分）')
          if ('seo_score' in params.data) updatePayload.seo_score = params.data.seo_score
          if ('content_quality_score' in params.data) updatePayload.content_quality_score = params.data.content_quality_score
          if ('keyword_optimization_score' in params.data) updatePayload.keyword_optimization_score = params.data.keyword_optimization_score
          if ('readability_score' in params.data) updatePayload.readability_score = params.data.readability_score
          if ('performance_score' in params.data) updatePayload.performance_score = params.data.performance_score
          if ('keyword_density' in params.data) updatePayload.keyword_density = params.data.keyword_density
          if ('seo_recommendations' in params.data) updatePayload.seo_recommendations = params.data.seo_recommendations
        } else if ('guide_content' in params.data || 'meta_title' in params.data) {
          // 内容被修改但没有评分数据，计算基础评分
          console.log('[SEO Score] 内容已修改，重新计算基础评分')
          const contentLength = (params.data.guide_content || '').length
          const hasKeyword = params.data.target_keyword &&
            (params.data.meta_title || '').toLowerCase().includes(params.data.target_keyword.toLowerCase())
          const faqCount = (params.data.faq_items || []).length

          const contentScore = Math.min(Math.floor(contentLength / 50), 25)
          const keywordScore = hasKeyword ? 15 : 5
          const readabilityScore = contentLength > 500 ? 12 : 8
          const performanceScore = 5

          updatePayload.seo_score = contentScore + keywordScore + readabilityScore + performanceScore
          updatePayload.content_quality_score = contentScore
          updatePayload.keyword_optimization_score = keywordScore
          updatePayload.readability_score = readabilityScore
          updatePayload.performance_score = performanceScore
          updatePayload.keyword_density = {}
          updatePayload.seo_recommendations = [
            '💡 基础评分已完成，点击"AI 智能评分"按钮获取详细的 AI 分析',
            `内容长度: ${contentLength} 字${contentLength < 1000 ? '（建议增加到1500字以上）' : ''}`,
            `Meta标题${hasKeyword ? '已包含' : '缺少'}主关键词`,
            `FAQ数量: ${faqCount} 个${faqCount < 5 ? '（建议增加到5个以上）' : ''}`
          ]
        }

        // 只添加可直接更新的字段，排除关联对象
        const allowedFields = [
          'template_id', 'language', 'target_keyword', 'secondary_keywords',
          'long_tail_keywords', 'meta_title', 'meta_description', 'meta_keywords',
          'guide_intro', 'guide_content', 'faq_items', 'page_views',
          'avg_time_on_page', 'bounce_rate', 'conversion_rate',
          'generated_by', 'review_status', 'is_published', 'published_at'
        ]

        allowedFields.forEach(field => {
          if (field in params.data && params.data[field] !== undefined) {
            updatePayload[field] = params.data[field]
          }
        })

        const { data, error } = await supabase
          .from('template_seo_guides')
          .update(updatePayload)
          .eq('id', params.id)
          .select()

        if (error) throw error
        return { data: data[0] }
      }

      let endpoint = ''
      let body: any = {}

      switch (resource) {
        case 'users':
          if (params.data.action === 'ban') {
            endpoint = 'admin-users'
            body.action = 'ban'
            body.userId = params.id
            body.reason = params.data.reason
          } else if (params.data.action === 'unban') {
            endpoint = 'admin-users'
            body.action = 'unban'
            body.userId = params.id
          }
          break
        case 'templates':
          // 处理模板更新的文件上传
          const updateData = { ...params.data }
          
          // 如果有新的缩略图文件
          if (params.data.thumbnail_file && params.data.thumbnail_file.rawFile) {
            try {
              const thumbnailUrl = await uploadThumbnail(params.data.thumbnail_file.rawFile, updateData.slug || `template_${params.id}`)
              updateData.thumbnail_url = thumbnailUrl
            } catch (error) {
              throw new Error('缩略图上传失败')
            }
          }
          
          // 如果有新的预览视频文件
          if (params.data.preview_file && params.data.preview_file.rawFile) {
            try {
              const videoUrl = await uploadPreviewVideo(params.data.preview_file.rawFile, updateData.slug || `template_${params.id}`)
              updateData.preview_url = videoUrl
            } catch (error) {
              throw new Error('预览视频上传失败')
            }
          }

          // 处理JSON字符串
          if (typeof updateData.parameters === 'string') {
            try {
              updateData.parameters = JSON.parse(updateData.parameters)
            } catch (e) {
              throw new Error('参数配置JSON格式错误')
            }
          }

          if (typeof updateData.veo3_settings === 'string') {
            try {
              updateData.veo3_settings = JSON.parse(updateData.veo3_settings)
            } catch (e) {
              throw new Error('Veo3设置JSON格式错误')
            }
          }

          endpoint = 'admin-templates'
          body.action = 'update'
          body.templateId = params.id
          body.templateData = updateData
          break
        case 'tickets':
          endpoint = 'admin-tickets'
          if (params.data.action === 'assign') {
            body.action = 'assign'
            body.ticketId = params.id
            body.assignedAdminId = params.data.assignedAdminId
          } else if (params.data.action === 'update_status') {
            body.action = 'update_status'
            body.ticketId = params.id
            body.status = params.data.status
          } else if (params.data.action === 'reply') {
            body.action = 'reply'
            body.ticketId = params.id
            body.content = params.data.content
            body.isInternal = params.data.isInternal
          }
          break
        default:
          throw new Error(`Unsupported resource update: ${resource}`)
      }

      await adminApiCall({ endpoint, method: 'POST', body })
      return { data: { id: params.id, ...params.data } }
    } catch (error) {
      console.error(`[DataProvider] update error for ${resource}:`, error)
      throw error
    }
  },

  // 删除资源
  delete: async (resource, params) => {
    try {
      // 对于直接操作的资源
      if (resource === 'settings') {
        const { error } = await supabase
          .from('system_settings')
          .delete()
          .eq('id', params.id)

        if (error) throw error
        return { data: params.previousData || {} }
      }

      if (resource === 'faqs') {
        const { error } = await supabase
          .from('faq_items')
          .update({ is_active: false })
          .eq('id', params.id)

        if (error) throw error
        return { data: params.previousData || {} }
      }

      if (resource === 'template_seo_guides') {
        const { error } = await supabase
          .from('template_seo_guides')
          .delete()
          .eq('id', params.id)

        if (error) throw error
        return { data: params.previousData || {} }
      }

      let endpoint = ''
      let body: any = {}

      switch (resource) {
        case 'templates':
          // 先删除关联的文件
          if (params.previousData?.slug) {
            try {
              await deleteTemplateFiles(params.previousData.slug)
              console.log('[Templates] Associated files deleted')
            } catch (error) {
              console.warn('[Templates] File deletion failed:', error)
              // 不阻止模板删除，因为文件可能不存在
            }
          }

          endpoint = 'admin-templates'
          body.action = 'delete'
          body.templateId = params.id
          break
        case 'tickets':
          endpoint = 'admin-tickets'
          body.action = 'delete'
          body.ticketId = params.id
          break
        default:
          throw new Error(`Unsupported resource deletion: ${resource}`)
      }

      await adminApiCall({ endpoint, method: 'POST', body })
      return { data: params.previousData }
    } catch (error) {
      console.error(`[DataProvider] delete error for ${resource}:`, error)
      throw error
    }
  },

  // 批量删除
  deleteMany: async (resource, params) => {
    await Promise.all(
      params.ids.map(id => 
        adminDataProvider.delete(resource, { id, previousData: {} })
      )
    )
    return { data: params.ids }
  },

  // 获取多个资源
  getMany: async (resource, params) => {
    const results = await Promise.all(
      params.ids.map(id => 
        adminDataProvider.getOne(resource, { id })
      )
    )
    return { data: results.map(r => r.data) }
  },

  // 获取多个资源的引用
  getManyReference: async (resource, params) => {
    // 这里可以根据需要实现引用查询
    // 暂时使用简单的列表查询
    return adminDataProvider.getList(resource, {
      ...params,
      filter: { ...params.filter, [params.target]: params.id }
    })
  },

  // 批量更新
  updateMany: async (resource, params) => {
    await Promise.all(
      params.ids.map(id => 
        adminDataProvider.update(resource, { id, data: params.data, previousData: {} })
      )
    )
    return { data: params.ids }
  }
}

// 统计数据API
export const getAdminStats = async (period = 'day') => {
  return adminApiCall({
    endpoint: 'admin-stats',
    method: 'POST',
    body: { period }
  })
}

// 获取网站访问统计
export const getWebsiteAnalytics = async (daysBack = 7) => {
  try {
    const { data, error } = await supabase.rpc('get_website_analytics', {
      days_back: daysBack
    })

    if (error) {
      console.error('[getWebsiteAnalytics] Error:', error)
      throw error
    }

    return data?.[0] || {
      total_page_views: 0,
      unique_visitors: 0,
      total_sessions: 0,
      avg_session_duration: 0,
      bounce_rate: 0,
      page_views_today: 0,
      unique_visitors_today: 0,
      page_views_this_week: 0,
      unique_visitors_this_week: 0
    }
  } catch (error) {
    console.error('[getWebsiteAnalytics] Error:', error)
    return {
      total_page_views: 0,
      unique_visitors: 0,
      total_sessions: 0,
      avg_session_duration: 0,
      bounce_rate: 0,
      page_views_today: 0,
      unique_visitors_today: 0,
      page_views_this_week: 0,
      unique_visitors_this_week: 0
    }
  }
}

// 获取页面访问趋势
export const getPageViewTrends = async (daysBack = 30) => {
  try {
    const { data, error } = await supabase.rpc('get_page_view_trends', {
      days_back: daysBack
    })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('[getPageViewTrends] Error:', error)
    return []
  }
}

// 获取热门页面
export const getPopularPages = async (daysBack = 7, pageLimit = 10) => {
  try {
    const { data, error } = await supabase.rpc('get_popular_pages', {
      days_back: daysBack,
      page_limit: pageLimit
    })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('[getPopularPages] Error:', error)
    return []
  }
}

// 获取访客地理分布
export const getVisitorGeoDistribution = async (daysBack = 7) => {
  try {
    const { data, error } = await supabase.rpc('get_visitor_geo_distribution', {
      days_back: daysBack
    })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('[getVisitorGeoDistribution] Error:', error)
    return []
  }
}

// 获取设备类型分布
export const getDeviceDistribution = async (daysBack = 7) => {
  try {
    const { data, error } = await supabase.rpc('get_device_distribution', {
      days_back: daysBack
    })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('[getDeviceDistribution] Error:', error)
    return []
  }
}

// 获取流量来源
export const getTrafficSources = async (daysBack = 7) => {
  try {
    const { data, error } = await supabase.rpc('get_traffic_sources', {
      days_back: daysBack
    })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('[getTrafficSources] Error:', error)
    return []
  }
}