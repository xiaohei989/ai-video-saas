/**
 * AI元数据生成器
 * 负责使用AI生成视频标题、描述和智能默认值
 */

import { supabase } from '@/lib/supabase'
import aiContentService from '../aiContentService'
import type { UserManager } from './UserManager'
import type { SubmitJobRequest, AIMetadataResult } from './types'
import { QUEUE_CONSTANTS } from './config'

export class MetadataGenerator {
  constructor(private userManager: UserManager) {}

  /**
   * 获取模板名称
   */
  private async getTemplateName(templateId?: string): Promise<string> {
    if (!templateId) return '视频模板'

    try {
      const { data: template } = await supabase
        .from('templates')
        .select('name')
        .eq('id', templateId)
        .single()

      return template?.name || templateId
    } catch (error) {
      console.warn(`[METADATA GENERATOR] 获取模板名称失败: ${error}`)
      return templateId
    }
  }

  /**
   * 同步生成AI标题和简介（带超时）
   */
  async generateVideoMetadataSync(
    videoData: SubmitJobRequest['videoData'],
    userId: string,
    timeoutMs: number = QUEUE_CONSTANTS.AI_GENERATION_TIMEOUT
  ): Promise<AIMetadataResult> {
    try {
      console.log(`[METADATA GENERATOR] 🚀 开始同步生成AI标题和简介 (超时: ${timeoutMs}ms)`)

      // 获取用户语言和模板信息
      const [userLanguage, templateName] = await Promise.all([
        this.userManager.getUserLanguage(userId),
        this.getTemplateName(videoData.templateId)
      ])

      // 创建AI生成Promise（不在race中丢弃）
      const aiPromise = aiContentService.generateVideoMetadata({
        templateName,
        prompt: videoData.prompt || '',
        parameters: videoData.parameters || {},
        userLanguage
      })

      // 创建超时Promise
      const timeoutPromise = new Promise<{ status: 'timeout' }>((resolve) =>
        setTimeout(() => {
          console.log(`[METADATA GENERATOR] ⏰ AI生成超时(${timeoutMs}ms)，使用智能默认值`)
          resolve({ status: 'timeout' })
        }, timeoutMs)
      )

      // 使用Promise.race，但保持AI Promise的引用
      const raceResult = await Promise.race([
        aiPromise.then(result => ({ ...result, status: 'ai_success' })),
        timeoutPromise
      ])

      if (raceResult.status === 'ai_success') {
        // AI在超时前完成
        console.log(`[METADATA GENERATOR] ✅ AI标题生成成功:`, {
          title: raceResult.title.substring(0, 30) + '...',
          descriptionLength: raceResult.description.length
        })

        return {
          title: raceResult.title,
          description: raceResult.description,
          status: 'ai_generated'
        }
      } else {
        // 超时，使用默认值，但保持AI Promise引用用于后续处理
        const smartTitle = this.generateSmartDefaultTitle(templateName, videoData.parameters || {})
        const smartDescription = this.generateSmartDefaultDescription(templateName, videoData.prompt || '', videoData.parameters || {})

        console.log(`[METADATA GENERATOR] ⚠️ 使用超时默认值，但保持AI Promise用于延迟处理`)

        return {
          title: videoData.title || smartTitle,
          description: videoData.description || smartDescription,
          status: 'timeout_default',
          aiPromise // 保持引用，用于延迟处理
        }
      }
    } catch (error) {
      console.error(`[METADATA GENERATOR] AI标题生成失败，使用回退方案: ${error}`)
      const templateName = await this.getTemplateName(videoData.templateId)

      return {
        title: videoData.title || templateName,
        description: videoData.description || `基于模板"${templateName}"生成的AI视频内容。`,
        status: 'error_fallback'
      }
    }
  }

