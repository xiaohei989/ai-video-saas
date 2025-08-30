/**
 * 模板同步工具
 * 将前端模板数据自动同步到数据库
 */

import { supabase } from '@/lib/supabase'
import { templateList } from '@/features/video-creator/data/templates/index'

export interface SyncResult {
  success: boolean
  synced: number
  updated: number
  errors: string[]
  details?: {
    newTemplates: string[]
    updatedTemplates: string[]
    skippedTemplates: string[]
  }
}

/**
 * 获取模板的版本信息
 */
function getTemplateVersion(template: any): string {
  return template.version || template.lastModified || '1.0.0'
}

/**
 * 智能同步前端模板到数据库
 * 保留现有模板的点赞数据，只更新变化的字段
 */
export async function syncTemplatesToDatabase(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    updated: 0,
    errors: [],
    details: {
      newTemplates: [],
      updatedTemplates: [],
      skippedTemplates: []
    }
  }

  try {
    console.log('开始智能同步模板到数据库...')

    // 获取所有现有模板
    const { data: existingTemplates } = await supabase
      .from('templates')
      .select('id, slug, like_count, comment_count, view_count, version, updated_at')

    const existingMap = new Map()
    existingTemplates?.forEach(t => {
      existingMap.set(t.id, t)
    })

    for (const template of templateList) {
      try {
        const existingTemplate = existingMap.get(template.id)
        const currentVersion = getTemplateVersion(template)

        if (!existingTemplate) {
          // 新模板：插入
          const { error: insertError } = await supabase
            .from('templates')
            .insert({
              id: template.id,
              name: template.name,
              slug: (template as any).slug,
              description: template.description,
              prompt_template: template.promptTemplate || (template as any).prompt_template || '',
              parameters: template.parameters || (template as any).params || {},
              category: (template as any).category,
              credit_cost: (template as any).credits || 1,
              is_public: true,
              is_active: true,
              like_count: Math.floor(Math.random() * 800) + 100,
              comment_count: 0,
              share_count: 0,
              view_count: 0,
              favorite_count: 0,
              usage_count: 0,
              tags: (template as any).tags || [],
              version: currentVersion,
              thumbnail_url: template.thumbnailUrl,
              preview_url: template.previewUrl
            })

          if (insertError) {
            console.error(`插入模板 ${template.id} 失败:`, insertError)
            result.errors.push(`${template.id}: ${insertError.message}`)
            continue
          }

          console.log(`✅ 新增模板: ${template.id}`)
          result.synced++
          result.details!.newTemplates.push(template.id)

        } else {
          // 现有模板：检查是否需要更新
          const needsUpdate = existingTemplate.version !== currentVersion

          if (needsUpdate) {
            const { error: updateError } = await supabase
              .from('templates')
              .update({
                name: template.name,
                description: template.description,
                prompt_template: template.promptTemplate || (template as any).prompt_template || '',
                parameters: template.parameters || (template as any).params || {},
                category: template.category,
                credit_cost: (template as any).credits || 1,
                tags: template.tags || [],
                version: currentVersion,
                thumbnail_url: template.thumbnailUrl,
                preview_url: template.previewUrl,
                updated_at: new Date().toISOString()
                // 注意：不更新 like_count, comment_count 等用户数据
              })
              .eq('id', template.id)

            if (updateError) {
              console.error(`更新模板 ${template.id} 失败:`, updateError)
              result.errors.push(`${template.id}: ${updateError.message}`)
              continue
            }

            console.log(`🔄 更新模板: ${template.id}`)
            result.updated++
            result.details!.updatedTemplates.push(template.id)
          } else {
            console.log(`⏭️  跳过模板: ${template.id} (无变化)`)
            result.details!.skippedTemplates.push(template.id)
          }
        }

      } catch (error) {
        console.error(`处理模板 ${template.id} 时出错:`, error)
        result.errors.push(`${template.id}: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }

    if (result.errors.length > 0) {
      result.success = false
    }

    console.log(`同步完成。新增: ${result.synced}, 更新: ${result.updated}, 错误: ${result.errors.length}`)
    return result

  } catch (error) {
    console.error('同步模板失败:', error)
    return {
      success: false,
      synced: 0,
      updated: 0,
      errors: [error instanceof Error ? error.message : '未知错误']
    }
  }
}

/**
 * 检查模板是否需要同步
 */
export async function checkTemplateSync(): Promise<{
  needsSync: boolean
  missingTemplates: string[]
  outdatedTemplates: string[]
  totalFrontendTemplates: number
  totalDbTemplates: number
}> {
  try {
    // 获取数据库中所有模板
    const { data: dbTemplates } = await supabase
      .from('templates')
      .select('id, version')

    const dbMap = new Map()
    dbTemplates?.forEach(t => {
      dbMap.set(t.id, t.version || '1.0.0')
    })

    const frontendIds = templateList.map(t => t.id)
    const missingTemplates: string[] = []
    const outdatedTemplates: string[] = []

    // 检查每个前端模板
    for (const template of templateList) {
      const dbVersion = dbMap.get(template.id)
      const frontendVersion = getTemplateVersion(template)

      if (!dbVersion) {
        missingTemplates.push(template.id)
      } else if (dbVersion !== frontendVersion) {
        outdatedTemplates.push(template.id)
      }
    }

    return {
      needsSync: missingTemplates.length > 0 || outdatedTemplates.length > 0,
      missingTemplates,
      outdatedTemplates,
      totalFrontendTemplates: templateList.length,
      totalDbTemplates: dbTemplates?.length || 0
    }
  } catch (error) {
    console.error('检查模板同步状态失败:', error)
    return {
      needsSync: true,
      missingTemplates: [],
      outdatedTemplates: [],
      totalFrontendTemplates: templateList.length,
      totalDbTemplates: 0
    }
  }
}

/**
 * 更新现有模板（可选功能）
 */
export async function updateExistingTemplates(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    updated: 0,
    errors: []
  }

  try {
    for (const template of templateList) {
      try {
        const { error: updateError } = await supabase
          .from('templates')
          .update({
            name: template.name,
            description: template.description,
            prompt_template: template.promptTemplate || (template as any).prompt_template || '',
            parameters: template.parameters || (template as any).params || {},
            category: template.category,
            credit_cost: (template as any).credits || 1,
            tags: template.tags || [],
            version: getTemplateVersion(template),
            thumbnail_url: template.thumbnailUrl,
            preview_url: template.previewUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', template.id)

        if (updateError) {
          result.errors.push(`${template.id}: ${updateError.message}`)
          continue
        }

        result.updated++
      } catch (error) {
        result.errors.push(`${template.id}: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }

    if (result.errors.length > 0) {
      result.success = false
    }

    return result
  } catch (error) {
    return {
      success: false,
      synced: 0,
      updated: 0,
      errors: [error instanceof Error ? error.message : '未知错误']
    }
  }
}

/**
 * 完整同步（包括更新现有模板）
 */
export async function fullSync(updateExisting = false): Promise<SyncResult> {
  const syncResult = await syncTemplatesToDatabase()
  
  if (updateExisting) {
    const updateResult = await updateExistingTemplates()
    return {
      success: syncResult.success && updateResult.success,
      synced: syncResult.synced + updateResult.synced,
      updated: syncResult.updated + updateResult.updated,
      errors: [...syncResult.errors, ...updateResult.errors],
      details: syncResult.details
    }
  }

  return syncResult
}

/**
 * 获取同步统计信息
 */
export async function getSyncStats() {
  try {
    const checkResult = await checkTemplateSync()
    return {
      ...checkResult,
      syncNeeded: checkResult.needsSync,
      newTemplatesCount: checkResult.missingTemplates.length,
      outdatedTemplatesCount: checkResult.outdatedTemplates.length
    }
  } catch (error) {
    console.error('获取同步统计失败:', error)
    return null
  }
}