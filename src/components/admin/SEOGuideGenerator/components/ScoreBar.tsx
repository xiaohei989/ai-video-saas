/**
 * 评分进度条组件
 */

import React from 'react'
import { Box, Typography, LinearProgress } from '@mui/material'

interface ScoreBarProps {
  label: string
  score: number
  maxScore: number
  icon: React.ReactNode
}

export const ScoreBar: React.FC<ScoreBarProps> = ({ label, score, maxScore, icon }) => {
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
