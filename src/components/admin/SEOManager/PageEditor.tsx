/**
 * Page Editor - 页面编辑器 (编辑/评分/预览)
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Alert,
  TextField,
  Button,
  Divider,
  CircularProgress,
  Chip,
  LinearProgress,
  Paper,
  Card,
  CardContent,
  Grid,
  Tooltip,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import { Edit, Assessment, Visibility, Save, Publish, Article, Search, TrendingUp, Lightbulb, CheckCircle, AutoFixHigh } from '@mui/icons-material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getSEOScoreGrade, extractFullContent, calculateKeywordDensity, calculateKeywordDensityScore } from '@/services/seoScoreCalculator'
import { seoAIService } from '@/services/seoAIService'
import ReactMarkdown from 'react-markdown'

interface PageEditorProps {
  templateId: string | null
  language: string
  keyword: string | null
  contentTemplate: string
  aiModel: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli'
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = React.memo(({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      style={{ height: '100%', overflow: 'auto' }}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
})

// 评分进度条组件
interface ScoreBarProps {
  label: string
  score: number
  maxScore: number
  icon: React.ReactNode
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, score, maxScore, icon }) => {
  const percentage = (score / maxScore) * 100
  const color =
    percentage >= 80 ? 'success' : percentage >= 60 ? 'warning' : 'error'

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
        {icon}
        <Typography variant="body2" fontWeight="medium">
          {label}
        </Typography>
        <Typography variant="body2" color="textSecondary" ml="auto">
          {score}/{maxScore}分
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={color}
        sx={{ height: 8, borderRadius: 1 }}
      />
    </Box>
  )
}

const PageEditor: React.FC<PageEditorProps> = ({
  templateId,
  language,
  keyword,
  contentTemplate,
  aiModel
}) => {
  const queryClient = useQueryClient()
  const [tabValue, setTabValue] = useState(0)
  const [formData, setFormData] = useState({
    meta_title: '',
    meta_description: '',
    main_content: '',
    faq: [] as Array<{ question: string; answer: string }>
  })
  const [saving, setSaving] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [scoreResult, setScoreResult] = useState<any>(null)
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false)
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  })

  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setToast({ open: true, message, severity })
  }

  const closeToast = () => {
    setToast({ ...toast, open: false })
  }

  // 获取页面数据
  const { data: pageData, isLoading } = useQuery({
    queryKey: ['seo-page-data', templateId, language, keyword, contentTemplate],
    queryFn: async () => {
      if (!templateId || !keyword) return null

      // 只通过关键词查询，避免复杂的多字段匹配
      const { data, error } = await supabase
        .from('seo_page_variants')
        .select('*')
        .eq('template_id', templateId)
        .eq('language', language)
        .eq('target_keyword', keyword)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!templateId && !!keyword,
    staleTime: 30000, // 数据在30秒内被视为新鲜，不会重新查询
    gcTime: 300000 // 缓存数据保留5分钟
  })

  // 当页面数据加载完成后，更新表单
  useEffect(() => {
    if (pageData) {
      setFormData({
        meta_title: pageData.meta_title || '',
        meta_description: pageData.meta_description || '',
        main_content: pageData.guide_content || pageData.main_content || '',
        faq: pageData.faq_items || pageData.faq || []
      })
      if (pageData.seo_score) {
        setScoreResult({
          total_score: pageData.seo_score,
          meta_info_quality_score: pageData.meta_info_quality_score || 0,
          keyword_optimization_score: pageData.keyword_optimization_score || 0,
          content_quality_score: pageData.content_quality_score || 0,
          readability_score: pageData.readability_score || 0,
          keyword_density_score: pageData.keyword_density_score || 0,
          recommendations: pageData.seo_recommendations || []
        })
      } else {
        setScoreResult(null)
      }
    } else {
      // 清空表单数据，为新关键词做准备
      setFormData({
        meta_title: '',
        meta_description: '',
        main_content: '',
        faq: []
      })
      setScoreResult(null)
    }
  }, [pageData])

  // 实时计算目标关键词密度（单关键词优化）
  const keywordDensity = useMemo(() => {
    if (!pageData || !pageData.guide_content || !pageData.target_keyword) return {}

    const fullContent = extractFullContent({
      meta_title: pageData.meta_title,
      meta_description: pageData.meta_description,
      meta_keywords: pageData.meta_keywords,
      guide_content: pageData.guide_content,
      faq_items: pageData.faq_items
    })

    // 只计算目标关键词的密度
    return calculateKeywordDensity(fullContent, [pageData.target_keyword])
  }, [
    pageData?.meta_title,
    pageData?.meta_description,
    pageData?.meta_keywords,
    pageData?.guide_content,
    pageData?.faq_items,
    pageData?.target_keyword
  ])

  // 如果没有选择关键词，显示提示
  if (!keyword) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          请从中间的关键词列表中选择一个关键词进行编辑
        </Alert>
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    )
  }

  // 保存草稿
  const handleSave = async (publish: boolean = false) => {
    if (!pageData?.id) {
      showToast('无法保存：页面数据不存在', 'error')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('seo_page_variants')
        .update({
          meta_title: formData.meta_title,
          meta_description: formData.meta_description,
          guide_content: formData.main_content,
          faq_items: formData.faq,
          is_published: publish,
          updated_at: new Date().toISOString()
        })
        .eq('id', pageData.id)

      if (error) throw error

      showToast(publish ? '发布成功！' : '保存成功！', 'success')

      // 刷新数据
      queryClient.invalidateQueries({ queryKey: ['seo-page-data', templateId, language, keyword, contentTemplate] })
      queryClient.invalidateQueries({ queryKey: ['seo-keywords', templateId, language, contentTemplate] })
    } catch (error) {
      showToast(`保存失败: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // 重新评分
  const handleReScore = async () => {
    if (!pageData?.id) {
      showToast('无法评分：页面数据不存在', 'error')
      return
    }

    if (!pageData.guide_content) {
      showToast('无法评分：页面内容不存在', 'error')
      return
    }

    setScoring(true)
    try {
      console.log(`[SEO Score] 开始对关键词 "${keyword}" 进行单独评分，使用模型: ${aiModel}`)

      // 1. 提取完整内容用于计算关键词密度
      const fullContent = extractFullContent({
        meta_title: pageData.meta_title,
        meta_description: pageData.meta_description,
        meta_keywords: pageData.meta_keywords,
        guide_content: pageData.guide_content,
        faq_items: pageData.faq_items
      })

      // 2. 计算目标关键词密度（单关键词优化）
      const keywordDensity = calculateKeywordDensity(fullContent, [pageData.target_keyword])
      console.log('[SEO Score] 目标关键词密度:', keywordDensity)

      // 3. 准备评分数据
      const seoGuideData = {
        target_keyword: pageData.target_keyword,
        secondary_keywords: pageData.secondary_keywords || [],
        meta_title: pageData.meta_title || '',
        meta_description: pageData.meta_description || '',
        meta_keywords: pageData.meta_keywords || '',
        guide_content: pageData.guide_content,
        faq_items: pageData.faq_items || []
      }

      // 4. 调用 AI 评分服务
      const scoreResult = await seoAIService.calculateSEOScore(seoGuideData, aiModel)
      console.log('[SEO Score] AI 评分结果:', scoreResult)

      // 5. 使用客户端算法重新计算关键词密度评分（确保准确性）
      const clientKeywordDensityScore = calculateKeywordDensityScore(
        keywordDensity,
        pageData.target_keyword
      )
      console.log('[SEO Score] 客户端关键词密度评分:', clientKeywordDensityScore)

      // 6. 直接使用AI返回的总分（不要重新计算）
      // AI评分系统已经综合考虑了所有维度，前端不应该覆盖
      const totalScore = scoreResult.total_score
      console.log('[SEO Score] AI总分:', totalScore)
      console.log('[SEO Score] 各维度分数 (严格4个维度):', {
        meta_info_quality: scoreResult.meta_info_quality_score,
        keyword_optimization: scoreResult.keyword_optimization_score,
        content_quality: scoreResult.content_quality_score,
        readability: scoreResult.readability_score,
        keyword_density: clientKeywordDensityScore
      })

      // 7. 更新数据库 - 严格保存4个维度
      const { error } = await supabase
        .from('seo_page_variants')
        .update({
          seo_score: totalScore,
          meta_info_quality_score: scoreResult.meta_info_quality_score,
          keyword_optimization_score: scoreResult.keyword_optimization_score,
          content_quality_score: scoreResult.content_quality_score,
          readability_score: scoreResult.readability_score,
          keyword_density_score: clientKeywordDensityScore,
          keyword_density: keywordDensity,
          seo_recommendations: scoreResult.recommendations || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', pageData.id)

      if (error) throw error

      // 8. 更新本地状态 - 严格保存4个维度
      setScoreResult({
        total_score: totalScore,
        meta_info_quality_score: scoreResult.meta_info_quality_score,
        keyword_optimization_score: scoreResult.keyword_optimization_score,
        content_quality_score: scoreResult.content_quality_score,
        readability_score: scoreResult.readability_score,
        keyword_density_score: clientKeywordDensityScore,
        recommendations: scoreResult.recommendations || []
      })

      // 9. 刷新数据
      queryClient.invalidateQueries({ queryKey: ['seo-page-data', templateId, language, keyword, contentTemplate] })
      queryClient.invalidateQueries({ queryKey: ['seo-keywords', templateId, language, contentTemplate] })

      showToast(`评分成功！总分: ${totalScore}/100`, 'success')
    } catch (error) {
      console.error('[SEO Score] 评分失败:', error)
      showToast(`评分失败: ${error.message}`, 'error')
    } finally {
      setScoring(false)
    }
  }

  // 使用优化后的内容重新评分
  const handleReScoreWithOptimizedContent = async (optimizedContent: any) => {
    if (!pageData?.id) {
      showToast('无法评分：页面数据不存在', 'error')
      return
    }

    setScoring(true)
    try {
      console.log('[SEO Score] 使用优化后的新内容进行评分...')

      // 1. 提取完整内容用于计算关键词密度（使用优化后的新数据）
      const fullContent = extractFullContent({
        meta_title: optimizedContent.meta_title,
        meta_description: optimizedContent.meta_description,
        meta_keywords: optimizedContent.meta_keywords,
        guide_content: optimizedContent.guide_content,
        faq_items: optimizedContent.faq_items
      })

      // 2. 计算目标关键词密度
      const keywordDensity = calculateKeywordDensity(fullContent, [pageData.target_keyword])
      console.log('[SEO Score] 优化后的关键词密度:', keywordDensity)

      // 3. 准备评分数据（使用优化后的新数据）
      const seoGuideData = {
        target_keyword: pageData.target_keyword,
        secondary_keywords: optimizedContent.secondary_keywords || [],
        meta_title: optimizedContent.meta_title || '',
        meta_description: optimizedContent.meta_description || '',
        meta_keywords: optimizedContent.meta_keywords || '',
        guide_content: optimizedContent.guide_content,
        faq_items: optimizedContent.faq_items || []
      }

      // 4. 调用 AI 评分服务
      const scoreResult = await seoAIService.calculateSEOScore(seoGuideData, aiModel)
      console.log('[SEO Score] 优化后的评分结果:', scoreResult)

      // 5. 使用客户端算法重新计算关键词密度评分
      const clientKeywordDensityScore = calculateKeywordDensityScore(
        keywordDensity,
        pageData.target_keyword
      )

      // 6. 直接使用AI返回的总分（不要重新计算）
      const totalScore = scoreResult.total_score
      console.log('[SEO Score] 优化后AI总分:', totalScore)

      // 7. 更新数据库 - 严格保存4个维度
      const { error } = await supabase
        .from('seo_page_variants')
        .update({
          seo_score: totalScore,
          meta_info_quality_score: scoreResult.meta_info_quality_score,
          keyword_optimization_score: scoreResult.keyword_optimization_score,
          content_quality_score: scoreResult.content_quality_score,
          readability_score: scoreResult.readability_score,
          keyword_density_score: clientKeywordDensityScore,
          keyword_density: keywordDensity,
          seo_recommendations: scoreResult.recommendations || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', pageData.id)

      if (error) throw error

      // 8. 更新本地状态 - 严格保存4个维度
      setScoreResult({
        total_score: totalScore,
        meta_info_quality_score: scoreResult.meta_info_quality_score,
        keyword_optimization_score: scoreResult.keyword_optimization_score,
        content_quality_score: scoreResult.content_quality_score,
        readability_score: scoreResult.readability_score,
        keyword_density_score: clientKeywordDensityScore,
        recommendations: scoreResult.recommendations || []
      })

      // 9. 刷新数据
      queryClient.invalidateQueries({ queryKey: ['seo-page-data', templateId, language, keyword, contentTemplate] })
      queryClient.invalidateQueries({ queryKey: ['seo-keywords', templateId, language, contentTemplate] })

      showToast(`重新评分完成！总分: ${totalScore}/100`, 'success')
    } catch (error) {
      console.error('[SEO Score] 评分失败:', error)
      showToast(`评分失败: ${error.message}`, 'error')
    } finally {
      setScoring(false)
    }
  }

  // 点击一键优化按钮
  const handleOneClickOptimize = () => {
    if (!pageData?.id) {
      showToast('无法优化：页面数据不存在', 'error')
      return
    }

    if (!pageData.guide_content) {
      showToast('无法优化：页面内容不存在', 'error')
      return
    }

    if (!scoreResult?.recommendations || scoreResult.recommendations.length === 0) {
      showToast('暂无优化建议', 'info')
      return
    }

    // 显示优化确认对话框
    setShowOptimizeDialog(true)
  }

  // 确认执行优化
  const executeOptimization = async () => {
    setShowOptimizeDialog(false)
    setIsOptimizing(true)
    try {
      console.log('[一键优化] 开始优化，目标关键词:', pageData.target_keyword)

      // 调用本地服务的优化接口
      const response = await fetch('http://localhost:3030/optimize-seo-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language: pageData.language || 'en',
          meta_title: pageData.meta_title,
          meta_description: pageData.meta_description,
          meta_keywords: pageData.meta_keywords,
          guide_content: pageData.guide_content,
          guide_intro: pageData.guide_intro || '',
          target_keyword: pageData.target_keyword,
          long_tail_keywords: [],
          secondary_keywords: pageData.secondary_keywords || [],
          faq_items: pageData.faq_items || [],
          seo_score: scoreResult.total_score,
          seo_recommendations: scoreResult.recommendations
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '优化失败')
      }

      const result = await response.json()
      console.log('[一键优化] 优化成功:', result)

      if (!result.success || !result.data || !result.data.optimized_content) {
        throw new Error('优化结果格式错误')
      }

      const optimizedContent = result.data.optimized_content
      const optimizationSummary = result.data.optimization_summary
      const keyImprovements = result.data.key_improvements

      console.log('[一键优化] 优化摘要:', optimizationSummary)
      console.log('[一键优化] 关键改进:', keyImprovements)

      // 更新数据库
      const { error } = await supabase
        .from('seo_page_variants')
        .update({
          meta_title: optimizedContent.meta_title,
          meta_description: optimizedContent.meta_description,
          meta_keywords: optimizedContent.meta_keywords,
          guide_content: optimizedContent.guide_content,
          guide_intro: optimizedContent.guide_intro || '',
          faq_items: optimizedContent.faq_items,
          secondary_keywords: optimizedContent.secondary_keywords || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', pageData.id)

      if (error) throw error

      // 更新表单数据
      setFormData({
        meta_title: optimizedContent.meta_title || '',
        meta_description: optimizedContent.meta_description || '',
        main_content: optimizedContent.guide_content || '',
        faq: optimizedContent.faq_items || []
      })

      // 刷新数据
      queryClient.invalidateQueries({ queryKey: ['seo-page-data', templateId, language, keyword, contentTemplate] })

      // 显示优化摘要
      const improvementsText = keyImprovements && keyImprovements.length > 0
        ? `\n\n关键改进:\n${keyImprovements.slice(0, 3).map((imp, i) => `${i + 1}. ${imp}`).join('\n')}`
        : ''

      showToast(`优化成功！${optimizationSummary}${improvementsText}`, 'success')

      // 优化完成后自动重新评分（使用优化后的新数据）
      setTimeout(() => {
        handleReScoreWithOptimizedContent(optimizedContent)
      }, 500)
    } catch (error: any) {
      console.error('[一键优化] 优化失败:', error)

      // 特殊处理超时错误
      let errorMessage = error.message || '未知错误'
      if (errorMessage.includes('超时') || errorMessage.includes('timeout')) {
        errorMessage = '⏱️ AI 优化超时（3分钟）\n\n可能原因：\n• 内容过长，AI处理时间较长\n• 网络连接不稳定\n• 本地服务负载较高\n\n建议：\n1. 稍后重试\n2. 或尝试分步优化（优化Meta、优化正文等）'
      } else if (errorMessage.includes('Claude CLI')) {
        errorMessage = `🤖 Claude CLI 错误\n\n${errorMessage}\n\n请确保：\n• 本地3030端口服务正常运行\n• Claude CLI 已正确安装和配置`
      }

      showToast(errorMessage, 'error')
    } finally {
      setIsOptimizing(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab 标签 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab icon={<Edit />} label="编辑" />
          <Tab icon={<Assessment />} label="SEO评分" />
          <Tab icon={<Visibility />} label="预览" />
        </Tabs>
      </Box>

      {/* 关键词标题 */}
      <Box sx={{ px: 3, pt: 2, pb: 1, bgcolor: 'background.default' }}>
        <Typography variant="subtitle2" color="textSecondary">
          当前关键词
        </Typography>
        <Typography variant="h6">{keyword}</Typography>
      </Box>

      {/* Tab 1: 编辑模式 */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {!pageData && (
            <Alert severity="warning">
              该关键词尚未生成内容，请先使用批量生成功能生成内容
            </Alert>
          )}

          <Typography variant="h6">Meta 信息</Typography>

          <TextField
            label="Meta Title"
            fullWidth
            size="small"
            value={formData.meta_title}
            onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
            helperText={`建议 55-60 字符 (当前: ${(formData.meta_title || '').length})`}
          />

          <TextField
            label="Meta Description"
            fullWidth
            size="small"
            multiline
            rows={3}
            value={formData.meta_description}
            onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
            helperText={`建议 150-155 字符 (当前: ${(formData.meta_description || '').length})`}
          />

          <Divider />

          <Typography variant="h6">内容编辑</Typography>

          <TextField
            label="正文内容 (Markdown)"
            fullWidth
            multiline
            rows={20}
            size="small"
            value={formData.main_content}
            onChange={(e) => setFormData({ ...formData, main_content: e.target.value })}
            helperText={`使用 Markdown 格式编写 (当前: ${(formData.main_content || '').length} 字符)`}
            placeholder="# H1 标题

## H2 章节

段落内容...

- 列表项 1
- 列表项 2"
          />

          <Divider />

          <Typography variant="h6">FAQ 管理</Typography>

          <Box>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              当前有 {(formData.faq || []).length} 个 FAQ
            </Typography>
            {formData.faq && formData.faq.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {formData.faq.map((item, index) => (
                  <Box key={index} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Q{index + 1}: {item.question}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      A: {item.answer}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Divider />

          {/* 操作按钮 */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<Save />}
              onClick={() => handleSave(false)}
              disabled={saving || !pageData}
            >
              {saving ? '保存中...' : '保存草稿'}
            </Button>
            <Button
              variant="contained"
              startIcon={<Publish />}
              onClick={() => handleSave(true)}
              disabled={saving || !pageData}
            >
              {saving ? '发布中...' : '发布'}
            </Button>
          </Box>
        </Box>
      </TabPanel>

      {/* Tab 2: SEO 评分 */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {!pageData ? (
            <Alert severity="warning">
              该关键词尚未生成内容，无法进行评分
            </Alert>
          ) : !scoreResult ? (
            <>
              <Alert severity="info">
                该关键词尚未评分，请点击下方"批量评分"按钮进行评分
              </Alert>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Assessment />}
                  onClick={handleReScore}
                  disabled={scoring}
                >
                  {scoring ? '评分中...' : '批量评分'}
                </Button>
              </Box>
              {scoring && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1, textAlign: 'center' }}>
                    正在使用 AI 模型分析 SEO 评分...
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <>
              {/* 左右布局：总分卡片 + 评分详情 */}
              <Grid container spacing={3}>
                {/* 左侧：总分卡片 */}
                <Grid item xs={12} md={5}>
                  <Card
                    sx={{
                      height: '100%',
                      background: (() => {
                        const { color } = getSEOScoreGrade(scoreResult.total_score)
                        return color === 'success'
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : color === 'warning'
                          ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                          : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
                      })(),
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
                          textAlign: 'center',
                          py: 2
                        }}
                      >
                        <Typography variant="h6" gutterBottom>
                          SEO综合评分
                        </Typography>
                        <Box sx={{ my: 2 }}>
                          <Typography variant="h1" fontWeight="bold" sx={{ fontSize: '4rem' }}>
                            {scoreResult.total_score}
                          </Typography>
                          <Typography variant="h5">/100</Typography>
                        </Box>
                        <Chip
                          label={`${getSEOScoreGrade(scoreResult.total_score).grade}级 - ${getSEOScoreGrade(scoreResult.total_score).label}`}
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
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                        <Article color="primary" />
                        <Typography variant="h6" sx={{ flex: 1 }}>评分详情</Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Assessment />}
                          onClick={handleReScore}
                          disabled={scoring}
                        >
                          {scoring ? '评分中...' : '重新评分'}
                        </Button>
                      </Box>

                      {scoring && (
                        <Box sx={{ mb: 2 }}>
                          <LinearProgress />
                          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            正在使用 AI 模型分析 SEO 评分...
                          </Typography>
                        </Box>
                      )}

                      <ScoreBar
                        label="Meta信息质量"
                        score={scoreResult.meta_info_quality_score || 0}
                        maxScore={30}
                        icon={<Article fontSize="small" color="primary" />}
                      />
                      <ScoreBar
                        label="关键词优化"
                        score={scoreResult.keyword_optimization_score || 0}
                        maxScore={25}
                        icon={<Search fontSize="small" color="primary" />}
                      />
                      <ScoreBar
                        label="内容质量"
                        score={scoreResult.content_quality_score || 0}
                        maxScore={25}
                        icon={<Article fontSize="small" color="primary" />}
                      />
                      <ScoreBar
                        label="可读性"
                        score={scoreResult.readability_score || 0}
                        maxScore={20}
                        icon={<Visibility fontSize="small" color="primary" />}
                      />
                    </CardContent>
                  </Card>
                </Grid>

                {/* 改进建议 */}
                {scoreResult.recommendations && scoreResult.recommendations.length > 0 && (
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Lightbulb color="warning" />
                            <Typography variant="h6">
                              AI 改进建议
                            </Typography>
                            <Chip
                              label={`${scoreResult.recommendations.length} 条建议`}
                              size="small"
                              color="warning"
                            />
                          </Box>
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<AutoFixHigh />}
                            onClick={handleOneClickOptimize}
                            disabled={isOptimizing}
                          >
                            {isOptimizing ? '优化中...' : '一键优化'}
                          </Button>
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {scoreResult.recommendations.map((rec: string, index: number) => (
                            <Paper
                              key={index}
                              variant="outlined"
                              sx={{
                                p: 2,
                                display: 'flex',
                                gap: 2,
                                alignItems: 'flex-start',
                                bgcolor: 'background.default',
                                '&:hover': {
                                  bgcolor: 'action.hover'
                                }
                              }}
                            >
                              <Box
                                sx={{
                                  minWidth: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  bgcolor: 'warning.main',
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold',
                                  fontSize: '0.875rem',
                                  flexShrink: 0
                                }}
                              >
                                {index + 1}
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                  {rec}
                                </Typography>
                              </Box>
                            </Paper>
                          ))}
                        </Box>

                        {scoreResult.total_score >= 90 && (
                          <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CheckCircle color="success" />
                              <Typography variant="body2" color="success.dark" fontWeight="medium">
                                内容质量优秀！以上建议可以让内容更加完美。
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </>
          )}
        </Box>
      </TabPanel>

      {/* Tab 3: 预览模式 */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="h6">页面预览</Typography>

          {!pageData && (
            <Alert severity="warning">
              该关键词尚未生成内容，无法预览
            </Alert>
          )}

          {pageData && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Meta 信息预览 */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Meta Title
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {formData.meta_title || '(未设置)'}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Meta Description
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {formData.meta_description || '(未设置)'}
                </Typography>
              </Paper>

              {/* 正文内容预览 */}
              <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  正文内容
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {formData.main_content ? (
                  <Box
                    sx={{
                      '& h1': { fontSize: '2rem', fontWeight: 700, mb: 2, mt: 3 },
                      '& h2': { fontSize: '1.5rem', fontWeight: 600, mb: 2, mt: 3 },
                      '& h3': { fontSize: '1.25rem', fontWeight: 600, mb: 1.5, mt: 2 },
                      '& p': { mb: 2, lineHeight: 1.7 },
                      '& ul, & ol': { mb: 2, pl: 3 },
                      '& li': { mb: 1 },
                      '& code': { bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 1, fontSize: '0.875rem' },
                      '& pre': { bgcolor: 'grey.100', p: 2, borderRadius: 1, overflow: 'auto' },
                      '& blockquote': { borderLeft: 4, borderColor: 'primary.main', pl: 2, ml: 0, fontStyle: 'italic' }
                    }}
                  >
                    <ReactMarkdown>{formData.main_content}</ReactMarkdown>
                  </Box>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    (暂无正文内容)
                  </Typography>
                )}
              </Paper>

              {/* FAQ 预览 */}
              {formData.faq && formData.faq.length > 0 && (
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    常见问题 (FAQ)
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {formData.faq.map((item, index) => (
                      <Box key={index}>
                        <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                          Q{index + 1}: {item.question}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ pl: 2 }}>
                          A: {item.answer}
                        </Typography>
                        {index < formData.faq.length - 1 && <Divider sx={{ mt: 2 }} />}
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}
            </Box>
          )}
        </Box>
      </TabPanel>

      {/* 优化确认对话框 */}
      <Dialog
        open={showOptimizeDialog}
        onClose={() => setShowOptimizeDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHigh color="primary" />
          <Typography variant="h6">AI 一键优化</Typography>
          <Chip label={`${scoreResult?.recommendations?.length || 0} 项待优化`} color="warning" size="small" />
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom sx={{ mb: 2 }}>
            AI 将根据以下建议对内容进行全面优化：
          </Typography>

          <List dense>
            {scoreResult?.recommendations?.map((rec: string, index: number) => (
              <ListItem key={index} sx={{ alignItems: 'flex-start' }}>
                <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                  <Chip
                    label={index + 1}
                    size="small"
                    color="warning"
                    sx={{ width: 28, height: 28, fontSize: '0.75rem' }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={rec}
                  primaryTypographyProps={{
                    variant: 'body2',
                    sx: { whiteSpace: 'pre-wrap' }
                  }}
                />
              </ListItem>
            ))}
          </List>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              ✨ 优化将包括：Meta信息、正文内容、FAQ等所有相关部分
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              ⏱️ 预计耗时：30-60秒
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              🔄 优化完成后将自动重新评分
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowOptimizeDialog(false)} color="inherit">
            取消
          </Button>
          <Button
            onClick={executeOptimization}
            variant="contained"
            color="primary"
            startIcon={<AutoFixHigh />}
          >
            确认优化
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast 提示 */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={closeToast} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default React.memo(PageEditor)
