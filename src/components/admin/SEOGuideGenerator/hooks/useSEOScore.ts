/**
 * SEO评分相关的自定义Hook
 * 负责AI智能评分、自动重新评分等功能
 */

import { useState } from 'react'
import { useRefresh, useNotify } from 'react-admin'
import { supabase } from '@/lib/supabase'
import { seoAIService } from '@/services/seoAIService'
import { isLocalModel } from '../AIModelContext'
import {
  extractFullContent,
  calculateKeywordDensity,
  calculateKeywordDensityScore
} from '@/services/seoScoreCalculator'
import type { SEOGuideData } from '@/types/seo'

// 本地服务 API 配置
const SEO_SERVER_URL = 'http://localhost:3030'

interface UseSEOScoreOptions {
  record: any
  aiModel: string
}

export const useSEOScore = ({ record, aiModel }: UseSEOScoreOptions) => {
  const refresh = useRefresh()
  const notify = useNotify()

  const [isRecalculating, setIsRecalculating] = useState(false)
  const [isAutoRescoring, setIsAutoRescoring] = useState(false)

  // ✅ 本地状态：存储最新的评分数据（用于覆盖缓存的 record 数据）
  const [latestScores, setLatestScores] = useState<{
    seo_score?: number
    content_quality_score?: number
    keyword_optimization_score?: number
    readability_score?: number
    keyword_density_score?: number
    seo_recommendations?: string[]
  } | null>(null)

  /**
   * 重新计算SEO评分（AI智能评分）
   * 根据 Context 中的 aiModel 自动选择在线或本地服务
   * @param dataSource - 可选的数据源，如果不提供则使用当前 record
   */
  const handleRecalculate = async (dataSource?: any) => {
    setIsRecalculating(true)

    // 显示 AI 评分进度提示
    notify('🤖 AI 专家正在分析内容，预计需要 30-60 秒...', {
      type: 'info',
      autoHideDuration: 8000
    })

    try {
      // 使用传入的数据源或当前 record
      let source = dataSource || record

      // ✅ 首先检查 source 是否有效
      if (!source || !source.id) {
        console.error('[SEO Score] Record 对象无效:', source)
        throw new Error('无法获取记录数据，请刷新页面后重试')
      }

      // ✅ 调试：打印 record 的所有字段
      console.log('[SEO Score Debug] Record 对象完整内容:', {
        id: source.id,
        template_id: source.template_id,
        language: source.language,
        target_keyword: source.target_keyword,
        has_meta_title: !!source.meta_title,
        has_meta_description: !!source.meta_description,
        has_meta_keywords: !!source.meta_keywords,
        has_guide_intro: !!source.guide_intro,
        has_guide_content: !!source.guide_content,
        has_faq_items: !!source.faq_items,
        guide_content_length: source.guide_content?.length || 0,
        faq_items_count: source.faq_items?.length || 0,
        long_tail_keywords_count: source.long_tail_keywords?.length || 0,
        all_fields: Object.keys(source)
      })

      // ✅ 强制从数据库重新加载纯SEO字段（避免使用可能包含template关联的record）
      // 无论record数据是否完整，都重新加载以确保数据纯净
      console.log('[SEO Score] 从数据库加载纯SEO数据...')

      const { data: freshData, error } = await supabase
        .from('template_seo_guides')
        .select(`
          id,
          template_id,
          language,
          target_keyword,
          long_tail_keywords,
          secondary_keywords,
          meta_title,
          meta_description,
          meta_keywords,
          guide_intro,
          guide_content,
          faq_items,
          page_views,
          avg_time_on_page,
          bounce_rate,
          conversion_rate,
          seo_score,
          content_quality_score,
          keyword_optimization_score,
          readability_score,
          keyword_density_score,
          seo_recommendations
        `)
        .eq('id', source.id)
        .single()

      if (error) {
        console.error('[SEO Score] 加载数据失败:', error)
        throw new Error(`无法加载数据: ${error.message}`)
      }

      if (!freshData) {
        throw new Error('数据库中未找到该记录')
      }

      console.log('[SEO Score] 加载纯SEO数据成功:', {
        guide_content_length: freshData.guide_content?.length || 0,
        faq_items_count: freshData.faq_items?.length || 0,
        has_template_field: 'template' in freshData, // 应该是false
        all_fields: Object.keys(freshData)
      })

      source = freshData

      console.log('[SEO Score] 使用数据源:', {
        isCustomSource: !!dataSource,
        guide_content_length: source.guide_content?.length || 0,
        faq_items_count: source.faq_items?.length || 0
      })

      // ✅ 提前计算准确的关键词密度
      const fullContent = extractFullContent({
        meta_title: source.meta_title,
        meta_description: source.meta_description,
        meta_keywords: source.meta_keywords,
        guide_intro: source.guide_intro,
        guide_content: source.guide_content,
        faq_items: source.faq_items
      })

      const allKeywords = [
        ...(source.target_keyword ? [source.target_keyword] : []),
        ...(source.long_tail_keywords || []),
        ...(source.secondary_keywords || [])
      ].filter(Boolean)

      const accurateKeywordDensity = calculateKeywordDensity(fullContent, allKeywords)

      console.log('[SEO Score] 实时计算密度:', {
        总关键词数: allKeywords.length,
        密度结果数: Object.keys(accurateKeywordDensity).length,
        目标关键词密度: accurateKeywordDensity[source.target_keyword || ''] || 0
      })

      // 准备数据（包含准确的密度）
      const seoGuideData: SEOGuideData = {
        language: source.language || 'en',
        meta_title: source.meta_title,
        meta_description: source.meta_description,
        meta_keywords: source.meta_keywords,
        guide_content: source.guide_content,
        guide_intro: source.guide_intro,
        target_keyword: source.target_keyword,
        long_tail_keywords: source.long_tail_keywords,
        secondary_keywords: source.secondary_keywords,
        faq_items: source.faq_items,
        page_views: source.page_views || 0,
        avg_time_on_page: source.avg_time_on_page || 0,
        bounce_rate: source.bounce_rate || 0,
        conversion_rate: source.conversion_rate || 0,
        // ✅ 传递准确的密度给AI，让AI基于真实密度生成建议
        keyword_density: accurateKeywordDensity
      }

      // ✅ 详细调试：输出实际传递给AI的数据
      console.log('[SEO Score] 📤 传递给AI的完整数据:', {
        language: seoGuideData.language,
        meta_title_preview: seoGuideData.meta_title?.substring(0, 100),
        meta_description_preview: seoGuideData.meta_description?.substring(0, 100),
        meta_keywords_preview: seoGuideData.meta_keywords?.substring(0, 100),
        guide_intro_preview: seoGuideData.guide_intro?.substring(0, 100),
        guide_content_length: seoGuideData.guide_content?.length,
        faq_items_count: seoGuideData.faq_items?.length,
        target_keyword: seoGuideData.target_keyword,
        long_tail_keywords: seoGuideData.long_tail_keywords
      })

      // 检测非英文字符
      const detectNonEnglish = (text: string, fieldName: string) => {
        if (!text) return false
        const nonEnglishRegex = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g
        const matches = text.match(nonEnglishRegex)
        if (matches) {
          console.warn(`⚠️ [SEO Score] 字段 "${fieldName}" 包含 ${matches.length} 个非英文字符:`, matches.slice(0, 5).join(', '))
          return true
        }
        return false
      }

      // 逐个检测
      detectNonEnglish(seoGuideData.meta_title || '', 'meta_title')
      detectNonEnglish(seoGuideData.meta_description || '', 'meta_description')
      detectNonEnglish(seoGuideData.meta_keywords || '', 'meta_keywords')
      detectNonEnglish(seoGuideData.guide_intro || '', 'guide_intro')
      detectNonEnglish(seoGuideData.guide_content || '', 'guide_content')
      detectNonEnglish(JSON.stringify(seoGuideData.faq_items || []), 'faq_items')

      let scoreResult: any

      if (isLocalModel(aiModel)) {
        // 本地 Claude CLI 模式：调用本地服务器
        console.log('[SEO Score] 调用本地服务 API...')
        const response = await fetch(`${SEO_SERVER_URL}/calculate-seo-score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(seoGuideData)
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const result = await response.json()

        if (!result.success || !result.data) {
          throw new Error('API 返回格式不正确')
        }

        scoreResult = result.data
      } else {
        // 在线模式：调用 seoAIService
        console.log('[SEO Score] 调用在线 AI 服务...')
        scoreResult = await seoAIService.calculateSEOScore(seoGuideData, aiModel)
      }

      console.log('[SEO Score] AI 评分完成:', scoreResult)

      // ✅ 使用客户端算法重新计算关键词密度评分（确保准确性）
      const clientKeywordDensityScore = calculateKeywordDensityScore(
        accurateKeywordDensity,
        source.target_keyword
      )

      console.log('[SEO Score] 关键词密度评分对比:', {
        AI评分: scoreResult.keyword_density_score,
        客户端评分: clientKeywordDensityScore,
        是否一致: scoreResult.keyword_density_score === clientKeywordDensityScore,
        达标关键词数: Object.entries(accurateKeywordDensity).filter(([kw, density]) => {
          const isTarget = source.target_keyword && kw.toLowerCase() === source.target_keyword.toLowerCase()
          return isTarget
            ? (density >= 1.5 && density <= 2.5)
            : (density >= 1.0 && density <= 2.0)
        }).length,
        总关键词数: Object.keys(accurateKeywordDensity).length
      })

      // ✅ 如果AI评分与客户端计算不一致，使用客户端计算（更准确）
      if (scoreResult.keyword_density_score !== clientKeywordDensityScore) {
        console.warn(`⚠️ [SEO Score] AI评分(${scoreResult.keyword_density_score}分)与客户端计算(${clientKeywordDensityScore}分)不一致，使用客户端计算结果`)
        scoreResult.keyword_density_score = clientKeywordDensityScore

        // 重新计算总分（其他三项分数 + 客户端计算的关键词密度分数）
        const recalculatedTotal =
          scoreResult.content_quality_score +
          scoreResult.keyword_optimization_score +
          scoreResult.readability_score +
          clientKeywordDensityScore

        if (scoreResult.total_score !== recalculatedTotal) {
          console.warn(`⚠️ [SEO Score] 总分校正: ${scoreResult.total_score} → ${recalculatedTotal}`)
          scoreResult.total_score = recalculatedTotal
        }
      }

      // ✅ 直接使用 Supabase 客户端更新数据库（绕过可能有问题的 dataProvider）
      console.log('[SEO Score] 🔄 准备更新数据库...', {
        id: record.id,
        将要写入的keyword_density_score: scoreResult.keyword_density_score,
        将要写入的total_score: scoreResult.total_score
      })

      const { data: updateResult, error: updateError } = await supabase
        .from('template_seo_guides')
        .update({
          seo_score: scoreResult.total_score,
          content_quality_score: scoreResult.content_quality_score,
          keyword_optimization_score: scoreResult.keyword_optimization_score,
          readability_score: scoreResult.readability_score,
          keyword_density_score: scoreResult.keyword_density_score,
          seo_recommendations: scoreResult.recommendations,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id)
        .select()
        .single()

      if (updateError) {
        console.error('[SEO Score] ❌ 数据库更新失败:', updateError)
        throw new Error(`数据库更新失败: ${updateError.message}`)
      }

      console.log('[SEO Score] ✅ 数据库更新成功！返回的数据:', {
        id: updateResult.id,
        keyword_density_score: updateResult.keyword_density_score,
        seo_score: updateResult.seo_score
      })

      // ✅ 立即更新本地状态，强制界面显示最新评分（不等待 refresh）
      setLatestScores({
        seo_score: scoreResult.total_score,
        content_quality_score: scoreResult.content_quality_score,
        keyword_optimization_score: scoreResult.keyword_optimization_score,
        readability_score: scoreResult.readability_score,
        keyword_density_score: scoreResult.keyword_density_score,
        seo_recommendations: scoreResult.recommendations
      })

      console.log('[SEO Score] ✅ 本地状态已更新，界面应立即显示最新评分:', {
        总分: scoreResult.total_score,
        关键词密度分: scoreResult.keyword_density_score
      })

      notify(
        `🎉 AI 智能评分完成！总分：${scoreResult.total_score}分 | 建议数：${scoreResult.recommendations.length}条`,
        {
          type: 'success',
          autoHideDuration: 6000
        }
      )

      // ✅ 刷新界面，让后台数据也同步
      refresh()
    } catch (error) {
      console.error('[SEO Score] AI 评分失败:', error)

      // 检查是否是服务未启动（仅本地模式）
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isServerDown = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')

      notify(
        isServerDown && isLocalModel(aiModel)
          ? '❌ 无法连接到本地服务 (localhost:3030)，请确保运行 npm run seo:server'
          : `❌ AI 评分失败: ${errorMessage}`,
        { type: 'error', autoHideDuration: 8000 }
      )
    } finally {
      setIsRecalculating(false)
    }
  }

  /**
   * 自动重新评分（带重试机制）
   * 在应用优化后自动调用，如果失败会自动重试
   * @param dataToScore - 要评分的数据，如果不提供则使用当前 record
   * @param maxRetries - 最大重试次数
   */
  const autoRescoreWithRetry = async (dataToScore?: any, maxRetries = 2) => {
    setIsAutoRescoring(true)

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[SEO Auto Rescore] 尝试 ${attempt + 1}/${maxRetries + 1}`)

        // 传递数据源给 handleRecalculate
        await handleRecalculate(dataToScore)

        notify('✅ 自动重新评分完成！密度和建议已更新', {
          type: 'success',
          autoHideDuration: 4000
        })

        setIsAutoRescoring(false)
        return // 成功，退出

      } catch (error) {
        console.error(`[SEO Auto Rescore] 尝试 ${attempt + 1} 失败:`, error)

        if (attempt < maxRetries) {
          notify(`⚠️ 自动评分失败，正在重试 (${attempt + 1}/${maxRetries})...`, {
            type: 'warning',
            autoHideDuration: 3000
          })
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          notify('❌ 自动评分失败，请手动点击"AI智能评分"按钮重新评分', {
            type: 'error',
            autoHideDuration: 8000
          })
        }
      }
    }

    setIsAutoRescoring(false)
  }

  return {
    isRecalculating,
    isAutoRescoring,
    latestScores,
    handleRecalculate,
    autoRescoreWithRetry
  }
}
