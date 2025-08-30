/**
 * 模板同步服务
 * 处理管理员后台的模板修改与前端文件系统的同步
 */

import { supabase } from '@/lib/supabase'

// 将数据库模板数据转换为前端JSON格式
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