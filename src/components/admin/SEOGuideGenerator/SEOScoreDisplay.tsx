/**
 * SEO评分详情展示组件
 * 展示SEO指南的评分breakdown、关键词密度和优化建议
 */

import React, { useMemo } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Button,
  CircularProgress,
  Tooltip,
  Alert
} from '@mui/material'
import {
  TrendingUp,
  ExpandMore,
  Lightbulb,
  Article,
  Search,
  Visibility,
  Refresh,
  OpenInNew,
  AutoFixHigh
} from '@mui/icons-material'
import { useRecordContext, useNotify } from 'react-admin'
import {
  getSEOScoreGrade,
  calculateKeywordDensity,
  extractFullContent
} from '@/services/seoScoreCalculator'
import { useAIModel } from './AIModelContext'

// 导入自定义 Hooks
import { useSEOScore } from './hooks/useSEOScore'
import { useSEOOptimization } from './hooks/useSEOOptimization'

// 导入提取的组件
import { ScoreBar } from './components/ScoreBar'
import { KeywordDensityCard } from './components/KeywordDensityCard'
import { RecommendationsList } from './components/RecommendationsList'
import { OptimizationPreviewDialog } from './components/OptimizationPreviewDialog'

/**
 * SEO评分详情展示组件
 */
export const SEOScoreDisplay: React.FC = () => {
  const record = useRecordContext()
  const notify = useNotify()
  const { aiModel } = useAIModel() // 使用全局 AI 模型选择

  // ✅ 实时计算关键词密度（不从数据库读取）
  const keywordDensity = useMemo(() => {
    if (!record) return {}

    // 提取完整内容
    const fullContent = extractFullContent({
      meta_title: record.meta_title,
      meta_description: record.meta_description,
      meta_keywords: record.meta_keywords,
      guide_intro: record.guide_intro,
      guide_content: record.guide_content,
      faq_items: record.faq_items
    })

    // 获取所有关键词
    const allKeywords = [
      ...(record.target_keyword ? [record.target_keyword] : []),
      ...(record.long_tail_keywords || []),
      ...(record.secondary_keywords || [])
    ].filter(Boolean)

    // 实时计算密度
    return calculateKeywordDensity(fullContent, allKeywords)
  }, [
    record?.meta_title,
    record?.meta_description,
    record?.meta_keywords,
    record?.guide_intro,
    record?.guide_content,
    record?.faq_items,
    record?.target_keyword,
    record?.long_tail_keywords,
    record?.secondary_keywords
  ])

  // ✅ 使用评分相关 Hook
  const {
    isRecalculating,
    isAutoRescoring,
    latestScores,
    handleRecalculate,
    autoRescoreWithRetry
  } = useSEOScore({ record, aiModel })

  // ✅ 使用优化相关 Hook
  const {
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
  } = useSEOOptimization({ record, aiModel, keywordDensity, autoRescoreWithRetry })

  // ✅ 详细调试：打印 record 对象
  React.useEffect(() => {
    console.log('[SEOScoreDisplay] Record 对象:', {
      exists: !!record,
      id: record?.id,
      type_of_id: typeof record?.id,
      has_guide_content: !!record?.guide_content,
      has_faq_items: !!record?.faq_items,
      all_keys: record ? Object.keys(record) : []
    })
  }, [record])

  if (!record) {
    console.warn('[SEOScoreDisplay] Record 为空，组件不渲染')
    return null
  }

  if (!record.id) {
    console.error('[SEOScoreDisplay] Record 存在但缺少 id:', record)
    return (
      <Box sx={{ my: 3 }}>
        <Alert severity="error">
          ⚠️ 数据加载异常：记录 ID 缺失。请刷新页面重试。
        </Alert>
      </Box>
    )
  }

  // ✅ 优先使用本地最新评分，如果没有则使用 record 的数据
  const totalScore = latestScores?.seo_score ?? record.seo_score ?? 0
  const contentQuality = latestScores?.content_quality_score ?? record.content_quality_score ?? 0
  const keywordOptimization = latestScores?.keyword_optimization_score ?? record.keyword_optimization_score ?? 0
  const readability = latestScores?.readability_score ?? record.readability_score ?? 0
  const keywordDensityScore = latestScores?.keyword_density_score ?? record.keyword_density_score ?? 0
  const recommendations = latestScores?.seo_recommendations ?? record.seo_recommendations ?? []

  // ✅ 调试：打印界面使用的评分值
  React.useEffect(() => {
    console.log('[SEOScoreDisplay] 🎨 界面渲染使用的评分值:', {
      关键词密度分_界面显示: keywordDensityScore,
      总分_界面显示: totalScore,
      数据来源: latestScores?.keyword_density_score !== undefined ? '本地状态(latestScores)' : 'record缓存',
      latestScores中的值: latestScores?.keyword_density_score,
      record中的值: record.keyword_density_score,
      record的id: record.id
    })
  }, [keywordDensityScore, totalScore, latestScores, record.keyword_density_score, record.id])

  const { grade, color, label } = getSEOScoreGrade(totalScore)

  /**
   * 获取SEO页面URL
   */
  const getSEOPageUrl = () => {
    if (!record.template?.slug || !record.language) {
      return null
    }
    // URL格式: /{language}/guide/{template_slug}
    return `/${record.language}/guide/${record.template.slug}`
  }

  /**
   * 打开SEO页面
   */
  const handleOpenPage = () => {
    const url = getSEOPageUrl()
    if (url) {
      window.open(url, '_blank')
    } else {
      notify('⚠️ 无法生成页面URL，模板或语言信息缺失', { type: 'warning' })
    }
  }

  return (
    <Box sx={{ my: 3 }}>
      {/* 左右布局：总分卡片 + 评分详情 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* 左侧：总分卡片 */}
        <Grid item xs={12} md={5}>
          <Card
            sx={{
              height: '100%',
              background:
                color === 'success'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : color === 'warning'
                  ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                  : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              color: 'white'
            }}
          >
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center'
                }}
              >
                <Typography variant="h6" gutterBottom>
                  SEO综合评分
                </Typography>
                <Box sx={{ my: 2 }}>
                  <Typography variant="h1" fontWeight="bold" sx={{ fontSize: '4rem' }}>
                    {totalScore}
                  </Typography>
                  <Typography variant="h5">/100</Typography>
                </Box>
                <Chip
                  label={`${grade}级 - ${label}`}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    py: 2,
                    px: 1
                  }}
                />
                <TrendingUp sx={{ fontSize: 60, opacity: 0.2, mt: 2 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 右侧：评分详情 */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Article color="primary" />
                  <Typography variant="h6">评分详情</Typography>
                </Box>

                {/* 操作按钮组 */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {/* 访问页面按钮 */}
                  <Tooltip title={getSEOPageUrl() ? '在新标签页中打开SEO页面' : '模板或语言信息缺失'}>
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<OpenInNew />}
                        onClick={handleOpenPage}
                        disabled={!getSEOPageUrl()}
                        sx={{ minWidth: 120 }}
                      >
                        访问页面
                      </Button>
                    </span>
                  </Tooltip>

                  {/* AI 智能评分按钮 */}
                  <Tooltip title="AI 智能评分（SEO 专家深度分析）">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={isRecalculating ? <CircularProgress size={16} /> : <Refresh />}
                      onClick={() => handleRecalculate()}
                      disabled={isRecalculating || isOptimizing || isAutoRescoring}
                      sx={{ minWidth: 140 }}
                    >
                      {isRecalculating ? 'AI 分析中...' : isAutoRescoring ? '自动评分中...' : 'AI 智能评分'}
                    </Button>
                  </Tooltip>

                  {/* 优化关键词密度按钮 */}
                  <Tooltip title="智能分析并优化密度异常的长尾关键词（<1% 或 >2.5%）">
                    <Button
                      variant="outlined"
                      size="small"
                      color="warning"
                      startIcon={isOptimizingKeywords ? <CircularProgress size={16} /> : <Search />}
                      onClick={handleOptimizeKeywordDensity}
                      disabled={isOptimizingKeywords || isOptimizing || isRecalculating || isAutoRescoring}
                      sx={{ minWidth: 160 }}
                    >
                      {isOptimizingKeywords ? '优化中...' : '优化关键词密度'}
                    </Button>
                  </Tooltip>

                  {/* AI 一键优化按钮 */}
                  <Tooltip title={totalScore >= 90 ? '评分已经很高，无需优化' : 'AI 分步优化（4个步骤，避免超时）'}>
                    <span>
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        startIcon={isOptimizing ? <CircularProgress size={16} /> : <AutoFixHigh />}
                        onClick={handleOptimize}
                        disabled={isOptimizing || isRecalculating || isAutoRescoring || totalScore >= 90}
                        sx={{ minWidth: 140 }}
                      >
                        {isOptimizing
                          ? currentStep > 0
                            ? `步骤 ${currentStep}/4`
                            : 'AI 优化中...'
                          : 'AI 一键优化'
                        }
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Box>

              <ScoreBar
                label="内容质量"
                score={contentQuality}
                maxScore={40}
                icon={<Article fontSize="small" color="primary" />}
              />
              <ScoreBar
                label="关键词优化"
                score={keywordOptimization}
                maxScore={30}
                icon={<Search fontSize="small" color="primary" />}
              />
              <ScoreBar
                label="可读性"
                score={readability}
                maxScore={20}
                icon={<Visibility fontSize="small" color="primary" />}
              />
              <ScoreBar
                label="关键词密度"
                score={keywordDensityScore}
                maxScore={10}
                icon={<Search fontSize="small" color="primary" />}
              />

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="textSecondary">
                💡 提示：总分 = 内容质量(40分) + 关键词优化(30分) + 可读性(20分) +
                关键词密度(10分)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 关键词密度 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Search color="primary" />
            <Typography variant="h6">关键词密度</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            理想的关键词密度为 1-3%，过高可能被视为关键词堆砌，过低则影响SEO效果。
          </Typography>
          <Box sx={{ mt: 2 }}>
            <KeywordDensityCard density={keywordDensity} />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 优化建议 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Lightbulb color="primary" />
            <Typography variant="h6">优化建议</Typography>
            {recommendations.length > 0 && (
              <Chip
                label={recommendations.length}
                color="warning"
                size="small"
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <RecommendationsList recommendations={recommendations} />
        </AccordionDetails>
      </Accordion>

      {/* 优化预览对话框 */}
      <OptimizationPreviewDialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onApply={handleApplyOptimization}
        optimizationResult={optimizationResult}
        originalData={{
          meta_title: record.meta_title,
          meta_description: record.meta_description,
          meta_keywords: record.meta_keywords,
          guide_intro: record.guide_intro,
          guide_content: record.guide_content,
          faq_items: record.faq_items
        }}
      />
    </Box>
  )
}

export default SEOScoreDisplay
