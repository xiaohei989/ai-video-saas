/**
 * 批量生成服务
 * 负责管理和执行SEO内容的批量生成任务
 * 协调关键词分析、内容生成、去重检测等服务
 */

import { createClient } from '@supabase/supabase-js'
import contentGenerationService, { type GenerateContentRequest, type GenerateContentResult } from './contentGenerationService'
import duplicateDetectionService from './duplicateDetectionService'
import keywordAnalysisService from './keywordAnalysisService'

// 兼容Vite和Node环境
const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || ''
  }
  return process.env[key] || ''
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL')
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

export interface CreateBatchJobRequest {
  templateId: string                  // 视频模板ID
  contentTemplateSlug: string         // 内容模板slug（how-to, alternatives, platform-specific）
  keywords: string[]                  // 关键词列表
  language: string                    // 语言
  aiModel?: 'claude' | 'gpt' | 'gemini'  // AI模型
  userId?: string                     // 用户ID
  skipDuplicateCheck?: boolean        // 是否跳过去重检测（默认false）
  autoContinueOnError?: boolean       // 错误时是否自动继续（默认true）
}

export interface BatchJobStatus {
  id: string                          // 批量任务ID
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  totalKeywords: number               // 总关键词数
  processedKeywords: number           // 已处理关键词数
  successfulPages: number             // 成功生成页面数
  failedKeywords: number              // 失败关键词数
  duplicatesDetected: number          // 检测到的重复数
  progress: number                    // 进度0-1
  startedAt?: Date                    // 开始时间
  completedAt?: Date                  // 完成时间
  estimatedTimeRemaining?: number     // 预计剩余时间（秒）
  currentKeyword?: string             // 当前处理的关键词
  errorMessage?: string               // 错误信息
}

export interface BatchJobResult {
  jobId: string
  status: BatchJobStatus
  generatedPages: GenerateContentResult[]
  failedKeywords: Array<{
    keyword: string
    reason: string
  }>
  duplicates: Array<{
    keyword: string
    similarTo: string
    similarity: number
  }>
  statistics: {
    totalTime: number                 // 总耗时（秒）
    avgTimePerPage: number            // 平均每页耗时（秒）
    totalTokensUsed: number           // 总Token使用量
    avgSEOScore: number               // 平均SEO得分
  }
}

export interface ProgressCallback {
  (status: BatchJobStatus): void
}

class BatchGenerationService {
  private readonly BATCH_DELAY = 2000  // 每个请求间隔2秒，避免API限流
  private activejobs: Map<string, boolean> = new Map()  // 追踪活跃任务

  /**
   * 创建并执行批量生成任务
   */
  async createAndExecuteBatchJob(
    request: CreateBatchJobRequest,
    onProgress?: ProgressCallback
  ): Promise<BatchJobResult> {
    console.log(`\n[BatchGen] 🚀 创建批量生成任务...`)
    console.log(`[BatchGen] 模板ID: ${request.templateId}`)
    console.log(`[BatchGen] 关键词数量: ${request.keywords.length}`)
    console.log(`[BatchGen] 语言: ${request.language}`)

    // 1. 创建批量任务记录
    const jobId = await this.createBatchJobRecord(request)
    console.log(`[BatchGen] ✅ 任务已创建: ${jobId}`)

    // 2. 标记为活跃
    this.activejobs.set(jobId, true)

    // 3. 执行批量生成
    try {
      const result = await this.executeBatchJob(jobId, request, onProgress)
      return result
    } catch (error) {
      // 标记任务失败
      await this.updateJobStatus(jobId, 'failed', {
        error_message: error instanceof Error ? error.message : '未知错误'
      })
      throw error
    } finally {
      // 移除活跃标记
      this.activejobs.delete(jobId)
    }
  }

