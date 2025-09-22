/**
 * Template Importer Tool
 * JSON模板文件批量导入工具
 */

import { templateSyncService, TemplateSyncResult } from '@/services/templateSyncService'
import { supabase } from '@/lib/supabase'

export interface ImportTemplate {
  id: string
  slug: string
  name: any
  description?: any
  icon?: string
  previewUrl?: string
  thumbnailUrl?: string
  blurThumbnailUrl?: string
  category?: string
  tags?: string[]
  credits?: number
  version?: string
  createdAt?: string
  lastModified?: string
  promptTemplate?: string
  params?: any
  veo3Settings?: any
}

export interface BatchImportOptions {
  dryRun?: boolean
  overwriteExisting?: boolean
  batchSize?: number
  validateOnly?: boolean
}

export interface BatchImportResult {
  success: boolean
  totalProcessed: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: string[]
  details: {
    created: Array<{ id: string; slug: string }>
    updated: Array<{ id: string; slug: string }>
    skipped: Array<{ id: string; reason: string }>
    failed: Array<{ id: string; error: string }>
  }
  duration: number
}

class TemplateImporter {
  /**
   * 验证单个模板数据格式
   */
  private validateTemplate(template: any, index: number): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const prefix = `模板 #${index + 1}`

    // 必需字段检查
    if (!template.id) {
      errors.push(`${prefix}: 缺少ID字段`)
    } else if (typeof template.id !== 'string') {
      errors.push(`${prefix}: ID必须是字符串`)
    }

    if (!template.slug) {
      errors.push(`${prefix}: 缺少slug字段`)
    } else if (typeof template.slug !== 'string') {
      errors.push(`${prefix}: slug必须是字符串`)
    }

    if (!template.name) {
      errors.push(`${prefix}: 缺少name字段`)
    }

    // 可选字段类型检查
    if (template.credits !== undefined && (typeof template.credits !== 'number' || template.credits < 0)) {
      errors.push(`${prefix}: credits必须是非负数字`)
    }

    if (template.tags !== undefined && !Array.isArray(template.tags)) {
      errors.push(`${prefix}: tags必须是数组`)
    }

    if (template.category !== undefined && typeof template.category !== 'string') {
      errors.push(`${prefix}: category必须是字符串`)
    }

