/**
 * Template Sync Service
 * 模板同步服务 - 自动同步JSON模板文件到数据库
 */

import { supabase } from '@/lib/supabase'
import { templateList } from '@/features/video-creator/data/templates'

export interface TemplateSyncResult {
  success: boolean
  total: number
  created: number
  updated: number
  skipped: number
  errors: string[]
  details: {
    created: string[]
    updated: string[]
    skipped: string[]
    failed: Array<{ id: string; error: string }>
  }
}

export interface TemplateRecord {
  id: string
  slug: string
  name: any
  description?: any
  thumbnail_url?: string
  preview_url?: string
  category?: string
  credit_cost: number
  tags: string[]
  parameters?: any
  prompt_template?: string
  veo3_settings?: any
  like_count: number
  is_active: boolean
  is_public: boolean
  version: string
}

// 将数据库模板数据转换为前端JSON格式（保留原有功能）
export const convertDatabaseToFrontendFormat = (dbTemplate: any) => {
  return {
    id: dbTemplate.id,
    slug: dbTemplate.slug,
    name: dbTemplate.name,
    icon: "🎬", // 默认图标
    description: dbTemplate.description || "",
    previewUrl: dbTemplate.preview_url,
    thumbnailUrl: dbTemplate.thumbnail_url,
    category: dbTemplate.category,
    tags: dbTemplate.tags || [],
    credits: dbTemplate.credit_cost,
    version: dbTemplate.version || "1.0.0",
    createdAt: dbTemplate.created_at,
    lastModified: dbTemplate.updated_at,
    promptTemplate: dbTemplate.prompt_template,
    params: dbTemplate.parameters || {},
    veo3Settings: dbTemplate.veo3_settings || {}
  }
}

class TemplateSyncService {
  private isRunning = false

  /**
   * 将JSON模板对象转换为数据库记录格式
   */
  private convertTemplateToRecord(template: any): TemplateRecord {
    return {
      id: template.id,
      slug: template.slug || template.id,
      name: typeof template.name === 'string' ? template.name : JSON.stringify(template.name || { en: template.id }),
      description: typeof template.description === 'string' ? template.description : JSON.stringify(template.description || ''),
      thumbnail_url: null, // JSON文件中没有缩略图URL
      preview_url: template.previewUrl || null,
      category: template.category || null,
      credit_cost: Number(template.credits) || 0,
      tags: Array.isArray(template.tags) ? template.tags : [],
      parameters: template.params || {},
      prompt_template: JSON.stringify(template.promptTemplate || {}),
      veo3_settings: template.veo3Settings || {},
      like_count: 0, // 新模板默认0赞
      is_active: true,
      is_public: true, // 默认公开
      version: template.version || '1.0.0'
    }
  }

  /**
   * 检查模板是否需要更新（比较版本和关键字段）
   */
  private needsUpdate(jsonTemplate: any, dbTemplate: any): boolean {
    // 比较版本号
    if (jsonTemplate.version !== dbTemplate.version) {
      return true
    }

    // 比较关键字段
    const convertedRecord = this.convertTemplateToRecord(jsonTemplate)
    const keyFields = ['name', 'description', 'credit_cost', 'tags', 'preview_url']
    
    for (const field of keyFields) {
      const jsonValue = JSON.stringify(convertedRecord[field])
      const dbValue = JSON.stringify(dbTemplate[field])
      if (jsonValue !== dbValue) {
        return true
      }
    }

    return false
  }

