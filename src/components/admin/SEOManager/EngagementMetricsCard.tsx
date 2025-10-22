/**
 * 用户参与度指标卡片组件
 * 显示基于真实数据的用户满意度指标
 */

import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Tooltip,
  Chip
} from '@mui/material'
import {
  TrendingUp,
  Schedule,
  ExitToApp,
  ShoppingCart,
  Visibility
} from '@mui/icons-material'

interface EngagementMetricsCardProps {
  score: number // 0-12
  pageViews: number
  avgTime: number // 秒
  bounceRate: number // 百分比
  conversionRate: number // 百分比
}

export const EngagementMetricsCard: React.FC<EngagementMetricsCardProps> = ({
  score,
  pageViews,
  avgTime,
  bounceRate,
  conversionRate
}) => {
  // 计算评分百分比
  const scorePercentage = (score / 12) * 100

  // 格式化停留时间
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  // 获取评分颜色
  const getScoreColor = (): 'success' | 'info' | 'warning' | 'error' => {
    if (score >= 10) return 'success'
    if (score >= 8) return 'info'
    if (score >= 6) return 'warning'
    return 'error'
  }

  // 获取指标颜色
  const getBounceRateColor = () => {
    if (bounceRate <= 40) return 'success'
    if (bounceRate <= 55) return 'warning'
    return 'error'
  }

  const getConversionColor = () => {
    if (conversionRate >= 5) return 'success'
    if (conversionRate >= 2) return 'warning'
    return 'error'
  }

  return (
    <Card>
      <CardContent>
        {/* 标题 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="primary" />
            <Typography variant="h6">👥 用户满意度</Typography>
          </Box>
          <Chip
            label={`${score}/12 分`}
            color={getScoreColor()}
            size="small"
          />
        </Box>

        {/* 总分进度条 */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="textSecondary">
              用户参与度评分 (自动计算)
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {score}/12 分
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={scorePercentage}
            color={getScoreColor()}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        {/* 分隔线 */}
        <Typography variant="caption" color="textSecondary" sx={{ mb: 1.5, display: 'block' }}>
          基于真实用户数据：
        </Typography>

        {/* 指标列表 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* 停留时间 */}
          <Tooltip title="Google 追踪 'long clicks' - 停留时间越长，内容质量越高">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule fontSize="small" color="action" />
              <Typography variant="body2" sx={{ flex: 1 }}>
                停留时间
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {formatTime(avgTime)}
              </Typography>
              {avgTime >= 180 && <Chip label="优秀" color="success" size="small" />}
              {avgTime >= 120 && avgTime < 180 && <Chip label="良好" color="info" size="small" />}
              {avgTime >= 60 && avgTime < 120 && <Chip label="及格" color="warning" size="small" />}
              {avgTime < 60 && avgTime >= 30 && <Chip label="偏低" color="warning" size="small" />}
              {avgTime < 30 && <Chip label="很低" color="error" size="small" />}
            </Box>
          </Tooltip>

          {/* 跳出率 */}
          <Tooltip title="跳出率越低，说明用户找到了想要的内容">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ExitToApp fontSize="small" color="action" />
              <Typography variant="body2" sx={{ flex: 1 }}>
                跳出率
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {bounceRate.toFixed(1)}%
              </Typography>
              <Chip
                label={bounceRate <= 40 ? '优秀' : bounceRate <= 55 ? '良好' : bounceRate <= 70 ? '及格' : '偏高'}
                color={getBounceRateColor()}
                size="small"
              />
            </Box>
          </Tooltip>

          {/* 转化率 */}
          <Tooltip title="转化率反映内容是否真正帮助用户解决问题">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingCart fontSize="small" color="action" />
              <Typography variant="body2" sx={{ flex: 1 }}>
                转化率
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {conversionRate.toFixed(1)}%
              </Typography>
              <Chip
                label={conversionRate >= 5 ? '优秀' : conversionRate >= 2 ? '良好' : '一般'}
                color={getConversionColor()}
                size="small"
              />
            </Box>
          </Tooltip>

          {/* 访问量 */}
          <Tooltip title="访问量反映内容的吸引力和搜索排名">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Visibility fontSize="small" color="action" />
              <Typography variant="body2" sx={{ flex: 1 }}>
                访问量
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {pageViews.toLocaleString()}
              </Typography>
              {pageViews >= 1000 && <Chip label="热门" color="success" size="small" />}
              {pageViews >= 100 && pageViews < 1000 && <Chip label="良好" color="info" size="small" />}
              {pageViews < 100 && <Chip label="新页面" color="default" size="small" />}
            </Box>
          </Tooltip>
        </Box>

        {/* 提示信息 */}
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'info.light', borderRadius: 1, opacity: 0.8 }}>
          <Typography variant="caption" color="info.dark">
            💡 根据 2024 Google API 泄露，Google 追踪用户在页面的停留时间（"long clicks"）作为内容质量信号
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}
