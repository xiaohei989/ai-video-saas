import { supabase } from '@/lib/supabase'

/**
 * 模板文件管理服务
 * 处理模板的JSON配置文件和MP4预览文件的上传、下载
 */

// 上传缩略图到Supabase Storage
export const uploadThumbnail = async (file: File, templateSlug: string): Promise<string> => {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${templateSlug}_thumbnail.${fileExt}`
    const filePath = `templates/thumbnails/${fileName}`

    const { data, error } = await supabase.storage
      .from('templates')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) throw error

    // 获取公开URL
    const { data: { publicUrl } } = supabase.storage
      .from('templates')
      .getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('Thumbnail upload failed:', error)
    throw new Error('缩略图上传失败')
  }
}

// 上传预览视频到Supabase Storage
export const uploadPreviewVideo = async (file: File, templateSlug: string): Promise<string> => {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${templateSlug}_preview.${fileExt}`
    const filePath = `templates/videos/${fileName}`

    const { data, error } = await supabase.storage
      .from('templates')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) throw error

    // 获取公开URL
    const { data: { publicUrl } } = supabase.storage
      .from('templates')
      .getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('Preview video upload failed:', error)
    throw new Error('预览视频上传失败')
  }
}

// 解析JSON配置文件（适配现有模板格式）
export const parseTemplateJson = async (file: File): Promise<any> => {
  try {
    const text = await file.text()
    const config = JSON.parse(text)
    
    // 验证必要字段
    if (!config.name || !config.slug) {
      throw new Error('JSON配置文件缺少必要字段: name, slug')
    }

    // 适配现有模板格式到数据库格式
    const templateData: any = {
      name: config.name,
      slug: config.slug,
      description: config.description,
      category: config.category,
      thumbnail_url: config.thumbnailUrl, // 现有格式
      preview_url: config.previewUrl,     // 现有格式
      prompt_template: config.promptTemplate, // 现有格式
      parameters: config.params || config.parameters || {}, // 现有格式用params
      veo3_settings: config.veo3_settings || {},
      credit_cost: config.credits || config.credit_cost || 10, // 现有格式用credits
      tags: config.tags || [],
      version: config.version || '1.0.0',
      is_premium: config.is_premium || false,
      is_active: config.is_active !== false,
      is_public: config.is_public !== false,
      is_featured: config.is_featured || false
    }

    // 处理创建时间
    if (config.createdAt) {
      templateData.created_at = config.createdAt
    }

    console.log('[TemplateFileService] Parsed template config:', templateData)
    return templateData
  } catch (error) {
    console.error('JSON parsing failed:', error)
    throw new Error('JSON配置文件格式错误')
  }
}

// 批量导入模板（ZIP包含JSON和视频文件）
export const bulkImportTemplates = async (zipFile: File): Promise<{
  success: number
  failed: number
  errors: string[]
}> => {
  // TODO: 实现ZIP文件解析和批量导入
  // 1. 解压ZIP文件
  // 2. 分别处理JSON和视频文件
  // 3. 批量创建模板记录
  
  console.log('Bulk import not implemented yet')
  return {
    success: 0,
    failed: 1,
    errors: ['批量导入功能尚未实现']
  }
}

// 批量导出模板
export const bulkExportTemplates = async (templateIds: string[]): Promise<Blob> => {
  try {
    // 获取模板数据
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .in('id', templateIds)

    if (error) throw error

    // 创建导出数据
    const exportData = {
      export_date: new Date().toISOString(),
      template_count: templates?.length || 0,
      templates: templates || []
    }

    // 转换为Blob
    const jsonStr = JSON.stringify(exportData, null, 2)
    return new Blob([jsonStr], { type: 'application/json' })
  } catch (error) {
    console.error('Bulk export failed:', error)
    throw new Error('批量导出失败')
  }
}

// 删除模板文件
export const deleteTemplateFiles = async (templateSlug: string): Promise<void> => {
  try {
    // 删除缩略图
    await supabase.storage
      .from('templates')
      .remove([`templates/thumbnails/${templateSlug}_thumbnail.jpg`])

    // 删除预览视频
    await supabase.storage
      .from('templates')
      .remove([`templates/videos/${templateSlug}_preview.mp4`])

    console.log(`Template files deleted for: ${templateSlug}`)
  } catch (error) {
    console.error('Failed to delete template files:', error)
    // 不抛出错误，因为文件可能不存在
  }
}

// 验证模板配置
export const validateTemplateConfig = (config: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!config.name || config.name.trim() === '') {
    errors.push('模板名称不能为空')
  }

  if (!config.slug || config.slug.trim() === '') {
    errors.push('URL标识不能为空')
  }

  if (!config.prompt_template || config.prompt_template.trim() === '') {
    errors.push('提示词模板不能为空')
  }

  if (config.credit_cost && (config.credit_cost < 0 || config.credit_cost > 1000)) {
    errors.push('积分消耗必须在0-1000之间')
  }

  try {
    if (config.parameters && typeof config.parameters === 'string') {
      JSON.parse(config.parameters)
    }
  } catch (e) {
    errors.push('参数配置JSON格式错误')
  }

  try {
    if (config.veo3_settings && typeof config.veo3_settings === 'string') {
      JSON.parse(config.veo3_settings)
    }
  } catch (e) {
    errors.push('Veo3设置JSON格式错误')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

interface Template {
  id: string
  slug: string
  name: string
  description?: string
  category: string
  thumbnail_url?: string
  preview_url?: string
  parameters: any[]
  prompt_template: string
  veo3_settings: any
  credit_cost: number
  is_premium: boolean
  is_active: boolean
  is_public: boolean
  audit_status?: string
}