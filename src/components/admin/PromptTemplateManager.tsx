/**
 * 提示词模板管理器
 * 简单的CRUD界面，用于查看和编辑数据库中的提示词模板
 * 支持两种提示词：SEO内容生成提示词 + AI评分提示词
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material'
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material'

interface ContentTemplate {
  id: string
  slug: string
  name: string
  description: string | null
  prompt_template: string
  is_active: boolean
  created_at: string
  updated_at: string
}

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
 * 获取所有内容生成模板 (从 seo_content_templates 表)
 */
async function fetchContentTemplates(): Promise<ContentTemplate[]> {
  const { data, error } = await supabase
    .from('seo_content_templates')
    .select('*')
    .order('slug')

  if (error) throw error
  return data || []
}

/**
 * 更新内容生成模板
 */
async function updateContentTemplate(id: string, prompt_template: string): Promise<void> {
  const { error } = await supabase
    .from('seo_content_templates')
    .update({
      prompt_template,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw error
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
 * 更新 AI 提示词模板
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

export default function PromptTemplateManager() {
  const queryClient = useQueryClient()
  const [tabValue, setTabValue] = useState(0)
  const [selectedContentTemplate, setSelectedContentTemplate] = useState<ContentTemplate | null>(null)
  const [selectedAITemplate, setSelectedAITemplate] = useState<AIPromptTemplate | null>(null)
  const [editedContent, setEditedContent] = useState<string>('')
  const [hasChanges, setHasChanges] = useState(false)
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // 获取内容生成模板列表 (从 seo_content_templates)
  const { data: contentTemplates, isLoading } = useQuery({
    queryKey: ['seo-content-templates'],
    queryFn: fetchContentTemplates
  })

  // 获取AI评分模板列表 (从 ai_prompt_templates)
  const { data: aiTemplates, isLoading: aiLoading } = useQuery({
    queryKey: ['ai-prompt-templates'],
    queryFn: fetchAIPrompts
  })

  // 更新内容生成模板
  const updateContentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      updateContentTemplate(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-content-templates'] })
      setHasChanges(false)
      setEditDialogOpen(false)
      setToast({ message: '✅ 内容生成模板保存成功！', severity: 'success' })
    },
    onError: (error: Error) => {
      setToast({ message: `❌ 保存失败: ${error.message}`, severity: 'error' })
    }
  })

  // 更新AI评分模板
  const updateAIMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      updateAIPrompt(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-prompt-templates'] })
      setHasChanges(false)
      setEditDialogOpen(false)
      setToast({ message: '✅ AI评分模板保存成功！', severity: 'success' })
    },
    onError: (error: Error) => {
      setToast({ message: `❌ 保存失败: ${error.message}`, severity: 'error' })
    }
  })

  // 打开内容生成模板编辑对话框
  const handleEditContent = (template: ContentTemplate) => {
    setSelectedContentTemplate(template)
    setSelectedAITemplate(null)
    setEditedContent(template.prompt_template)
    setHasChanges(false)
    setEditDialogOpen(true)
  }

  // 打开AI模板编辑对话框
  const handleEditAI = (template: AIPromptTemplate) => {
    setSelectedAITemplate(template)
    setSelectedContentTemplate(null)
    setEditedContent(template.prompt_template)
    setHasChanges(false)
    setEditDialogOpen(true)
  }

  // 处理内容变化
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value)
    const originalContent = selectedContentTemplate?.prompt_template || selectedAITemplate?.prompt_template || ''
    setHasChanges(originalContent !== e.target.value)
  }

  // 保存
  const handleSave = () => {
    if (hasChanges) {
      if (selectedContentTemplate) {
        updateContentMutation.mutate({ id: selectedContentTemplate.id, content: editedContent })
      } else if (selectedAITemplate) {
        updateAIMutation.mutate({ id: selectedAITemplate.id, content: editedContent })
      }
    }
  }

  // 重置
  const handleReset = () => {
    if (selectedContentTemplate) {
      setEditedContent(selectedContentTemplate.prompt_template)
      setHasChanges(false)
    } else if (selectedAITemplate) {
      setEditedContent(selectedAITemplate.prompt_template)
      setHasChanges(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📝 提示词模板管理
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        管理所有AI提示词模板（SEO内容生成 + AI评分）
      </Typography>

      {/* Tab 切换 */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab icon={<DescriptionIcon />} label="SEO内容生成模板" />
          <Tab icon={<AssessmentIcon />} label="AI评分模板" />
        </Tabs>
      </Card>

      {/* Tab 0: SEO内容生成模板 */}
      {tabValue === 0 && (
        <>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card>
              <CardContent>
                <Alert severity="info" sx={{ mb: 2 }}>
                  这些模板用于生成 SEO 页面内容（来自 <code>seo_content_templates</code> 表）
                  <br />
                  <Chip label="how-to" size="small" sx={{ mt: 1, mr: 0.5 }} /> 如何做教程
                  <Chip label="alternatives" size="small" sx={{ mt: 1, mr: 0.5 }} /> 竞品对比
                  <Chip label="platform-specific" size="small" sx={{ mt: 1 }} /> 平台专属
                </Alert>
                <List>
                  {contentTemplates?.map((template) => (
                    <ListItem
                      key={template.id}
                      secondaryAction={
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditContent(template)}
                        >
                          编辑
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <DescriptionIcon fontSize="small" />
                            <Typography variant="h6">{template.name}</Typography>
                            <Chip label={template.slug} size="small" />
                          </Stack>
                        }
                        secondary={
                          <React.Fragment>
                            {template.description && (
                              <span style={{ display: 'block', marginBottom: '4px' }}>
                                {template.description}
                              </span>
                            )}
                            <span style={{ display: 'block' }}>
                              {(template.prompt_template.length / 1024).toFixed(1)} KB ·
                              更新于 {new Date(template.updated_at).toLocaleString('zh-CN')}
                            </span>
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Tab 1: AI评分模板 */}
      {tabValue === 1 && (
        <>
          {aiLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card>
              <CardContent>
                <Alert severity="info" sx={{ mb: 2 }}>
                  这些模板用于 AI 智能评分和内容优化（来自 <code>ai_prompt_templates</code> 表）
                  <br />
                  <Chip label="seo-score" size="small" sx={{ mt: 1, mr: 0.5 }} /> SEO智能评分（5维度100分）
                  <Chip label="seo-optimize" size="small" sx={{ mt: 1, mr: 0.5 }} /> SEO一键优化
                  <Chip label="eeat-score" size="small" sx={{ mt: 1 }} /> E-E-A-T评分（10维度100分）
                </Alert>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>模板标识</TableCell>
                        <TableCell>显示名称</TableCell>
                        <TableCell>分类</TableCell>
                        <TableCell>版本</TableCell>
                        <TableCell>大小</TableCell>
                        <TableCell>变量数</TableCell>
                        <TableCell>更新时间</TableCell>
                        <TableCell align="right">操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {aiTemplates?.map((template) => (
                        <TableRow key={template.id} hover>
                          <TableCell>
                            <code style={{
                              fontSize: '0.9em',
                              color: '#1976d2',
                              backgroundColor: '#e3f2fd',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
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
                            <Chip label={template.category} size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip label={`v${template.version}`} size="small" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {(template.prompt_template.length / 1024).toFixed(1)} KB
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
                                day: '2-digit'
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<EditIcon />}
                              onClick={() => handleEditAI(template)}
                            >
                              编辑
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 编辑对话框 */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !hasChanges && setEditDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">
                编辑模板: {selectedContentTemplate?.name || selectedAITemplate?.display_name}
              </Typography>
              {selectedContentTemplate && (
                <Typography variant="caption" color="text.secondary">
                  {selectedContentTemplate.slug} - 内容生成模板
                </Typography>
              )}
              {selectedAITemplate && (
                <Typography variant="caption" color="text.secondary">
                  {selectedAITemplate.name} (v{selectedAITemplate.version}) - {selectedAITemplate.category}
                </Typography>
              )}
            </Box>
            {hasChanges && <Chip label="未保存" color="warning" size="small" />}
          </Stack>
        </DialogTitle>

        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={25}
            value={editedContent}
            onChange={handleContentChange}
            variant="outlined"
            sx={{
              mt: 1,
              '& .MuiInputBase-root': {
                fontFamily: 'monospace',
                fontSize: '13px',
                lineHeight: '1.6'
              }
            }}
          />

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            支持的变量占位符: {'{{targetKeyword}}'}, {'{{platform}}'}, {'{{audience}}'}, {'{{recommendedWordCount}}'} 等
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            取消
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleReset}
            disabled={!hasChanges}
          >
            重置
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!hasChanges || (updateContentMutation.isPending || updateAIMutation.isPending)}
          >
            {(updateContentMutation.isPending || updateAIMutation.isPending) ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast通知 */}
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast && <Alert severity={toast.severity}>{toast.message}</Alert>}
      </Snackbar>
    </Box>
  )
}