    // URL格式检查
    const urlFields = ['previewUrl', 'thumbnailUrl', 'blurThumbnailUrl']
    urlFields.forEach(field => {
      if (template[field] !== undefined) {
        if (typeof template[field] !== 'string') {
          errors.push(`${prefix}: ${field}必须是字符串`)
        } else {
          try {
            new URL(template[field])
          } catch {
            // 允许相对路径
            if (!template[field].startsWith('/') && !template[field].startsWith('./')) {
              errors.push(`${prefix}: ${field}格式无效`)
            }
          }
        }
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 转换导入模板为数据库格式
   */
  private convertToDbFormat(template: ImportTemplate): any {
    return {
      id: template.id,
      slug: template.slug || template.id,
      name: typeof template.name === 'string' ? template.name : JSON.stringify(template.name || { en: template.slug }),
      description: typeof template.description === 'string' ? template.description : JSON.stringify(template.description || ''),
      thumbnail_url: template.thumbnailUrl || null,
      preview_url: template.previewUrl || null,
      category: template.category || null,
      credit_cost: Number(template.credits) || 1,
      tags: Array.isArray(template.tags) ? template.tags : [],
      parameters: template.params || {},
      prompt_template: JSON.stringify(template.promptTemplate || {}),
      veo3_settings: template.veo3Settings || {},
      like_count: 0,
      is_active: true,
      is_public: true,
      version: template.version || '1.0.0',
      audit_status: 'approved' // 默认审核通过
    }
  }

  /**
   * 批量导入模板
   */
  async importTemplates(
    templates: ImportTemplate[], 
    options: BatchImportOptions = {}
  ): Promise<BatchImportResult> {
    const {
      dryRun = false,
      overwriteExisting = false,
      batchSize = 10,
      validateOnly = false
    } = options

    const startTime = Date.now()
    
    const result: BatchImportResult = {
      success: true,
      totalProcessed: templates.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      details: {
        created: [],
        updated: [],
        skipped: [],
        failed: []
      },
      duration: 0
    }

    console.log(`[TemplateImporter] 开始导入 ${templates.length} 个模板 (${dryRun ? '预览模式' : '执行模式'})`)

    try {
      // 1. 验证所有模板
      for (let i = 0; i < templates.length; i++) {
        const validation = this.validateTemplate(templates[i], i)
        if (!validation.valid) {
          result.errors.push(...validation.errors)
          result.details.failed.push({
            id: templates[i].id || `template-${i}`,
            error: validation.errors.join('; ')
          })
          result.failed++
        }
      }

      if (validateOnly) {
        result.success = result.failed === 0
        result.duration = Date.now() - startTime
        return result
      }

      if (result.failed > 0) {
        console.warn(`[TemplateImporter] 发现 ${result.failed} 个无效模板`)
        if (!dryRun) {
          throw new Error('存在无效模板，导入终止')
        }
      }

      // 2. 获取现有模板
      const existingTemplatesMap = new Map()
      if (!dryRun) {
        const { data: existingTemplates, error } = await supabase
          .from('templates')
          .select('id, version, updated_at')

        if (error) {
          throw new Error(`获取现有模板失败: ${error.message}`)
        }

        existingTemplates?.forEach(template => {
          existingTemplatesMap.set(template.id, template)
        })

        console.log(`[TemplateImporter] 发现 ${existingTemplatesMap.size} 个现有模板`)
      }

      // 3. 分批处理模板
      const validTemplates = templates.filter((_, index) => {
        const validation = this.validateTemplate(templates[index], index)
        return validation.valid
      })

      for (let i = 0; i < validTemplates.length; i += batchSize) {
        const batch = validTemplates.slice(i, i + batchSize)
        
        console.log(`[TemplateImporter] 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(validTemplates.length / batchSize)} (${batch.length} 个模板)`)

        for (const template of batch) {
          try {
            const existing = existingTemplatesMap.get(template.id)
            const dbTemplate = this.convertToDbFormat(template)

            if (!existing) {
              // 新模板
              if (!dryRun) {
                const { error } = await supabase
                  .from('templates')
                  .insert(dbTemplate)

                if (error) {
                  throw new Error(`插入失败: ${error.message}`)
                }
              }

              result.created++
              result.details.created.push({
                id: template.id,
                slug: template.slug
              })
              console.log(`[TemplateImporter] ✅ ${dryRun ? '[预览]' : ''} 创建模板: ${template.slug}`)

            } else if (overwriteExisting) {
              // 更新现有模板
              if (!dryRun) {
                const { error } = await supabase
                  .from('templates')
                  .update({
                    ...dbTemplate,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', template.id)

                if (error) {
                  throw new Error(`更新失败: ${error.message}`)
                }
              }

              result.updated++
              result.details.updated.push({
                id: template.id,
                slug: template.slug
              })
              console.log(`[TemplateImporter] 🔄 ${dryRun ? '[预览]' : ''} 更新模板: ${template.slug}`)

            } else {
              // 跳过现有模板
              result.skipped++
              result.details.skipped.push({
                id: template.id,
                reason: '模板已存在且未启用覆盖模式'
              })
              console.log(`[TemplateImporter] ⏭️ 跳过现有模板: ${template.slug}`)
            }

          } catch (error) {
            result.failed++
            result.details.failed.push({
              id: template.id,
              error: String(error)
            })
            result.errors.push(`模板 ${template.slug}: ${error}`)
            console.error(`[TemplateImporter] ❌ 处理模板失败 ${template.slug}:`, error)
          }
        }

        // 批次间延迟
        if (i + batchSize < validTemplates.length && !dryRun) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      result.success = result.failed === 0
      result.duration = Date.now() - startTime

      console.log(`[TemplateImporter] 导入完成! 耗时: ${result.duration}ms`)
      console.log(`[TemplateImporter] 统计: 创建${result.created}, 更新${result.updated}, 跳过${result.skipped}, 失败${result.failed}`)

      return result

    } catch (error) {
      result.success = false
      result.duration = Date.now() - startTime
      result.errors.push(String(error))
      console.error('[TemplateImporter] 批量导入失败:', error)
      return result
    }
  }

  /**
   * 从JSON文件导入单个模板
   */
  async importFromJson(jsonData: string, options: BatchImportOptions = {}): Promise<BatchImportResult> {
    try {
      const template = JSON.parse(jsonData) as ImportTemplate
      return this.importTemplates([template], options)
    } catch (error) {
      return {
        success: false,
        totalProcessed: 1,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 1,
        errors: [`JSON解析失败: ${error}`],
        details: {
          created: [],
          updated: [],
          skipped: [],
          failed: [{ id: 'unknown', error: String(error) }]
        },
        duration: 0
      }
    }
  }

  /**
   * 批量导入JSON文件数组
   */
  async importFromJsonArray(jsonFiles: Array<{ name: string; content: string }>, options: BatchImportOptions = {}): Promise<BatchImportResult> {
    const templates: ImportTemplate[] = []
    const parseErrors: string[] = []

    for (const file of jsonFiles) {
      try {
        const template = JSON.parse(file.content) as ImportTemplate
        templates.push(template)
      } catch (error) {
        parseErrors.push(`文件 ${file.name}: JSON解析失败 - ${error}`)
      }
    }

    if (parseErrors.length > 0) {
      console.warn(`[TemplateImporter] ${parseErrors.length} 个文件解析失败:`, parseErrors)
    }

    if (templates.length === 0) {
      return {
        success: false,
        totalProcessed: jsonFiles.length,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: jsonFiles.length,
        errors: parseErrors,
        details: {
          created: [],
          updated: [],
          skipped: [],
          failed: jsonFiles.map((file, index) => ({
            id: file.name,
            error: parseErrors[index] || '未知错误'
          }))
        },
        duration: 0
      }
    }

    const result = await this.importTemplates(templates, options)
    
    // 合并解析错误
    result.errors.unshift(...parseErrors)
    
    return result
  }

  /**
   * 生成导入报告
   */
  generateReport(result: BatchImportResult): string {
    const { success, totalProcessed, created, updated, skipped, failed, duration, errors } = result
    
    let report = `# 模板导入报告\n\n`
    report += `**导入状态**: ${success ? '✅ 成功' : '❌ 失败'}\n`
    report += `**处理时间**: ${(duration / 1000).toFixed(2)} 秒\n`
    report += `**总计模板**: ${totalProcessed}\n\n`
    
    report += `## 统计信息\n\n`
    report += `- 🆕 创建: ${created}\n`
    report += `- 🔄 更新: ${updated}\n`
    report += `- ⏭️ 跳过: ${skipped}\n`
    report += `- ❌ 失败: ${failed}\n\n`
    
    if (result.details.created.length > 0) {
      report += `## 创建的模板\n\n`
      result.details.created.forEach(item => {
        report += `- ${item.slug} (${item.id})\n`
      })
      report += `\n`
    }
    
    if (result.details.updated.length > 0) {
      report += `## 更新的模板\n\n`
      result.details.updated.forEach(item => {
        report += `- ${item.slug} (${item.id})\n`
      })
      report += `\n`
    }
    
    if (result.details.skipped.length > 0) {
      report += `## 跳过的模板\n\n`
      result.details.skipped.forEach(item => {
        report += `- ${item.id}: ${item.reason}\n`
      })
      report += `\n`
    }
    
    if (errors.length > 0) {
      report += `## 错误信息\n\n`
      errors.forEach(error => {
        report += `- ${error}\n`
      })
      report += `\n`
    }
    
    return report
  }
}

// 导出单例实例
export const templateImporter = new TemplateImporter()
export default templateImporter