  /**
   * 批量同步所有模板
   */
  async syncAllTemplates(options: {
    dryRun?: boolean
    batchSize?: number
    cleanupOrphaned?: boolean
  } = {}): Promise<TemplateSyncResult> {
    const {
      dryRun = false,
      batchSize = 20,
      cleanupOrphaned = false
    } = options

    if (this.isRunning) {
      throw new Error('模板同步正在进行中，请稍后再试')
    }

    this.isRunning = true
    const startTime = performance.now()

    try {
      console.log(`[TemplateSyncService] 🚀 开始同步模板 (${dryRun ? '预览模式' : '执行模式'})`)
      console.log(`[TemplateSyncService] 📊 发现 ${templateList.length} 个模板文件`)

      const result: TemplateSyncResult = {
        success: true,
        total: templateList.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        details: {
          created: [],
          updated: [],
          skipped: [],
          failed: []
        }
      }

      // 分批处理模板
      const batches = []
      for (let i = 0; i < templateList.length; i += batchSize) {
        batches.push(templateList.slice(i, i + batchSize))
      }

      // 获取现有的数据库模板
      const { data: existingTemplates, error: fetchError } = await supabase
        .from('templates')
        .select('*')

      if (fetchError) {
        console.error('[TemplateSyncService] ❌ 获取现有模板失败:', fetchError)
        result.success = false
        result.errors.push(`获取现有模板失败: ${fetchError.message}`)
        return result
      }

      const existingTemplatesMap = new Map(
        existingTemplates?.map(t => [t.id, t]) || []
      )

      console.log(`[TemplateSyncService] 📋 数据库中已有 ${existingTemplates?.length || 0} 个模板`)

      // 处理每个批次
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`[TemplateSyncService] 🔄 处理批次 ${batchIndex + 1}/${batches.length} (${batch.length} 个模板)`)

        for (const template of batch) {
          try {
            // 转换为数据库格式
            const record = this.convertTemplateToRecord(template)
            const existing = existingTemplatesMap.get(template.id)

            if (!existing) {
              // 新模板 - 需要创建
              if (!dryRun) {
                const { error: insertError } = await supabase
                  .from('templates')
                  .insert(record)

                if (insertError) {
                  console.error(`[TemplateSyncService] ❌ 创建模板失败 ${template.id}:`, insertError)
                  result.errors.push(`创建模板 ${template.id} 失败: ${insertError.message}`)
                  result.details.failed.push({
                    id: template.id,
                    error: insertError.message
                  })
                  continue
                }
              }

              result.created++
              result.details.created.push(template.id)
              console.log(`[TemplateSyncService] ✅ ${dryRun ? '[预览]' : ''} 创建模板: ${template.id}`)

            } else if (this.needsUpdate(template, existing)) {
              // 现有模板 - 需要更新
              if (!dryRun) {
                const updateData = { ...record }
                // 保留现有的点赞数
                delete (updateData as any).like_count

                const { error: updateError } = await supabase
                  .from('templates')
                  .update({
                    ...updateData,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', template.id)

                if (updateError) {
                  console.error(`[TemplateSyncService] ❌ 更新模板失败 ${template.id}:`, updateError)
                  result.errors.push(`更新模板 ${template.id} 失败: ${updateError.message}`)
                  result.details.failed.push({
                    id: template.id,
                    error: updateError.message
                  })
                  continue
                }
              }

              result.updated++
              result.details.updated.push(template.id)
              console.log(`[TemplateSyncService] 🔄 ${dryRun ? '[预览]' : ''} 更新模板: ${template.id}`)

            } else {
              // 模板无变化 - 跳过
              result.skipped++
              result.details.skipped.push(template.id)
            }

          } catch (error) {
            console.error(`[TemplateSyncService] ❌ 处理模板失败 ${template.id}:`, error)
            result.errors.push(`处理模板 ${template.id} 失败: ${error}`)
            result.details.failed.push({
              id: template.id,
              error: String(error)
            })
          }
        }

        // 批次间短暂延迟，避免过载
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(1)

      console.log(`[TemplateSyncService] 🎉 同步完成! 耗时: ${duration}ms`)
      console.log(`[TemplateSyncService] 📊 统计: 创建${result.created}, 更新${result.updated}, 跳过${result.skipped}, 失败${result.details.failed.length}`)

      if (result.errors.length > 0) {
        result.success = false
        console.warn(`[TemplateSyncService] ⚠️ 同步过程中发生 ${result.errors.length} 个错误`)
      }

      return result

    } catch (error) {
      console.error('[TemplateSyncService] ❌ 同步失败:', error)
      return {
        success: false,
        total: templateList.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [String(error)],
        details: {
          created: [],
          updated: [],
          skipped: [],
          failed: []
        }
      }
    } finally {
      this.isRunning = false
    }
  }

  /**
   * 同步单个模板
   */
  async syncSingleTemplate(templateId: string): Promise<boolean> {
    try {
      const template = templateList.find(t => t.id === templateId)
      if (!template) {
        console.error(`[TemplateSyncService] ❌ 未找到模板: ${templateId}`)
        return false
      }

      const record = this.convertTemplateToRecord(template)

      // 检查是否已存在
      const { data: existing } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (existing) {
        // 更新现有模板
        const { error } = await supabase
          .from('templates')
          .update({
            ...record,
            updated_at: new Date().toISOString()
          })
          .eq('id', templateId)

        if (error) {
          console.error(`[TemplateSyncService] ❌ 更新模板失败: ${templateId}`, error)
          return false
        }

        console.log(`[TemplateSyncService] ✅ 更新模板: ${templateId}`)
      } else {
        // 创建新模板
        const { error } = await supabase
          .from('templates')
          .insert(record)

        if (error) {
          console.error(`[TemplateSyncService] ❌ 创建模板失败: ${templateId}`, error)
          return false
        }

        console.log(`[TemplateSyncService] ✅ 创建模板: ${templateId}`)
      }

      return true
    } catch (error) {
      console.error(`[TemplateSyncService] ❌ 同步单个模板失败: ${templateId}`, error)
      return false
    }
  }

  /**
   * 获取同步状态统计
   */
  async getSyncStatus(): Promise<{
    jsonTemplateCount: number
    dbTemplateCount: number
    missingInDb: string[]
    extraInDb: string[]
    needsUpdate: string[]
  }> {
    try {
      const { data: dbTemplates } = await supabase
        .from('templates')
        .select('id, version, name, credit_cost, tags')

      const jsonTemplateIds = new Set(templateList.map(t => t.id))
      const dbTemplateIds = new Set(dbTemplates?.map(t => t.id) || [])
      const dbTemplatesMap = new Map(dbTemplates?.map(t => [t.id, t]) || [])

      const missingInDb = templateList
        .filter(t => !dbTemplateIds.has(t.id))
        .map(t => t.id)

      const extraInDb = Array.from(dbTemplateIds)
        .filter(id => !jsonTemplateIds.has(id))

      const needsUpdate = templateList
        .filter(t => {
          const dbTemplate = dbTemplatesMap.get(t.id)
          return dbTemplate && this.needsUpdate(t, dbTemplate)
        })
        .map(t => t.id)

      return {
        jsonTemplateCount: templateList.length,
        dbTemplateCount: dbTemplates?.length || 0,
        missingInDb,
        extraInDb,
        needsUpdate
      }
    } catch (error) {
      console.error('[TemplateSyncService] ❌ 获取同步状态失败:', error)
      return {
        jsonTemplateCount: templateList.length,
        dbTemplateCount: 0,
        missingInDb: [],
        extraInDb: [],
        needsUpdate: []
      }
    }
  }

  /**
   * 检查是否正在同步
   */
  isSyncRunning(): boolean {
    return this.isRunning
  }
}

// 导出单例实例
export const templateSyncService = new TemplateSyncService()
export default templateSyncService

// 同步单个模板到前端文件系统
export const syncTemplateToFrontend = async (templateId: string): Promise<void> => {
  try {
    // 从数据库获取模板数据
    const { data: template, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (error || !template) {
      throw new Error('模板不存在或获取失败')
    }

    // 转换为前端格式
    const frontendTemplate = convertDatabaseToFrontendFormat(template)

    // 生成JSON文件内容
    const jsonContent = JSON.stringify(frontendTemplate, null, 2)

    // 创建并下载JSON文件（实际部署时可以直接写入文件系统）
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${template.slug}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log(`[TemplateSync] Template ${template.slug} synced to frontend`)
  } catch (error) {
    console.error('[TemplateSync] Sync failed:', error)
    throw error
  }
}

// 批量同步所有已批准的模板到前端
export const syncAllTemplatesToFrontend = async (): Promise<{
  success: number
  failed: number
  errors: string[]
}> => {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  }

  try {
    // 获取所有已批准的模板
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .eq('audit_status', 'approved')
      .eq('is_active', true)

    if (error) throw error

    // 处理每个模板
    for (const template of templates || []) {
      try {
        const frontendTemplate = convertDatabaseToFrontendFormat(template)
        
        // 这里在实际部署时应该写入文件系统
        // 现在仅作为示例生成下载
        console.log(`[TemplateSync] Would sync template: ${template.slug}`, frontendTemplate)
        
        result.success++
      } catch (error) {
        result.failed++
        result.errors.push(`${template.slug}: ${error}`)
      }
    }

    return result
  } catch (error) {
    console.error('[TemplateSync] Bulk sync failed:', error)
    throw error
  }
}

// 验证模板配置完整性
export const validateTemplateForSync = (template: any): { valid: boolean; issues: string[] } => {
  const issues: string[] = []

  // 检查必要字段
  if (!template.name) issues.push('缺少模板名称')
  if (!template.slug) issues.push('缺少URL标识')
  if (!template.prompt_template) issues.push('缺少提示词模板')
  if (!template.credit_cost) issues.push('缺少积分设置')

  // 检查文件路径
  if (!template.preview_url) issues.push('缺少预览视频')
  
  // 检查参数配置
  if (!template.parameters || Object.keys(template.parameters).length === 0) {
    issues.push('参数配置为空')
  }

  // 检查审核状态
  if (template.audit_status !== 'approved') {
    issues.push('模板未通过审核')
  }

  return {
    valid: issues.length === 0,
    issues
  }
}

// 生成模板使用说明文档
export const generateTemplateDocumentation = (template: any): string => {
  const params = template.parameters || {}
  
  let doc = `# ${template.name}\n\n`
  doc += `**描述**: ${template.description || '暂无描述'}\n\n`
  doc += `**分类**: ${template.category}\n\n`
  doc += `**积分消耗**: ${template.credit_cost}\n\n`
  
  if (template.tags && template.tags.length > 0) {
    doc += `**标签**: ${template.tags.join(', ')}\n\n`
  }
  
  doc += `## 参数配置\n\n`
  
  if (typeof params === 'object') {
    Object.entries(params).forEach(([key, param]: [string, any]) => {
      doc += `### ${param.label || key}\n`
      doc += `- **类型**: ${param.type}\n`
      doc += `- **必需**: ${param.required ? '是' : '否'}\n`
      if (param.default) doc += `- **默认值**: ${param.default}\n`
      if (param.description) doc += `- **说明**: ${param.description}\n`
      if (param.options) {
        doc += `- **选项**:\n`
        param.options.forEach((opt: any) => {
          doc += `  - ${opt.label || opt.value}\n`
        })
      }
      doc += '\n'
    })
  }
  
  doc += `## 提示词模板\n\n`
  doc += '```\n'
  doc += template.prompt_template
  doc += '\n```\n\n'
  
  if (template.veo3_settings && Object.keys(template.veo3_settings).length > 0) {
    doc += `## Veo3设置\n\n`
    doc += '```json\n'
    doc += JSON.stringify(template.veo3_settings, null, 2)
    doc += '\n```\n'
  }
  
  return doc
}