  /**
   * 执行批量生成任务
   */
  private async executeBatchJob(
    jobId: string,
    request: CreateBatchJobRequest,
    onProgress?: ProgressCallback
  ): Promise<BatchJobResult> {
    const startTime = Date.now()

    await this.updateJobStatus(jobId, 'running', {
      started_at: new Date().toISOString()
    })

    const generatedPages: GenerateContentResult[] = []
    const failedKeywords: Array<{ keyword: string; reason: string }> = []
    const duplicates: Array<{ keyword: string; similarTo: string; similarity: number }> = []

    let processedCount = 0
    let successCount = 0
    let duplicateCount = 0

    // 逐个处理关键词
    for (let i = 0; i < request.keywords.length; i++) {
      const keyword = request.keywords[i]

      // 检查任务是否被取消
      if (!this.activejobs.get(jobId)) {
        console.log(`[BatchGen] 任务已被取消: ${jobId}`)
        await this.updateJobStatus(jobId, 'cancelled')
        break
      }

      console.log(`\n[BatchGen] 处理 ${i + 1}/${request.keywords.length}: ${keyword}`)

      // 更新进度
      const status: BatchJobStatus = {
        id: jobId,
        status: 'running',
        totalKeywords: request.keywords.length,
        processedKeywords: processedCount,
        successfulPages: successCount,
        failedKeywords: failedKeywords.length,
        duplicatesDetected: duplicateCount,
        progress: processedCount / request.keywords.length,
        currentKeyword: keyword,
        estimatedTimeRemaining: this.estimateTimeRemaining(
          startTime,
          processedCount,
          request.keywords.length
        )
      }

      onProgress?.(status)

      await this.updateJobProgress(jobId, {
        current_keyword: keyword,
        processed_keywords: processedCount,
        successful_pages: successCount,
        failed_keywords: failedKeywords.length
      })

      try {
        // 1. 生成内容
        const generateRequest: GenerateContentRequest = {
          templateId: request.templateId,
          targetKeyword: keyword,
          language: request.language,
          contentTemplateSlug: request.contentTemplateSlug,
          aiModel: request.aiModel,
          userId: request.userId
        }

        const result = await contentGenerationService.generateContent(generateRequest)
        console.log(`[BatchGen] ✅ 内容已生成: ${result.pageVariantId}`)

        // 2. 去重检测（如果启用）
        if (!request.skipDuplicateCheck) {
          const duplicateCheck = await duplicateDetectionService.checkDuplicate({
            templateId: request.templateId,
            language: request.language,
            newContent: result.content.guide_content
          })

          // 更新相似度
          await duplicateDetectionService.updateSimilarityScore(
            result.pageVariantId,
            duplicateCheck.maxSimilarity,
            duplicateCheck.isDuplicate
          )

          if (duplicateCheck.isDuplicate) {
            console.log(`[BatchGen] ⚠️ 检测到重复内容: ${keyword}`)
            duplicateCount++

            duplicates.push({
              keyword,
              similarTo: duplicateCheck.similarPages[0]?.targetKeyword || '未知',
              similarity: duplicateCheck.maxSimilarity
            })
          }
        }

        generatedPages.push(result)
        successCount++

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误'
        console.error(`[BatchGen] ❌ 生成失败: ${keyword}`, errorMsg)

        failedKeywords.push({
          keyword,
          reason: errorMsg
        })

        // 如果不自动继续，则中断
        if (!request.autoContinueOnError) {
          throw new Error(`关键词"${keyword}"生成失败: ${errorMsg}`)
        }
      }

      processedCount++

      // 延迟，避免API限流
      if (i < request.keywords.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY))
      }
    }

    // 完成任务
    const totalTime = (Date.now() - startTime) / 1000
    const avgTimePerPage = successCount > 0 ? totalTime / successCount : 0
    const totalTokensUsed = generatedPages.reduce((sum, p) => sum + p.estimatedTokensUsed, 0)
    const avgSEOScore = successCount > 0
      ? generatedPages.reduce((sum, p) => sum + p.metrics.seoScore, 0) / successCount
      : 0

    await this.updateJobStatus(jobId, 'completed', {
      completed_at: new Date().toISOString(),
      processed_keywords: processedCount,
      successful_pages: successCount,
      failed_keywords: failedKeywords.length,
      duplicates_detected: duplicateCount,
      total_time: totalTime,
      avg_seo_score: avgSEOScore
    })

    console.log(`\n[BatchGen] 🎉 批量生成完成！`)
    console.log(`[BatchGen] 📊 统计:`)
    console.log(`[BatchGen]   成功: ${successCount}`)
    console.log(`[BatchGen]   失败: ${failedKeywords.length}`)
    console.log(`[BatchGen]   重复: ${duplicateCount}`)
    console.log(`[BatchGen]   总耗时: ${totalTime.toFixed(2)}秒`)
    console.log(`[BatchGen]   平均SEO得分: ${avgSEOScore.toFixed(1)}`)

    const finalStatus: BatchJobStatus = {
      id: jobId,
      status: 'completed',
      totalKeywords: request.keywords.length,
      processedKeywords: processedCount,
      successfulPages: successCount,
      failedKeywords: failedKeywords.length,
      duplicatesDetected: duplicateCount,
      progress: 1,
      startedAt: new Date(startTime),
      completedAt: new Date()
    }

    onProgress?.(finalStatus)

    return {
      jobId,
      status: finalStatus,
      generatedPages,
      failedKeywords,
      duplicates,
      statistics: {
        totalTime,
        avgTimePerPage,
        totalTokensUsed,
        avgSEOScore
      }
    }
  }

  /**
   * 创建批量任务记录
   */
  private async createBatchJobRecord(request: CreateBatchJobRequest): Promise<string> {
    // 获取content template ID
    const { data: contentTemplate } = await getSupabase()
      .from('seo_content_templates')
      .select('id')
      .eq('slug', request.contentTemplateSlug)
      .single()

    if (!contentTemplate) {
      throw new Error(`内容模板不存在: ${request.contentTemplateSlug}`)
    }

    const { data, error } = await getSupabase()
      .from('seo_batch_jobs')
      .insert({
        template_id: request.templateId,
        content_template_id: contentTemplate.id,
        language: request.language,
        keywords: request.keywords,
        total_keywords: request.keywords.length,
        status: 'pending',
        created_by: request.userId
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`创建批量任务失败: ${error.message}`)
    }

    return data.id
  }

  /**
   * 更新任务状态
   */
  private async updateJobStatus(
    jobId: string,
    status: BatchJobStatus['status'],
    updates: Record<string, any> = {}
  ): Promise<void> {
    const { error } = await getSupabase()
      .from('seo_batch_jobs')
      .update({
        status,
        ...updates
      })
      .eq('id', jobId)

    if (error) {
      console.error('[BatchGen] 更新任务状态失败:', error)
    }
  }

  /**
   * 更新任务进度
   */
  private async updateJobProgress(
    jobId: string,
    progress: {
      current_keyword?: string
      processed_keywords?: number
      successful_pages?: number
      failed_keywords?: number
    }
  ): Promise<void> {
    const { error } = await getSupabase()
      .from('seo_batch_jobs')
      .update(progress)
      .eq('id', jobId)

    if (error) {
      console.error('[BatchGen] 更新任务进度失败:', error)
    }
  }

  /**
   * 估算剩余时间
   */
  private estimateTimeRemaining(
    startTime: number,
    processed: number,
    total: number
  ): number {
    if (processed === 0) return 0

    const elapsed = (Date.now() - startTime) / 1000
    const avgTime = elapsed / processed
    const remaining = (total - processed) * avgTime

    return Math.ceil(remaining)
  }

  /**
   * 获取任务状态
   */
  async getJobStatus(jobId: string): Promise<BatchJobStatus | null> {
    const { data, error } = await getSupabase()
      .from('seo_batch_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      status: data.status,
      totalKeywords: data.total_keywords,
      processedKeywords: data.processed_keywords || 0,
      successfulPages: data.successful_pages || 0,
      failedKeywords: data.failed_keywords || 0,
      duplicatesDetected: data.duplicates_detected || 0,
      progress: data.processed_keywords / data.total_keywords,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      currentKeyword: data.current_keyword,
      errorMessage: data.error_message
    }
  }

  /**
   * 取消任务
   */
  async cancelJob(jobId: string): Promise<void> {
    console.log(`[BatchGen] 取消任务: ${jobId}`)

    // 移除活跃标记
    this.activejobs.delete(jobId)

    // 更新数据库状态
    await this.updateJobStatus(jobId, 'cancelled', {
      completed_at: new Date().toISOString()
    })
  }

  /**
   * 暂停任务（未来实现）
   */
  async pauseJob(jobId: string): Promise<void> {
    console.log(`[BatchGen] 暂停任务: ${jobId}`)
    this.activejobs.delete(jobId)
    await this.updateJobStatus(jobId, 'paused')
  }

  /**
   * 恢复任务（未来实现）
   */
  async resumeJob(jobId: string): Promise<void> {
    console.log(`[BatchGen] 恢复任务: ${jobId}`)
    // TODO: 实现从中断点恢复
    throw new Error('暂不支持恢复任务')
  }

  /**
   * 获取所有任务列表
   */
  async listJobs(filters?: {
    templateId?: string
    status?: BatchJobStatus['status']
    limit?: number
  }): Promise<BatchJobStatus[]> {
    let query = supabase
      .from('seo_batch_jobs')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.templateId) {
      query = query.eq('template_id', filters.templateId)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error || !data) {
      return []
    }

    return data.map(job => ({
      id: job.id,
      status: job.status,
      totalKeywords: job.total_keywords,
      processedKeywords: job.processed_keywords || 0,
      successfulPages: job.successful_pages || 0,
      failedKeywords: job.failed_keywords || 0,
      duplicatesDetected: job.duplicates_detected || 0,
      progress: job.processed_keywords / job.total_keywords,
      startedAt: job.started_at ? new Date(job.started_at) : undefined,
      completedAt: job.completed_at ? new Date(job.completed_at) : undefined,
      currentKeyword: job.current_keyword,
      errorMessage: job.error_message
    }))
  }

  /**
   * 删除任务
   */
  async deleteJob(jobId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('seo_batch_jobs')
      .delete()
      .eq('id', jobId)

    if (error) {
      throw new Error(`删除任务失败: ${error.message}`)
    }
  }

  /**
   * 预分析关键词（在生成前）
   */
  async analyzeKeywordsBatch(keywords: string[]): Promise<Array<{
    keyword: string
    recommendedTemplate: string
    confidence: number
    differentiationFactors: any
  }>> {
    console.log(`[BatchGen] 📊 预分析 ${keywords.length} 个关键词...`)

    const results = keywords.map(keyword => {
      const analysis = keywordAnalysisService.analyzeKeyword(keyword)
      return {
        keyword,
        recommendedTemplate: analysis.recommendedTemplateSlug,
        confidence: analysis.confidence,
        differentiationFactors: analysis.differentiationFactors
      }
    })

    return results
  }
}

export const batchGenerationService = new BatchGenerationService()
export default batchGenerationService
