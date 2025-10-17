/**
 * 优化预览对话框组件
 */

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Paper,
  Divider,
  Tabs,
  Tab
} from '@mui/material'
import { Close, CompareArrows, CheckCircle } from '@mui/icons-material'

interface OptimizationResult {
  optimized_content: {
    meta_title?: string
    meta_description?: string
    meta_keywords?: string
    guide_intro?: string
    guide_content?: string
    faq_items?: Array<{ question: string; answer: string }>
  }
  optimization_summary: string
  key_improvements: string[]
}

interface OptimizationPreviewDialogProps {
  open: boolean
  onClose: () => void
  onApply: () => void
  optimizationResult: OptimizationResult | null
  originalData: {
    meta_title?: string
    meta_description?: string
    meta_keywords?: string
    guide_intro?: string
    guide_content?: string
    faq_items?: Array<{ question: string; answer: string }>
  }
}

export const OptimizationPreviewDialog: React.FC<OptimizationPreviewDialogProps> = ({
  open,
  onClose,
  onApply,
  optimizationResult,
  originalData
}) => {
  const [previewTab, setPreviewTab] = useState(0)

  if (!optimizationResult) {
    return null
  }

  const optimized = optimizationResult.optimized_content

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareArrows color="primary" />
            <Typography variant="h6">AI 优化预览</Typography>
          </Box>
          <Button startIcon={<Close />} onClick={onClose} size="small">
            关闭
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* 优化摘要 */}
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>✨ 优化完成</AlertTitle>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {optimizationResult.optimization_summary}
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              主要改进点：
            </Typography>
            <List dense>
              {optimizationResult.key_improvements.map((improvement, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <CheckCircle fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary={improvement} />
                </ListItem>
              ))}
            </List>
          </Box>
        </Alert>

        {/* Tab 切换 */}
        <Tabs
          value={previewTab}
          onChange={(_, newValue) => setPreviewTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab label="Meta 信息" />
          <Tab label="引言" />
          <Tab label="正文内容" />
          <Tab label="FAQ" />
        </Tabs>

        {/* Meta 信息对比 */}
        {previewTab === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fff3e0' }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  📝 优化前
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="textSecondary">
                  Meta 标题 ({(originalData.meta_title || '').length}字符)
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {originalData.meta_title || '无'}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Meta 描述 ({(originalData.meta_description || '').length}字符)
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {originalData.meta_description || '无'}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Meta 关键词
                </Typography>
                <Typography variant="body2">{originalData.meta_keywords || '无'}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#e8f5e9' }}>
                <Typography variant="subtitle2" color="success.main" gutterBottom>
                  ✨ 优化后
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="textSecondary">
                  Meta 标题 ({(optimized.meta_title || '').length}字符)
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {optimized.meta_title}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Meta 描述 ({(optimized.meta_description || '').length}字符)
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {optimized.meta_description}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Meta 关键词
                </Typography>
                <Typography variant="body2">{optimized.meta_keywords}</Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* 引言对比 */}
        {previewTab === 1 && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fff3e0' }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  📝 优化前 ({(originalData.guide_intro || '').length}字符)
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {originalData.guide_intro || '无'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#e8f5e9' }}>
                <Typography variant="subtitle2" color="success.main" gutterBottom>
                  ✨ 优化后 ({(optimized.guide_intro || '').length}字符)
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {optimized.guide_intro}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* 正文内容对比 */}
        {previewTab === 2 && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper
                variant="outlined"
                sx={{ p: 2, bgcolor: '#fff3e0', maxHeight: 500, overflow: 'auto' }}
              >
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  📝 优化前 ({(originalData.guide_content || '').length}字符)
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                  {originalData.guide_content || '无'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper
                variant="outlined"
                sx={{ p: 2, bgcolor: '#e8f5e9', maxHeight: 500, overflow: 'auto' }}
              >
                <Typography variant="subtitle2" color="success.main" gutterBottom>
                  ✨ 优化后 ({(optimized.guide_content || '').length}字符)
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                  {optimized.guide_content}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* FAQ 对比 */}
        {previewTab === 3 && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fff3e0' }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  📝 优化前 ({(originalData.faq_items || []).length}个问题)
                </Typography>
                <Divider sx={{ my: 1 }} />
                {(originalData.faq_items || []).map((item, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Typography variant="caption" color="primary">
                      Q{index + 1}:
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {item.question}
                    </Typography>
                    <Typography variant="caption" color="primary">
                      A{index + 1}:
                    </Typography>
                    <Typography variant="body2">{item.answer}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#e8f5e9' }}>
                <Typography variant="subtitle2" color="success.main" gutterBottom>
                  ✨ 优化后 ({(optimized.faq_items || []).length}个问题)
                </Typography>
                <Divider sx={{ my: 1 }} />
                {(optimized.faq_items || []).map((item, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Typography variant="caption" color="success.main">
                      Q{index + 1}:
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {item.question}
                    </Typography>
                    <Typography variant="caption" color="success.main">
                      A{index + 1}:
                    </Typography>
                    <Typography variant="body2">{item.answer}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
          </Grid>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} variant="outlined" size="large">
          取消
        </Button>
        <Button
          onClick={onApply}
          variant="contained"
          color="primary"
          size="large"
          startIcon={<CheckCircle />}
        >
          应用优化
        </Button>
      </DialogActions>
    </Dialog>
  )
}