  /**
   * 异步生成视频标题和简介（不阻塞主流程）
   */
  generateVideoMetadataAsync(
    videoId: string,
    videoData: SubmitJobRequest['videoData'],
    userId: string,
    isRetry: boolean = false,
    retryCount: number = 0
  ): void {
    const maxRetries = QUEUE_CONSTANTS.AI_MAX_RETRIES

    // 异步执行，不等待结果
    (async () => {
      try {
        const retryText = isRetry ? ` (重试 ${retryCount + 1}/${maxRetries})` : ''
        console.log(`[METADATA GENERATOR] 🤖 开始为视频 ${videoId} 异步生成AI标题和简介${retryText}`)

        // 获取用户语言和模板信息
        const [userLanguage, templateName] = await Promise.all([
          this.userManager.getUserLanguage(userId),
          this.getTemplateName(videoData.templateId)
        ])

        // 生成AI标题和简介 - 给异步更新更多时间
        const metadata = await Promise.race([
          aiContentService.generateVideoMetadata({
            templateName: templateName,
            prompt: videoData.prompt || '',
            parameters: videoData.parameters || {},
            userLanguage: userLanguage
          }),
          // 异步更新时使用更长的超时时间（15秒）
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('异步AI生成超时')), QUEUE_CONSTANTS.ASYNC_AI_GENERATION_TIMEOUT)
          )
        ])

        console.log(`[METADATA GENERATOR] ✅ 异步AI生成成功:`, {
          videoId,
          title: metadata.title.substring(0, 30) + '...',
          descriptionLength: metadata.description.length,
          isRetry
        })

        // 更新视频记录，但只更新状态为timeout_default或error_fallback的记录
        const { error: updateError } = await supabase
          .from('videos')
          .update({
            title: metadata.title,
            description: metadata.description,
            ai_title_status: 'ai_generated',
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)
          .in('ai_title_status', ['timeout_default', 'error_fallback'])

        if (updateError) {
          console.error(`[METADATA GENERATOR] 更新视频标题简介失败: ${updateError.message}`)
          throw updateError
        } else {
          console.log(`[METADATA GENERATOR] 🎉 视频 ${videoId} 异步AI标题更新成功`)
        }

      } catch (error) {
        console.error(`[METADATA GENERATOR] 异步AI生成失败 (尝试 ${retryCount + 1}): ${error}`)

        // 如果还有重试次数，延迟后重试
        if (retryCount < maxRetries) {
          const delayMs = (retryCount + 1) * 3000 // 递增延迟：3s, 6s, 9s
          console.log(`[METADATA GENERATOR] ⏰ ${delayMs / 1000}秒后进行第${retryCount + 2}次重试`)

          setTimeout(() => {
            this.generateVideoMetadataAsync(videoId, videoData, userId, true, retryCount + 1)
          }, delayMs)

          return
        }

        // 所有重试都失败，使用最终备用方案
        try {
          const templateName = await this.getTemplateName(videoData.templateId)
          const smartTitle = this.generateSmartDefaultTitle(templateName, videoData.parameters || {})
          const smartDescription = this.generateSmartDefaultDescription(
            templateName,
            videoData.prompt || '',
            videoData.parameters || {}
          )

          await supabase
            .from('videos')
            .update({
              title: smartTitle,
              description: smartDescription
            })
            .eq('id', videoId)

          console.log(`[METADATA GENERATOR] 📝 所有AI重试失败，使用最终智能备用方案: ${smartTitle}`)
        } catch (fallbackError) {
          console.error(`[METADATA GENERATOR] 最终备用方案也失败: ${fallbackError}`)
        }
      }
    })().catch((error: any) => {
      // 静默处理异步错误，避免影响主流程
      console.error(`[METADATA GENERATOR] AI标题生成异步任务失败: ${error}`)
    })
  }

  /**
   * 处理延迟到达的AI结果
   */
  handleDelayedAIResult(videoId: string, aiPromise: Promise<any>): void {
    console.log(`[METADATA GENERATOR] 🚀 启动延迟AI结果处理: ${videoId}`)

    // 给AI一些额外时间完成，最多等待2分钟
    const startTime = Date.now()

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('延迟AI处理超时')), QUEUE_CONSTANTS.DELAYED_AI_MAX_WAIT)
    )

    Promise.race([aiPromise, timeoutPromise])
      .then(async (result: { title: string; description: string }) => {
        const waitTime = Date.now() - startTime
        console.log(`[METADATA GENERATOR] 🎉 延迟AI结果到达: ${videoId}, 等待时间: ${waitTime}ms`)

        try {
          // 检查视频记录是否仍然存在且为超时默认状态
          const { data: video, error } = await supabase
            .from('videos')
            .select('id, ai_title_status, title, description')
            .eq('id', videoId)
            .single()

          if (error) {
            console.error(`[METADATA GENERATOR] 获取视频记录失败: ${error.message}`)
            return
          }

          if (!video) {
            console.warn(`[METADATA GENERATOR] 视频记录不存在: ${videoId}`)
            return
          }

          // 只有在状态为timeout_default时才更新
          if (video.ai_title_status === 'timeout_default') {
            const { error: updateError } = await supabase
              .from('videos')
              .update({
                title: result.title,
                description: result.description,
                ai_title_status: 'ai_generated',
                updated_at: new Date().toISOString()
              })
              .eq('id', videoId)

            if (updateError) {
              console.error(`[METADATA GENERATOR] 延迟更新失败: ${updateError.message}`)
            } else {
              console.log(`[METADATA GENERATOR] ✅ 延迟AI结果更新成功: ${videoId}`)
              console.log(`[METADATA GENERATOR] 📝 标题: ${result.title.substring(0, 40)}...`)
            }
          } else {
            console.log(`[METADATA GENERATOR] ⚠️ 视频状态已变更，跳过延迟更新: ${video.ai_title_status}`)
          }

        } catch (error) {
          console.error(`[METADATA GENERATOR] 延迟处理时发生错误: ${error}`)
        }
      })
      .catch((error) => {
        const waitTime = Date.now() - startTime
        if (error.message === '延迟AI处理超时') {
          console.warn(`[METADATA GENERATOR] ⏰ 延迟AI处理超时: ${videoId}, 等待时间: ${waitTime}ms`)
        } else {
          console.error(`[METADATA GENERATOR] 延迟AI处理失败: ${videoId}`, error)
        }
      })
  }

  /**
   * 生成智能默认标题（超时时使用，比简单模板名称更有吸引力）
   */
  private generateSmartDefaultTitle(templateName: string, parameters: Record<string, any>): string {
    // 基于模板名称和参数生成更有吸引力的标题
    const paramValues = Object.values(parameters).filter(v => typeof v === 'string' && v.trim().length > 0)

    // 如果有参数，尝试结合参数生成标题
    if (paramValues.length > 0) {
      const firstParam = paramValues[0] as string
      const words = firstParam.split(' ').slice(0, 3) // 取前3个词

      if (words.length > 0) {
        const capitalizedWords = words.map(word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ')

        // 根据模板类型生成不同风格的标题
        if (templateName.toLowerCase().includes('animal')) {
          return `${capitalizedWords} Adventure`
        } else if (templateName.toLowerCase().includes('magic')) {
          return `Magical ${capitalizedWords}`
        } else if (templateName.toLowerCase().includes('street') || templateName.toLowerCase().includes('city')) {
          return `Urban ${capitalizedWords}`
        } else if (templateName.toLowerCase().includes('product') || templateName.toLowerCase().includes('tech')) {
          return `${capitalizedWords} Showcase`
        } else {
          return `${capitalizedWords} Story`
        }
      }
    }

    // 如果没有参数，基于模板名称生成吸引人的标题
    const baseTitle = templateName.replace(/[_-]/g, ' ').trim()

    // 添加一些吸引人的词语
    const enhancers = ['Epic', 'Amazing', 'Incredible', 'Stunning', 'Creative', 'Unique', 'Fantastic']
    const randomEnhancer = enhancers[Math.floor(Math.random() * enhancers.length)]

    return `${randomEnhancer} ${baseTitle}`
  }

  /**
   * 生成智能默认描述（超时时使用，比简单模板描述更详细）
   */
  private generateSmartDefaultDescription(templateName: string, prompt: string, parameters: Record<string, any>): string {
    const shortPrompt = prompt.length > 80 ? prompt.substring(0, 80) + '...' : prompt
    const paramCount = Object.keys(parameters).length

    // 基于模板和提示词生成描述
    let description = ''

    if (shortPrompt.trim()) {
      description = `AI-generated video featuring "${shortPrompt}"`
    } else {
      description = `Creative AI video based on the ${templateName} template`
    }

    // 添加参数信息
    if (paramCount > 0) {
      description += ` with ${paramCount} custom parameter${paramCount > 1 ? 's' : ''}`
    }

    // 根据模板类型添加特色描述
    const lowerTemplate = templateName.toLowerCase()
    if (lowerTemplate.includes('animal')) {
      description += ', showcasing amazing animal performances'
    } else if (lowerTemplate.includes('magic')) {
      description += ', featuring magical elements and special effects'
    } else if (lowerTemplate.includes('street') || lowerTemplate.includes('city')) {
      description += ', capturing urban life and street scenes'
    } else if (lowerTemplate.includes('product')) {
      description += ', highlighting product features and design'
    } else if (lowerTemplate.includes('tech')) {
      description += ', demonstrating cutting-edge technology'
    } else {
      description += ', delivering engaging visual storytelling'
    }

    return description + '.'
  }

  /**
   * 生成备用标题（当AI生成失败时使用）
   */
  private _generateFallbackTitle(videoData: SubmitJobRequest['videoData']): string {
    const timestamp = new Date().toLocaleDateString('zh-CN')
    const baseTitle = videoData.title || '创意AI视频'

    // 如果原标题太短，添加一些描述性内容
    if (baseTitle.length < 10) {
      return `${baseTitle} - ${timestamp}`
    }

    return baseTitle
  }

  /**
   * 生成备用简介（当AI生成失败时使用）
   */
  private _generateFallbackDescription(videoData: SubmitJobRequest['videoData']): string {
    const prompt = videoData.prompt || ''
    const shortPrompt = prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt

    return `基于创意提示"${shortPrompt}"生成的AI视频内容，展现独特的视觉效果和创意表达。`
  }
}