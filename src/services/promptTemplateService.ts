/**
 * AI 提示词模板服务
 * 从数据库加载和管理 AI 提示词模板
 */

import { supabase } from '@/lib/supabase'

/**
 * 提示词模板数据结构
 */
export interface AIPromptTemplate {
  id: string
  name: string
  display_name: string
  description: string | null
  category: string
  prompt_template: string
  required_variables: string[]
  optional_variables?: string[]
  expected_output_format: string | null
  output_schema: any
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * 变量替换参数
 */
export type PromptVariables = Record<string, any>

class PromptTemplateService {
  /**
   * 从数据库加载提示词模板
   * @param name 模板名称（如 'eeat-score', 'seo-score'）
   */
  async loadTemplate(name: string): Promise<AIPromptTemplate | null> {
    try {
      console.log(`[PromptTemplate] 加载提示词模板: ${name}`)

      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('name', name)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        console.error(`[PromptTemplate] 加载失败:`, error)
        throw new Error(`无法加载提示词模板 "${name}": ${error.message}`)
      }

      if (!data) {
        console.error(`[PromptTemplate] 未找到模板: ${name}`)
        return null
      }

      console.log(`[PromptTemplate] 加载成功: ${data.display_name} (v${data.version})`)

      return data as AIPromptTemplate
    } catch (error) {
      console.error(`[PromptTemplate] 加载提示词模板失败:`, error)
      throw error
    }
  }

  /**
   * 替换提示词中的变量
   * 支持 {{variable}} 语法
   *
   * @param template 提示词模板
   * @param variables 变量值映射
   */
  replaceVariables(template: string, variables: PromptVariables): string {
    let result = template

    // 替换所有 {{variable}} 格式的变量
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`
      const replacement = value !== null && value !== undefined ? String(value) : ''

      // 全局替换
      result = result.split(placeholder).join(replacement)
    }

    return result
  }

  /**
   * 加载并填充提示词模板
   *
   * @param name 模板名称
   * @param variables 变量值映射
   * @returns 填充后的提示词字符串
   */
  async buildPrompt(name: string, variables: PromptVariables): Promise<string> {
    try {
      // 1. 从数据库加载模板
      const template = await this.loadTemplate(name)

      if (!template) {
        throw new Error(`提示词模板 "${name}" 不存在`)
      }

      // 2. 验证必需变量
      const missingVars = template.required_variables.filter(
        varName => !(varName in variables)
      )

      if (missingVars.length > 0) {
        console.warn(
          `[PromptTemplate] 缺少必需变量: ${missingVars.join(', ')}`,
          '\n提供的变量:', Object.keys(variables).join(', ')
        )
        // 不抛出错误，而是用空字符串替换缺失变量
      }

      // 3. 替换变量
      const prompt = this.replaceVariables(template.prompt_template, variables)

      console.log(`[PromptTemplate] 提示词构建完成, 长度: ${prompt.length} 字符`)

      return prompt
    } catch (error) {
      console.error(`[PromptTemplate] 构建提示词失败:`, error)
      throw error
    }
  }

  /**
   * 获取所有可用的提示词模板列表
   * @param category 可选的分类过滤
   */
  async listTemplates(category?: string): Promise<AIPromptTemplate[]> {
    try {
      let query = supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name')

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query

      if (error) {
        console.error(`[PromptTemplate] 获取模板列表失败:`, error)
        throw error
      }

      return (data || []) as AIPromptTemplate[]
    } catch (error) {
      console.error(`[PromptTemplate] 获取模板列表失败:`, error)
      throw error
    }
  }

  /**
   * 更新提示词模板的使用统计
   * @param name 模板名称
   */
  async incrementUsageCount(name: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_prompt_usage', {
        template_name: name
      })

      if (error) {
        console.warn(`[PromptTemplate] 更新使用统计失败:`, error)
        // 不抛出错误，统计失败不影响主流程
      }
    } catch (error) {
      console.warn(`[PromptTemplate] 更新使用统计失败:`, error)
    }
  }
}

// 导出单例
export const promptTemplateService = new PromptTemplateService()
export default promptTemplateService
