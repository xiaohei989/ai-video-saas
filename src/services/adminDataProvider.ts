import { DataProvider } from 'react-admin'
import { supabase } from '@/lib/supabase'
import { 
  uploadThumbnail, 
  uploadPreviewVideo, 
  parseTemplateJson,
  validateTemplateConfig,
  deleteTemplateFiles
} from './templateFileService'

// 添加初始化调试信息
console.log('[AdminDataProvider] Initializing with base URL:', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`)

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
      
      const { page, perPage } = params.pagination
      const { field, order } = params.sort || { field: 'created_at', order: 'DESC' }

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
      // 对于直接查询的资源
      if (resource === 'templates' || resource === 'settings' || resource === 'logs') {
        const table = resource === 'templates' ? 'templates' : 
                     resource === 'settings' ? 'system_settings' : 'admin_operations_log'
        
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('id', params.id)
          .single()

        if (error) throw error
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
        default:
          throw new Error(`Unsupported resource creation: ${resource}`)
      }

      const result = await adminApiCall({ endpoint, method: 'POST', body })
      return { data: { id: result.id || new Date().getTime().toString(), ...params.data } }
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

      const result = await adminApiCall({ endpoint, method: 'POST', body })
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
        return { data: params.previousData }
      }

      if (resource === 'faqs') {
        const { error } = await supabase
          .from('faq_items')
          .update({ is_active: false })
          .eq('id', params.id)

        if (error) throw error
        return { data: params.previousData }
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
    const results = await Promise.all(
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
    const results = await Promise.all(
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