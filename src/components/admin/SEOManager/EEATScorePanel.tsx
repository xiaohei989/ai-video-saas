/**
 * E-E-A-T 评分面板组件
 * 这是 "E-E-A-T评分" Tab 的完整内容
 */

import React, { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Tooltip,
  Divider
} from '@mui/material'
import {
  Assessment,
  TrendingUp,
  Security,
  Lightbulb,
  CheckCircle,
  Article,
  Search,
  Visibility,
  AutoFixHigh
} from '@mui/icons-material'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { calculateEEATScore, getEEATScoreGrade } from '@/services/eeatScoreCalculator'
import { EEATRadarChart } from './EEATRadarChart'
import { EngagementMetricsCard } from './EngagementMetricsCard'
import type { EEATScoreResult } from '@/types/eeat'

// 评分进度条组件（内联）
interface ScoreBarProps {
  label: string
  score: number
  maxScore: number
  icon: React.ReactNode
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, score, maxScore, icon }) => {
  const percentage = Math.min((score / maxScore) * 100, 100)
  const color = percentage >= 80 ? 'success' : percentage >= 60 ? 'warning' : 'error'

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
        {icon}
        <Typography variant="body2" fontWeight="medium">
          {label}
        </Typography>
        <Typography variant="body2" color="textSecondary" ml="auto">
          {Math.round(score)}/{maxScore}分
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

interface EEATScorePanelProps {
  pageData: any
  aiModel: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli'
  templateId: string | null
  language: string
  keyword: string | null
  contentTemplate: string
}

export const EEATScorePanel: React.FC<EEATScorePanelProps> = ({
  pageData,
  aiModel,
  templateId,
  language,
  keyword,
  contentTemplate
}) => {
  const queryClient = useQueryClient()

  const [scoring, setScoring] = useState(false)
  const [eeatScore, setEeatScore] = useState<EEATScoreResult | null>(null)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' as 'success' | 'error' | 'info' })

  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setToast({ open: true, message, severity })
    setTimeout(() => setToast({ ...toast, open: false }), 5000)
  }

  // 从 pageData 加载已有的 E-E-A-T 评分
  useEffect(() => {
    if (pageData?.eeat_total_score) {
      console.log('[E-E-A-T Panel] 加载已有评分:', pageData.eeat_total_score)
      setEeatScore({
        total_score: pageData.eeat_total_score || 0,
        trustworthiness_score: pageData.eeat_trustworthiness_score || 0,
        authoritativeness_score: pageData.eeat_authoritativeness_score || 0,
        expertise_score: pageData.eeat_expertise_score || 0,
        comprehensiveness_score: pageData.eeat_comprehensiveness_score || 0,
        information_gain_score: pageData.eeat_information_gain_score || 0,
        structured_quality_score: pageData.eeat_structured_quality_score || 0,
        engagement_score: pageData.eeat_engagement_score || 0,
        readability_score: pageData.eeat_readability_score || 0,
        keyword_optimization_score: pageData.eeat_keyword_optimization_score || 0,
        keyword_density_score: pageData.eeat_keyword_density_score || 0,
        keyword_density: {},
        recommendations: pageData.eeat_recommendations || []
      })
    } else {
      setEeatScore(null)
    }
  }, [pageData])

  /**
   * 执行 E-E-A-T 评分
   */
  const handleEEATScore = async () => {
    if (!pageData || !pageData.id) {
      showToast('无法评分：页面数据不存在', 'error')
      return
    }

    setScoring(true)

    try {
      console.log('[E-E-A-T Panel] 开始评分，AI模型:', aiModel)

      // 调用 E-E-A-T 评分服务
      const result = await calculateEEATScore(
        {
          language: pageData.language || 'en',
          meta_title: pageData.meta_title,
          meta_description: pageData.meta_description,
          meta_keywords: pageData.meta_keywords,
          guide_intro: pageData.guide_intro || '',
          guide_content: pageData.guide_content,
          faq_items: pageData.faq_items || [],
          target_keyword: pageData.target_keyword,
          long_tail_keywords: [],
          secondary_keywords: pageData.secondary_keywords || [],
          page_views: pageData.page_views || 0,
          unique_visitors: pageData.unique_visitors || 0,
          avg_time_on_page: pageData.avg_time_on_page || 0,
          bounce_rate: pageData.bounce_rate || 0,
          conversion_rate: pageData.conversion_rate || 0
        },
        aiModel
      )

      console.log('[E-E-A-T Panel] 评分完成:', result)

      // 保存到数据库
      const { error } = await supabase
        .from('seo_page_variants')
        .update({
          eeat_total_score: result.total_score,
          eeat_trustworthiness_score: result.trustworthiness_score,
          eeat_authoritativeness_score: result.authoritativeness_score,
          eeat_expertise_score: result.expertise_score,
          eeat_comprehensiveness_score: result.comprehensiveness_score,
          eeat_information_gain_score: result.information_gain_score,
          eeat_structured_quality_score: result.structured_quality_score,
          eeat_engagement_score: result.engagement_score,
          eeat_readability_score: result.readability_score,
          eeat_keyword_optimization_score: result.keyword_optimization_score,
          eeat_keyword_density_score: result.keyword_density_score,
          eeat_recommendations: result.recommendations,
          eeat_last_scored_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', pageData.id)

      if (error) {
        throw error
      }

      // 更新本地状态
      setEeatScore(result)

      // 刷新数据
      queryClient.invalidateQueries({ queryKey: ['seo-page-data', templateId, language, keyword, contentTemplate] })
      queryClient.invalidateQueries({ queryKey: ['seo-keywords', templateId, language, contentTemplate] })

      showToast(`✅ E-E-A-T 评分完成！总分: ${result.total_score}/100`, 'success')

    } catch (error) {
      console.error('[E-E-A-T Panel] 评分失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      showToast(`❌ 评分失败: ${errorMessage}`, 'error')
    } finally {
      setScoring(false)
    }
  }

  // 如果没有页面数据
  if (!pageData) {
    return (
      <Box>
        <Alert severity="warning">
          该关键词尚未生成内容，无法进行 E-E-A-T 评分
        </Alert>
      </Box>
    )
  }

  // 如果没有评分
  if (!eeatScore) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Alert severity="info" icon={<Security />}>
          <Typography variant="body2" gutterBottom>
            该关键词尚未进行 E-E-A-T 评分（Google 2025 标准）
          </Typography>
          <Typography variant="caption">
            E-E-A-T = Experience + Expertise + Authoritativeness + Trustworthiness
          </Typography>
        </Alert>

        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            color="primary"
            startIcon={scoring ? <CircularProgress size={20} /> : <Assessment />}
            onClick={handleEEATScore}
            disabled={scoring}
            sx={{ minWidth: 240 }}
          >
            {scoring ? 'AI 智能评分中...' : 'AI 智能评分 (E-E-A-T)'}
          </Button>
        </Box>

        {scoring && (
          <Box>
            <LinearProgress />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1, textAlign: 'center' }}>
              正在使用 AI 模型进行 E-E-A-T 深度分析... (预计 30-60 秒)
            </Typography>
          </Box>
        )}

        {/* 说明卡片 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              💡 什么是 E-E-A-T？
            </Typography>
            <Typography variant="body2" paragraph>
              E-E-A-T 是 Google 2025 年搜索质量评估的核心标准：
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2">• <strong>Experience (经验性)</strong>: 第一手实践经验</Typography>
              <Typography variant="body2">• <strong>Expertise (专业性)</strong>: 领域专业知识</Typography>
              <Typography variant="body2">• <strong>Authoritativeness (权威性)</strong>: 行业权威地位</Typography>
              <Typography variant="body2">• <strong>Trustworthiness (可信度)</strong>: 内容可信程度 (最重要)</Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="textSecondary">
              根据 Google Search Quality Rater Guidelines (2025年9月更新)
            </Typography>
          </CardContent>
        </Card>
      </Box>
    )
  }

  // 获取评分等级
  const { grade, color, label } = getEEATScoreGrade(eeatScore.total_score)

  // 已有评分，显示完整评分详情
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Toast 提示 */}
      {toast.open && (
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>
          {toast.message}
        </Alert>
      )}

      {/* 总分卡片 + 雷达图 */}
      <Grid container spacing={3}>
        {/* 左侧：总分卡片 */}
        <Grid item xs={12} md={5}>
          <Card
            sx={{
              height: '100%',
              background: (() => {
                if (color === 'success') return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                if (color === 'info') return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                if (color === 'warning') return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                return 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Security fontSize="large" />
                  <Typography variant="h6">E-E-A-T 综合评分</Typography>
                </Box>
                <Box sx={{ my: 2 }}>
                  <Typography variant="h1" fontWeight="bold" sx={{ fontSize: '4rem' }}>
                    {eeatScore.total_score}
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
                <Typography variant="caption" sx={{ mt: 2, opacity: 0.9 }}>
                  Google 2025 搜索质量标准
                </Typography>
                <TrendingUp sx={{ fontSize: 60, opacity: 0.2, mt: 2 }} />

                {/* 重新评分按钮 */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={scoring ? <CircularProgress size={16} /> : <Assessment />}
                  onClick={handleEEATScore}
                  disabled={scoring}
                  sx={{
                    mt: 2,
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.5)',
                    '&:hover': {
                      borderColor: 'white',
                      bgcolor: 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  {scoring ? '评分中...' : '重新评分'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 右侧：E-E-A-T 雷达图 */}
        <Grid item xs={12} md={7}>
          <EEATRadarChart
            trust={eeatScore.trustworthiness_score}
            authority={eeatScore.authoritativeness_score}
            expertise={eeatScore.expertise_score}
            experience={eeatScore.information_gain_score}
          />
        </Grid>
      </Grid>

      {/* 详细评分 - 四个维度 */}
      <Grid container spacing={3}>
        {/* 1. 信任度与可信度 (35分) */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🛡️ 信任度与可信度 (35分)
              </Typography>
              <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 2 }}>
                Trustworthiness is the most important - Google 2025
              </Typography>
              <ScoreBar
                label="可信度"
                score={eeatScore.trustworthiness_score}
                maxScore={15}
                icon={<Security fontSize="small" color="primary" />}
              />
              <ScoreBar
                label="权威性"
                score={eeatScore.authoritativeness_score}
                maxScore={10}
                icon={<TrendingUp fontSize="small" color="primary" />}
              />
              <ScoreBar
                label="专业性"
                score={eeatScore.expertise_score}
                maxScore={10}
                icon={<CheckCircle fontSize="small" color="primary" />}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* 2. 内容质量与深度 (30分) */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📝 内容质量与深度 (30分)
              </Typography>
              <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 2 }}>
                Consistent Publication of Satisfying Content
              </Typography>
              <ScoreBar
                label="内容全面性"
                score={eeatScore.comprehensiveness_score}
                maxScore={12}
                icon={<Article fontSize="small" color="primary" />}
              />
              <ScoreBar
                label="信息增益/原创性"
                score={eeatScore.information_gain_score}
                maxScore={10}
                icon={<Lightbulb fontSize="small" color="primary" />}
              />
              <ScoreBar
                label="结构化质量"
                score={eeatScore.structured_quality_score}
                maxScore={8}
                icon={<Article fontSize="small" color="primary" />}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* 3. 用户满意度 (20分) - 使用专门的卡片组件 */}
        <Grid item xs={12} md={6}>
          <EngagementMetricsCard
            score={eeatScore.engagement_score}
            pageViews={pageData.page_views || 0}
            avgTime={pageData.avg_time_on_page || 0}
            bounceRate={pageData.bounce_rate || 0}
            conversionRate={pageData.conversion_rate || 0}
          />
        </Grid>

        {/* 4. 技术SEO (15分) */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔍 技术SEO (15分)
              </Typography>
              <ScoreBar
                label="关键词优化"
                score={eeatScore.keyword_optimization_score}
                maxScore={8}
                icon={<Search fontSize="small" color="primary" />}
              />
              <ScoreBar
                label="关键词密度"
                score={eeatScore.keyword_density_score}
                maxScore={7}
                icon={<Search fontSize="small" color="primary" />}
              />
              <ScoreBar
                label="可读性"
                score={eeatScore.readability_score}
                maxScore={8}
                icon={<Visibility fontSize="small" color="primary" />}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI 优化建议 */}
      {eeatScore.recommendations && eeatScore.recommendations.length > 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lightbulb color="warning" />
                <Typography variant="h6">
                  💡 E-E-A-T 优化建议
                </Typography>
                <Chip
                  label={`${eeatScore.recommendations.length} 条建议`}
                  size="small"
                  color="warning"
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {eeatScore.recommendations.map((rec, index) => (
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

            {eeatScore.total_score >= 90 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle color="success" />
                  <Typography variant="body2" color="success.dark" fontWeight="medium">
                    🎉 E-E-A-T 评分卓越！符合 Google 2025 最高标准。
                  </Typography>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
