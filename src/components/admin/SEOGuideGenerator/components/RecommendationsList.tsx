/**
 * 优化建议列表组件
 */

import React from 'react'
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import { CheckCircle, Warning, Error as ErrorIcon, Lightbulb } from '@mui/icons-material'

interface RecommendationsListProps {
  recommendations: string[]
}

export const RecommendationsList: React.FC<RecommendationsListProps> = ({
  recommendations
}) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 2,
          bgcolor: 'success.light',
          color: 'success.dark',
          borderRadius: 1
        }}
      >
        <CheckCircle />
        <Typography variant="body2">
          ✨ 太棒了！当前内容质量优秀，无需额外优化建议。
        </Typography>
      </Box>
    )
  }

  return (
    <List>
      {recommendations.map((rec, index) => {
        const isHighPriority =
          rec.includes('严重') || rec.includes('缺少') || rec.includes('过低')
        const isMediumPriority = rec.includes('建议') || rec.includes('偏')

        return (
          <ListItem key={index} alignItems="flex-start">
            <ListItemIcon>
              {isHighPriority ? (
                <ErrorIcon color="error" />
              ) : isMediumPriority ? (
                <Warning color="warning" />
              ) : (
                <Lightbulb color="info" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={rec}
              primaryTypographyProps={{
                variant: 'body2',
                color: isHighPriority
                  ? 'error.main'
                  : isMediumPriority
                  ? 'warning.main'
                  : 'textPrimary'
              }}
            />
          </ListItem>
        )
      })}
    </List>
  )
}
