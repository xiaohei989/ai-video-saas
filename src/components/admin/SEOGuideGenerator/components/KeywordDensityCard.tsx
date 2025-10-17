/**
 * 关键词密度卡片组件
 */

import React from 'react'
import { Grid, Paper, Typography, Box, Chip } from '@mui/material'

interface KeywordDensityCardProps {
  density: Record<string, number>
}

export const KeywordDensityCard: React.FC<KeywordDensityCardProps> = ({ density }) => {
  const entries = Object.entries(density || {})

  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        暂无关键词密度数据
      </Typography>
    )
  }

  return (
    <Grid container spacing={2}>
      {entries.map(([keyword, value]) => {
        const densityValue = value
        let color: 'success' | 'warning' | 'error' = 'error'

        if (densityValue >= 1 && densityValue <= 3) {
          color = 'success'
        } else if (densityValue >= 0.5 && densityValue < 1) {
          color = 'warning'
        } else if (densityValue > 3 && densityValue <= 5) {
          color = 'warning'
        }

        return (
          <Grid item xs={12} sm={6} md={4} key={keyword}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="caption" color="textSecondary" gutterBottom>
                {keyword}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="h5" color={`${color}.main`}>
                  {densityValue.toFixed(2)}%
                </Typography>
                <Chip
                  label={
                    color === 'success'
                      ? '理想'
                      : color === 'warning'
                      ? '可优化'
                      : '需调整'
                  }
                  color={color}
                  size="small"
                />
              </Box>
            </Paper>
          </Grid>
        )
      })}
    </Grid>
  )
}
