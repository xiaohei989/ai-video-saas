/**
 * SEO优化相关的自定义Hook
 * 负责AI一键优化、关键词密度优化、应用优化等功能
 */

import { useState } from 'react'
import { useRefresh, useNotify, useDataProvider } from 'react-admin'
import { supabase } from '@/lib/supabase'
import { seoAIService } from '@/services/seoAIService'
import { isLocalModel } from '../AIModelContext'
import { extractFullContent, calculateKeywordDensity } from '@/services/seoScoreCalculator'
import type { SEOOptimizeRequest, KeywordOptimizeTarget, KeywordDensityOptimizeRequest } from '@/types/seo'

// 本地服务 API 配置
const SEO_SERVER_URL = 'http://localhost:3030'

interface UseSEOOptimizationOptions {
  record: any
  aiModel: string
  keywordDensity: Record<string, number>
  autoRescoreWithRetry: (dataToScore?: any, maxRetries?: number) => Promise<void>
}

export const useSEOOptimization = ({
  record,
  aiModel,
  keywordDensity,
  autoRescoreWithRetry
}: UseSEOOptimizationOptions) => {
  const refresh = useRefresh()
  const notify = useNotify()
  const dataProvider = useDataProvider()

  const [isOptimizing, setIsOptimizing] = useState(false)
  const [currentStep, setCurrentStep] = useState(0) // 当前优化步骤（1-4）
  const [optimizationResult, setOptimizationResult] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewTab, setPreviewTab] = useState(0)
  const [isOptimizingKeywords, setIsOptimizingKeywords] = useState(false)

  /**
   * AI 一键优化
   * 根据 Context 中的 aiModel 自动选择在线或本地服务
   * 本地模式：分4步执行，避免超时
   * 在线模式：一步完成
   */
  const handleOptimize = async () => {
    setIsOptimizing(true)
    setCurrentStep(0)

    try {
      // 准备基础数据
      const seoOptimizeRequest: SEOOptimizeRequest = {
        language: record.language || 'en',
        meta_title: record.meta_title,
        meta_description: record.meta_description,
        meta_keywords: record.meta_keywords,
        guide_content: record.guide_content,
        guide_intro: record.guide_intro,
        target_keyword: record.target_keyword,
        long_tail_keywords: record.long_tail_keywords,
        secondary_keywords: record.secondary_keywords,
        faq_items: record.faq_items,
        seo_score: record.seo_score || 0,
        seo_recommendations: record.seo_recommendations || []
      }

      let optimizeResult: any

      if (isLocalModel(aiModel)) {
        // 本地模式：分4步执行，避免超时
        const steps = [
          { id: 1, name: 'Meta信息', time: '30-60秒' },
          { id: 2, name: '引言', time: '20-40秒' },
          { id: 3, name: '正文内容', time: '90-120秒' },
          { id: 4, name: 'FAQ', time: '40-60秒' }
        ]

        notify('🚀 AI 分步优化开始，共4步，预计3-5分钟...', {
          type: 'info',
          autoHideDuration: 8000
        })

        // 累积结果
        const accumulatedResult: any = {
          optimized_content: {},
          key_improvements: []
        }

        // 循环执行4个步骤
        for (const step of steps) {
          setCurrentStep(step.id)

          notify(`🔄 步骤 ${step.id}/4: 正在优化${step.name}（预计${step.time}）...`, {
            type: 'info',
            autoHideDuration: 5000
          })

          console.log(`[SEO Optimize] 步骤 ${step.id}/4: ${step.name}`)

          try {
            const response = await fetch(`${SEO_SERVER_URL}/optimize-seo-content-step`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                ...seoOptimizeRequest,
                step: step.id
              })
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || `HTTP ${response.status}`)
            }

            const result = await response.json()

            if (!result.success || !result.data) {
              throw new Error(`步骤${step.id}返回格式不正确`)
            }

            // 合并结果
            accumulatedResult.optimized_content = {
              ...accumulatedResult.optimized_content,
              ...result.data.optimized_content
            }
            accumulatedResult.key_improvements.push(...result.data.key_improvements)

            notify(`✅ 步骤 ${step.id}/4: ${step.name}优化完成`, {
              type: 'success',
              autoHideDuration: 3000
            })

          } catch (stepError) {
            console.error(`[SEO Optimize] 步骤 ${step.id} 失败:`, stepError)
            notify(`⚠️ 步骤 ${step.id}/4: ${step.name}优化失败，跳过此步骤`, {
              type: 'warning',
              autoHideDuration: 4000
            })
            // 继续下一步，不中断整个流程
          }
        }

        // 生成优化摘要
        accumulatedResult.optimization_summary = `完成了${steps.length}步优化，共${accumulatedResult.key_improvements.length}个改进点`
        optimizeResult = accumulatedResult

      } else {
        // 在线模式：一步完成
        notify('🚀 AI 正在优化内容，预计需要 60-90 秒...', {
          type: 'info',
          autoHideDuration: 8000
        })

        console.log('[SEO Optimize] 调用在线 AI 服务...')
        optimizeResult = await seoAIService.optimizeSEOContent(seoOptimizeRequest, aiModel)
      }

      // 保存优化结果并显示预览
      setOptimizationResult(optimizeResult)
      setShowPreview(true)

      notify('✨ 优化完成！请查看预览并决定是否应用', {
        type: 'success',
        autoHideDuration: 6000
      })

    } catch (error) {
      console.error('[SEO Optimize] AI 优化失败:', error)

      const errorMessage = error instanceof Error ? error.message : String(error)
      const isServerDown = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')

      notify(
        isServerDown && isLocalModel(aiModel)
          ? '❌ 无法连接到本地服务 (localhost:3030)，请确保运行 npm run seo:server'
          : `❌ AI 优化失败: ${errorMessage}`,
        { type: 'error', autoHideDuration: 8000 }
      )
    } finally {
      setIsOptimizing(false)
      setCurrentStep(0)
    }
  }

  /**
   * 优化关键词密度（升级版）
   * 【5-Part升级方案】
   * 1. 扩展优化范围：检查所有类型关键词（主关键词、长尾、次要）
   * 2. 精确目标计算：基于实际词数计算精确的 currentCount 和 targetCount
   * 3. 更强AI提示：提供详细的分布计划和精确目标数量
   * 4. 自动验证：优化后重新计算密度验证达标率
   * 5. 智能重试：如果达标率 <50%，自动对未达标关键词重试一次
   */
  const handleOptimizeKeywordDensity = async () => {
    setIsOptimizingKeywords(true)

    try {
      // ============ 第0步：数据验证 ============
      if (!record.guide_content || record.guide_content.trim() === '') {
        notify('❌ 正文内容(guide_content)为空，无法进行关键词密度优化。请先生成或编写内容。', {
          type: 'error',
          autoHideDuration: 8000
        })
        setIsOptimizingKeywords(false)
        return
      }

      if (!record.faq_items || !Array.isArray(record.faq_items) || record.faq_items.length === 0) {
        console.warn('[关键词密度优化] FAQ 为空，将只优化正文内容')
      }

      const allKeywordsCount = [
        record.target_keyword,
        ...(record.long_tail_keywords || []),
        ...(record.secondary_keywords || [])
      ].filter(Boolean).length

      if (allKeywordsCount === 0) {
        notify('❌ 没有配置任何关键词，无法进行优化。请先设置主关键词或长尾关键词。', {
          type: 'error',
          autoHideDuration: 8000
        })
        setIsOptimizingKeywords(false)
        return
      }

      console.log('[关键词密度优化] 数据验证通过:', {
        guide_content_length: record.guide_content.length,
        faq_items_count: record.faq_items?.length || 0,
        keywords_count: allKeywordsCount
      })

      // ============ 第1步：提取完整内容并计算总词数 ============
      const fullContent = extractFullContent({
        meta_title: record.meta_title,
        meta_description: record.meta_description,
        meta_keywords: record.meta_keywords,
        guide_intro: record.guide_intro,
        guide_content: record.guide_content,
        faq_items: record.faq_items
      })

      // 计算总词数（按空格分词）
      const totalWords = fullContent.split(/\s+/).filter(w => w.length > 0).length

      console.log(`[关键词密度优化] 总词数: ${totalWords}`)

      // ============ ✅ 智能预检查：可行性分析 ============
      // 预估需要达到0.8%密度需要的关键词出现次数
      const estimatedOccurrencesPerKeyword = Math.round((0.8 / 100) * totalWords)
      const estimatedTotalInsertions = allKeywordsCount * estimatedOccurrencesPerKeyword
      const wordsPerKeyword = totalWords / estimatedTotalInsertions

      // 定义可行性阈值
      const isHighRisk = wordsPerKeyword < 10   // 平均每10个词就要插入1个关键词（高风险）
      const isMediumRisk = wordsPerKeyword < 20 // 平均每20个词插入1个（中风险）

      if (isHighRisk) {
        // 🚨 高风险：内容太短 + 关键词太多 = 几乎不可能自然达标
        notify(
          `🚨 可行性预警（高风险）：\n\n` +
          `📊 内容分析：\n` +
          `- 总词数: ${totalWords} 字\n` +
          `- 关键词数量: ${allKeywordsCount} 个\n` +
          `- 预估需插入: ~${estimatedTotalInsertions} 次关键词\n` +
          `- 平均密度: 每 ${wordsPerKeyword.toFixed(0)} 个词插入1个关键词\n\n` +
          `⚠️ 这可能导致关键词堆砌！建议：\n` +
          `\n` +
          `【方案A】扩展内容（推荐）\n` +
          `- 先使用"AI 一键优化"将内容扩展至 2000-2500 字\n` +
          `- 这样可将密度降低到每 ${(totalWords * 2 / estimatedTotalInsertions).toFixed(0)}-${(totalWords * 2.5 / estimatedTotalInsertions).toFixed(0)} 词1次\n\n` +
          `【方案B】筛选关键词\n` +
          `- 保留最重要的 ${Math.min(8, allKeywordsCount)} 个关键词\n` +
          `- 这样密度会降低到每 ${(totalWords / (Math.min(8, allKeywordsCount) * estimatedOccurrencesPerKeyword)).toFixed(0)} 词1次\n\n` +
          `【方案C】强制继续（不推荐）\n` +
          `- 点击"确定"继续优化，但达标率可能很低（<40%）`,
          {
            type: 'warning',
            autoHideDuration: 20000
          }
        )
      } else if (isMediumRisk) {
        // ⚠️ 中风险：有一定难度，但可以尝试
        notify(
          `⚠️ 可行性提示（中风险）：\n\n` +
          `当前内容 ${totalWords} 字，需优化 ${allKeywordsCount} 个关键词。\n` +
          `预估需插入 ~${estimatedTotalInsertions} 次（平均每 ${wordsPerKeyword.toFixed(0)} 词1次）。\n\n` +
          `建议：如果优化后达标率低于40%，可考虑先扩展内容。`,
          {
            type: 'warning',
            autoHideDuration: 10000
          }
        )
      }
      // 否则低风险，不显示预警

      // ============ 第2步：收集所有类型的关键词 ============
      const primaryKeyword = record.target_keyword?.trim()
      const longTailKeywords = (record.long_tail_keywords || []).filter(Boolean)
      const secondaryKeywords = (record.secondary_keywords || []).filter(Boolean)

      // ============ 第3步：分析每个关键词，构建优化目标列表 ============
      const keywordsToOptimize: KeywordOptimizeTarget[] = []

      // 检查主关键词（优先级最高）
      if (primaryKeyword) {
        const density = keywordDensity[primaryKeyword] || 0
        const currentCount = Math.round((density / 100) * totalWords)

        // 主关键词理想密度: 1.5-2.5%
        const idealDensity = 2.0
        const minDensity = 1.5
        const maxDensity = 2.5

        if (density < minDensity || density > maxDensity) {
          const targetDensity = density < minDensity ? idealDensity : 2.0
          const targetCount = Math.round((targetDensity / 100) * totalWords)

          keywordsToOptimize.push({
            keyword: primaryKeyword,
            type: 'primary',
            isPrimary: true,
            currentDensity: density,
            currentCount,
            targetDensity,
            targetCount,
            needToAdd: density < minDensity ? targetCount - currentCount : 0,
            needToRemove: density > maxDensity ? currentCount - targetCount : 0,
            action: density < minDensity ? 'increase' : 'decrease',
            reason: density < minDensity
              ? `当前密度 ${density.toFixed(2)}% < 理想范围 ${minDensity}-${maxDensity}%`
              : `当前密度 ${density.toFixed(2)}% > 理想范围 ${minDensity}-${maxDensity}%`
          })
        }
      }

      // 检查长尾关键词
      longTailKeywords.forEach(keyword => {
        const density = keywordDensity[keyword] || 0
        const currentCount = Math.round((density / 100) * totalWords)

        // ✅ 长尾关键词理想密度: 0.5-1.5%（更宽松标准）
        const idealDensity = 0.8 // 降低from 1.2 → 0.8
        const minDensity = 0.5    // 降低from 1.0 → 0.5
        const maxDensity = 1.5    // 降低from 2.0 → 1.5

        if (density < minDensity || density > maxDensity) {
          const targetDensity = density < minDensity ? idealDensity : 1.2
          const targetCount = Math.round((targetDensity / 100) * totalWords)

          keywordsToOptimize.push({
            keyword,
            type: 'long_tail',
            isPrimary: false,
            currentDensity: density,
            currentCount,
            targetDensity,
            targetCount,
            needToAdd: density < minDensity ? targetCount - currentCount : 0,
            needToRemove: density > maxDensity ? currentCount - targetCount : 0,
            action: density < minDensity ? 'increase' : 'decrease',
            reason: density < minDensity
              ? `当前密度 ${density.toFixed(2)}% < 理想范围 ${minDensity}-${maxDensity}%`
              : `当前密度 ${density.toFixed(2)}% > 理想范围 ${minDensity}-${maxDensity}%`
          })
        }
      })

      // 检查次要关键词
      secondaryKeywords.forEach(keyword => {
        const density = keywordDensity[keyword] || 0
        const currentCount = Math.round((density / 100) * totalWords)

        // ✅ 次要关键词理想密度: 0.5-1.5%（更宽松标准）
        const idealDensity = 0.8 // 降低from 1.2 → 0.8
        const minDensity = 0.5    // 降低from 1.0 → 0.5
        const maxDensity = 1.5    // 降低from 2.0 → 1.5

        if (density < minDensity || density > maxDensity) {
          const targetDensity = density < minDensity ? idealDensity : 1.2
          const targetCount = Math.round((targetDensity / 100) * totalWords)

          keywordsToOptimize.push({
            keyword,
            type: 'secondary',
            isPrimary: false,
            currentDensity: density,
            currentCount,
            targetDensity,
            targetCount,
            needToAdd: density < minDensity ? targetCount - currentCount : 0,
            needToRemove: density > maxDensity ? currentCount - targetCount : 0,
            action: density < minDensity ? 'increase' : 'decrease',
            reason: density < minDensity
              ? `当前密度 ${density.toFixed(2)}% < 理想范围 ${minDensity}-${maxDensity}%`
              : `当前密度 ${density.toFixed(2)}% > 理想范围 ${minDensity}-${maxDensity}%`
          })
        }
      })

      // 如果所有关键词都在理想范围，无需优化
      if (keywordsToOptimize.length === 0) {
        notify('✨ 所有关键词密度都在理想范围内，无需优化！', { type: 'success' })
        setIsOptimizingKeywords(false)
        return
      }

      const increaseCount = keywordsToOptimize.filter(k => k.action === 'increase').length
      const decreaseCount = keywordsToOptimize.filter(k => k.action === 'decrease').length

      notify(`🎯 检测到 ${keywordsToOptimize.length} 个需要优化的关键词（${increaseCount}个需增加，${decreaseCount}个需减少）`, {
        type: 'info',
        autoHideDuration: 5000
      })

      console.log('[关键词密度优化] 待优化关键词:', keywordsToOptimize)

      // ============ 第4步：准备优化请求（使用新的请求格式）============
      const optimizeRequest: KeywordDensityOptimizeRequest = {
        language: record.language || 'en',
        guide_content: record.guide_content,
        faq_items: record.faq_items,
        target_keyword: record.target_keyword,
        long_tail_keywords: record.long_tail_keywords,
        secondary_keywords: record.secondary_keywords,
        total_words: totalWords,
        keywords_to_optimize: keywordsToOptimize
      }

      // ============ 第5步：调用AI服务进行优化 ============
      let optimizeResult: any
      let retryAttempted = false

      // 执行优化（可能重试一次）
      for (let attempt = 1; attempt <= 2; attempt++) {
        const isRetry = attempt === 2

        if (isLocalModel(aiModel)) {
          // 本地模式：调用本地服务器
          notify(
            isRetry
              ? '🔄 检测到部分关键词未达标，正在重试优化（预计60-90秒）...'
              : '🔄 调用本地AI优化关键词密度（预计60-90秒）...',
            {
              type: 'info',
              autoHideDuration: 8000
            }
          )

          const response = await fetch(`${SEO_SERVER_URL}/optimize-keyword-density`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(optimizeRequest)
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || `HTTP ${response.status}`)
          }

          const result = await response.json()

          if (!result.success || !result.data) {
            throw new Error('API 返回格式不正确')
          }

          optimizeResult = result.data
        } else {
          // 在线模式：调用在线AI服务
          notify(
            isRetry
              ? '🔄 检测到部分关键词未达标，正在重试优化（预计60-90秒）...'
              : '🔄 调用在线AI优化关键词密度（预计60-90秒）...',
            {
              type: 'info',
              autoHideDuration: 8000
            }
          )

          optimizeResult = await seoAIService.optimizeKeywordDensity(optimizeRequest, aiModel)
        }

        // ============ 第6步：自动验证优化结果 ============
        notify('🔍 正在验证优化效果...', { type: 'info', autoHideDuration: 3000 })

        // 提取优化后的完整内容
        const optimizedFullContent = extractFullContent({
          meta_title: record.meta_title, // Meta信息未优化
          meta_description: record.meta_description,
          meta_keywords: record.meta_keywords,
          guide_intro: record.guide_intro,
          guide_content: optimizeResult.optimized_guide_content,
          faq_items: optimizeResult.optimized_faq_items
        })

        // 重新计算优化后的关键词密度
        const allKeywordsForVerify = [
          ...(primaryKeyword ? [primaryKeyword] : []),
          ...longTailKeywords,
          ...secondaryKeywords
        ]
        const optimizedKeywordDensity = calculateKeywordDensity(
          optimizedFullContent,
          allKeywordsForVerify
        )

        // 检查每个待优化关键词是否达标
        const verificationResults = keywordsToOptimize.map(k => {
          const newDensity = optimizedKeywordDensity[k.keyword] || 0

          // ✅ 根据关键词类型判断理想范围（更宽松标准）
          const minDensity = k.isPrimary ? 1.5 : 0.5 // 非主关键词从 1.0 → 0.5
          const maxDensity = k.isPrimary ? 2.5 : 1.5 // 非主关键词从 2.0 → 1.5

          const isQualified = newDensity >= minDensity && newDensity <= maxDensity

          return {
            keyword: k.keyword,
            isPrimary: k.isPrimary,
            targetDensity: k.targetDensity,
            newDensity,
            isQualified,
            minDensity,
            maxDensity
          }
        })

        const qualifiedCount = verificationResults.filter(r => r.isQualified).length
        const qualificationRate = (qualifiedCount / keywordsToOptimize.length) * 100

        console.log(`[关键词密度优化] 验证结果 (尝试 ${attempt}/2):`, {
          qualifiedCount,
          totalCount: keywordsToOptimize.length,
          qualificationRate: qualificationRate.toFixed(1) + '%',
          details: verificationResults
        })

        // ============ 第7步：智能重试决策 ============
        if (qualificationRate < 40 && attempt === 1) {
          // ✅ 达标率 < 40%，准备第二次优化（只针对未达标的关键词）
          retryAttempted = true

          const failedKeywords = verificationResults
            .filter(r => !r.isQualified)
            .map(r => r.keyword)

          notify(
            `⚠️ 首次优化达标率 ${qualificationRate.toFixed(0)}%，将对 ${failedKeywords.length} 个未达标关键词重试...`,
            { type: 'warning', autoHideDuration: 5000 }
          )

          // 更新优化请求：只包含未达标的关键词
          optimizeRequest.keywords_to_optimize = keywordsToOptimize.filter(k =>
            failedKeywords.includes(k.keyword)
          )

          // 使用第一次优化的结果作为基础
          optimizeRequest.guide_content = optimizeResult.optimized_guide_content
          optimizeRequest.faq_items = optimizeResult.optimized_faq_items

          // 继续循环，执行第二次优化
          continue
        } else {
          // ✅ 达标率 >= 40% 或已经是第二次尝试，结束循环
          // 新成功标准：≥40%=成功，≥60%=良好，≥80%=优秀
          if (qualificationRate >= 80) {
            notify(
              `✅ 优化效果优秀！达标率 ${qualificationRate.toFixed(0)}% (${qualifiedCount}/${keywordsToOptimize.length}) 🎉`,
              { type: 'success', autoHideDuration: 5000 }
            )
          } else if (qualificationRate >= 60) {
            notify(
              `✅ 优化效果良好！达标率 ${qualificationRate.toFixed(0)}% (${qualifiedCount}/${keywordsToOptimize.length}) 👍`,
              { type: 'success', autoHideDuration: 5000 }
            )
          } else if (qualificationRate >= 40) {
            notify(
              `✅ 优化成功！达标率 ${qualificationRate.toFixed(0)}% (${qualifiedCount}/${keywordsToOptimize.length})`,
              { type: 'success', autoHideDuration: 5000 }
            )
          } else {
            notify(
              `⚠️ 优化完成，但达标率较低 ${qualificationRate.toFixed(0)}% (${qualifiedCount}/${keywordsToOptimize.length})，建议扩展内容后重试`,
              { type: 'warning', autoHideDuration: 6000 }
            )
          }

          // 将验证结果添加到 key_improvements
          const verificationSummary = verificationResults.map(r =>
            r.isQualified
              ? `✅ ${r.keyword}${r.isPrimary ? '【主】' : ''}: ${r.newDensity.toFixed(2)}% (达标)`
              : `❌ ${r.keyword}${r.isPrimary ? '【主】' : ''}: ${r.newDensity.toFixed(2)}% (未达标，理想范围 ${r.minDensity}-${r.maxDensity}%)`
          )

          optimizeResult.verification_results = verificationResults
          optimizeResult.qualification_rate = qualificationRate
          optimizeResult.key_improvements = [
            ...(optimizeResult.key_improvements || []),
            '',
            '【优化效果验证】',
            `达标率: ${qualifiedCount}/${keywordsToOptimize.length} (${qualificationRate.toFixed(0)}%)`,
            ...verificationSummary
          ]

          if (retryAttempted) {
            optimizeResult.key_improvements.unshift('✨ 已执行智能重试优化')
          }

          break // 结束循环
        }
      }

      // ============ 第8步：保存优化结果并显示预览 ============
      setOptimizationResult({
        optimized_content: {
          guide_content: optimizeResult.optimized_guide_content,
          faq_items: optimizeResult.optimized_faq_items
        },
        optimization_summary: `优化了 ${keywordsToOptimize.length} 个关键词的密度（${increaseCount}个需增加，${decreaseCount}个需减少）`,
        key_improvements: optimizeResult.key_improvements || [
          ...keywordsToOptimize.map(k =>
            `${k.keyword}${k.isPrimary ? '【主】' : ''}: ${k.currentCount}次(${k.currentDensity.toFixed(2)}%) → ${k.targetCount}次(${k.targetDensity.toFixed(2)}%)`
          )
        ]
      })

      setShowPreview(true)
      setPreviewTab(2) // 默认显示正文对比

      notify('✨ 关键词密度优化完成！请查看预览并决定是否应用', {
        type: 'success',
        autoHideDuration: 6000
      })

    } catch (error) {
      console.error('[SEO Keyword Density] 优化失败:', error)

      const errorMessage = error instanceof Error ? error.message : String(error)
      const isServerDown = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')

      notify(
        isServerDown && isLocalModel(aiModel)
          ? '❌ 无法连接到本地服务 (localhost:3030)，请确保运行 npm run seo:server'
          : `❌ 关键词密度优化失败: ${errorMessage}`,
        { type: 'error', autoHideDuration: 8000 }
      )
    } finally {
      setIsOptimizingKeywords(false)
    }
  }

  /**
   * 应用优化内容
   */
  const handleApplyOptimization = async () => {
    if (!optimizationResult) return

    try {
      notify('💾 正在应用优化内容...', { type: 'info' })

      const optimized = optimizationResult.optimized_content

      // 只更新实际被优化的字段（过滤掉 undefined 的字段）
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      }

      // 条件性添加字段（只添加已优化的、非 undefined 的字段）
      if (optimized.meta_title !== undefined) updateData.meta_title = optimized.meta_title
      if (optimized.meta_description !== undefined) updateData.meta_description = optimized.meta_description
      if (optimized.meta_keywords !== undefined) updateData.meta_keywords = optimized.meta_keywords
      if (optimized.guide_intro !== undefined) updateData.guide_intro = optimized.guide_intro
      if (optimized.guide_content !== undefined) updateData.guide_content = optimized.guide_content
      if (optimized.faq_items !== undefined) updateData.faq_items = optimized.faq_items
      if (optimized.secondary_keywords !== undefined) updateData.secondary_keywords = optimized.secondary_keywords

      console.log('[SEO Apply] 应用优化字段:', Object.keys(updateData).filter(k => k !== 'updated_at'))

      // ✅ 直接使用 Supabase 客户端更新数据库
      const { error: updateError } = await supabase
        .from('template_seo_guides')
        .update(updateData)
        .eq('id', record.id)

      if (updateError) {
        console.error('[SEO Apply] 数据库更新失败:', updateError)
        throw new Error(`数据库更新失败: ${updateError.message}`)
      }

      console.log('[SEO Apply] ✅ 数据库更新成功')

      // 关闭预览
      setShowPreview(false)
      setOptimizationResult(null)

      notify('✅ 优化内容已应用！正在读取最新数据并自动重新评分...', {
        type: 'success',
        autoHideDuration: 4000
      })

      // ✅ 立即从数据库读取最新保存的数据
      console.log('[SEO Apply] 从数据库读取最新数据...')
      const { data: latestRecord } = await dataProvider.getOne('template_seo_guides', {
        id: record.id
      })

      console.log('[SEO Apply] 读取最新数据成功:', {
        guide_content_length: latestRecord.guide_content?.length || 0,
        faq_items_count: latestRecord.faq_items?.length || 0
      })

      // 刷新UI（触发界面更新）
      refresh()

      // ✅ 1秒后使用最新数据自动触发重新评分（带重试机制）
      console.log('[SEO Apply] 启动自动重新评分（使用最新数据）')
      setTimeout(() => {
        autoRescoreWithRetry(latestRecord)
      }, 1000)
    } catch (error) {
      console.error('[SEO Optimize] 应用优化失败:', error)
      notify('❌ 应用优化失败，请重试', { type: 'error' })
    }
  }

  return {
    isOptimizing,
    currentStep,
    optimizationResult,
    showPreview,
    previewTab,
    isOptimizingKeywords,
    setShowPreview,
    setPreviewTab,
    handleOptimize,
    handleOptimizeKeywordDensity,
    handleApplyOptimization
  }
}
