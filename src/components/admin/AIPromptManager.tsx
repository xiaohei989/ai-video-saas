/**
 * AI 提示词模板管理页面
 * 管理 ai_prompt_templates 表中的提示词（SEO评分、E-E-A-T评分等）
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  Stack,
  CircularProgress
} from '@mui/material'
import {
  Edit as EditIcon,
  Visibility as ViewIcon,
  Code as CodeIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon
} from '@mui/icons-material'

interface AIPromptTemplate {
  id: string
  name: string
  display_name: string
  description: string | null
  category: string
  prompt_template: string
  required_variables: string[]
  version: number
  is_active: boolean
  updated_at: string
}

/**
 * 获取所有 AI 提示词模板
 */
async function fetchAIPrompts(): Promise<AIPromptTemplate[]> {
  const { data, error } = await supabase
    .from('ai_prompt_templates')
    .select('*')
    .order('category')
    .order('name')

  if (error) throw error
  return data || []
}

/**
 * 更新提示词模板
 */
async function updateAIPrompt(id: string, prompt_template: string): Promise<void> {
  const { error } = await supabase
    .from('ai_prompt_templates')
    .update({
      prompt_template,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw error
}

export default function AIPromptManager() {
  const queryClient = useQueryClient()
  const [selectedTemplate, setSelectedTemplate] = useState<AIPromptTemplate | null>(null)
  const [editedContent, setEditedContent] = useState<string>('')
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  // 加载模板列表
  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ['ai-prompt-templates'],
    queryFn: fetchAIPrompts
  })

  // 更新模板
  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      updateAIPrompt(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-prompt-templates'] })
      setEditDialogOpen(false)
      setToast({ message: '✅ 提示词模板保存成功！', severity: 'success' })
    },
    onError: (error: Error) => {
      setToast({ message: `❌ 保存失败: ${error.message}`, severity: 'error' })
    }
  })

  // 过滤后的模板列表
  const filteredTemplates = categoryFilter === 'all'
    ? templates
    : templates?.filter(t => t.category === categoryFilter)

  // 获取所有分类
  const categories = ['all', ...(templates ? Array.from(new Set(templates.map(t => t.category))) : [])]

  // 打开查看对话框
  const handleView = (template: AIPromptTemplate) => {
    setSelectedTemplate(template)
    setViewDialogOpen(true)
  }

  // 打开编辑对话框
  const handleEdit = (template: AIPromptTemplate) => {
    setSelectedTemplate(template)
    setEditedContent(template.prompt_template)
    setEditDialogOpen(true)
  }

  // 保存编辑
  const handleSave = () => {
    if (selectedTemplate) {
      updateMutation.mutate({
        id: selectedTemplate.id,
        content: editedContent
      })
    }
  }

  // 复制提示词
  const handleCopy = (template: AIPromptTemplate) => {
    navigator.clipboard.writeText(template.prompt_template)
    setToast({ message: '✅ 提示词已复制到剪贴板', severity: 'success' })
  }

  // 分类显示名称
  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      all: '全部',
      scoring: '评分',
      generation: '内容生成',
      optimization: '内容优化'
    }
    return labels[category] || category
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* 页面标题 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          AI 提示词模板管理
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
          disabled={isLoading}
        >
          刷新
        </Button>
      </Box>

      {/* 说明卡片 */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          集中管理所有 AI 评分提示词模板。提示词存储在 <code>ai_prompt_templates</code> 表中，支持版本控制和在线编辑。
          <br />
          <strong>当前模板：</strong>
          <Chip label="seo-score (SEO评分)" size="small" sx={{ ml: 1, mr: 0.5 }} />
          <Chip label="eeat-score (E-E-A-T评分)" size="small" sx={{ mr: 0.5 }} />
        </Typography>
      </Alert>

      {/* 分类过滤 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Tabs
            value={categoryFilter}
            onChange={(_, newValue) => setCategoryFilter(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {categories.map(category => (
              <Tab
                key={category}
                value={category}
                label={getCategoryLabel(category)}
              />
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* 模板列表表格 */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>模板标识</TableCell>
                <TableCell>显示名称</TableCell>
                <TableCell>分类</TableCell>
                <TableCell>版本</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>长度</TableCell>
                <TableCell>变量数</TableCell>
                <TableCell>更新时间</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!filteredTemplates || filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary">
                      没有找到提示词模板
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((template) => (
                  <TableRow key={template.id} hover>
                    <TableCell>
                      <code style={{ fontSize: '0.9em', color: '#1976d2', backgroundColor: '#e3f2fd', padding: '2px 6px', borderRadius: '4px' }}>
                        {template.name}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {template.display_name}
                      </Typography>
                      {template.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {template.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getCategoryLabel(template.category)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={`v${template.version}`} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={template.is_active ? '启用' : '禁用'}
                        size="small"
                        color={template.is_active ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {template.prompt_template.length.toLocaleString()} 字符
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {template.required_variables.length} 个
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(template.updated_at).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleView(template)}
                        title="查看详情"
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(template)}
                        title="编辑提示词"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(template)}
                        title="复制提示词"
                      >
                        <CodeIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 查看详情对话框 */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedTemplate?.display_name}
          <Typography variant="caption" display="block" color="text.secondary">
            {selectedTemplate?.name} (v{selectedTemplate?.version})
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {selectedTemplate && (
            <Stack spacing={2}>
              {/* 描述 */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  描述
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedTemplate.description || '无描述'}
                </Typography>
              </Box>

              {/* 必需变量 */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  必需变量 ({selectedTemplate.required_variables.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selectedTemplate.required_variables.map((varName) => (
                    <Chip
                      key={varName}
                      label={`{{${varName}}}`}
                      size="small"
                      variant="outlined"
                      sx={{ fontFamily: 'monospace' }}
                    />
                  ))}
                </Box>
              </Box>

              {/* 提示词内容 */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  提示词内容 ({selectedTemplate.prompt_template.length.toLocaleString()} 字符)
                </Typography>
                <TextField
                  multiline
                  rows={15}
                  fullWidth
                  value={selectedTemplate.prompt_template}
                  InputProps={{
                    readOnly: true,
                    style: { fontFamily: 'monospace', fontSize: '0.85em' }
                  }}
                />
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => selectedTemplate && handleCopy(selectedTemplate)}>
            复制提示词
          </Button>
          <Button onClick={() => setViewDialogOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          编辑提示词：{selectedTemplate?.display_name}
          <Typography variant="caption" display="block" color="text.secondary">
            {selectedTemplate?.name}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            ⚠️ 修改提示词会影响所有使用此模板的功能。请谨慎编辑并测试。
          </Alert>
          <TextField
            multiline
            rows={20}
            fullWidth
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            InputProps={{
              style: { fontFamily: 'monospace', fontSize: '0.85em' }
            }}
            helperText={`${editedContent.length.toLocaleString()} 字符`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            取消
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast 通知 */}
      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.severity}
          onClose={() => setToast(null)}
          sx={{ width: '100%' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
