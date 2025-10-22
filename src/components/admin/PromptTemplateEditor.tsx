/**
 * 提示词模板编辑器
 * 用于编辑 prompts/content-generation 下的Markdown模板文件
 */

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  Stack
} from '@mui/material'
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Description as DescriptionIcon
} from '@mui/icons-material'

const API_BASE = 'http://localhost:3031/api/prompt-templates'

interface PromptTemplate {
  slug: string
  filename: string
  title: string
  size: number
  path: string
}

interface TemplateContent {
  slug: string
  content: string
}

/**
 * 获取模板列表
 */
async function fetchTemplateList(): Promise<PromptTemplate[]> {
  const res = await fetch(API_BASE)
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.data
}

/**
 * 获取模板内容
 */
async function fetchTemplateContent(slug: string): Promise<TemplateContent> {
  const res = await fetch(`${API_BASE}/${slug}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.data
}

/**
 * 保存模板内容
 */
async function saveTemplateContent(slug: string, content: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
}

export default function PromptTemplateEditor() {
  const queryClient = useQueryClient()
  const [selectedSlug, setSelectedSlug] = useState<string>('')
  const [editedContent, setEditedContent] = useState<string>('')
  const [hasChanges, setHasChanges] = useState(false)
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  // 获取模板列表
  const { data: templates, isLoading: loadingList } = useQuery({
    queryKey: ['prompt-templates'],
    queryFn: fetchTemplateList
  })

  // 获取模板内容
  const { data: currentTemplate, isLoading: loadingContent } = useQuery({
    queryKey: ['prompt-template', selectedSlug],
    queryFn: () => fetchTemplateContent(selectedSlug),
    enabled: !!selectedSlug
  })

  // 保存模板
  const saveMutation = useMutation({
    mutationFn: ({ slug, content }: { slug: string; content: string }) =>
      saveTemplateContent(slug, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-templates'] })
      queryClient.invalidateQueries({ queryKey: ['prompt-template', selectedSlug] })
      setHasChanges(false)
      setToast({ message: '模板保存成功！', severity: 'success' })
    },
    onError: (error: Error) => {
      setToast({ message: `保存失败: ${error.message}`, severity: 'error' })
    }
  })

  // 当选中模板变化时，更新编辑内容
  useEffect(() => {
    if (currentTemplate) {
      setEditedContent(currentTemplate.content)
      setHasChanges(false)
    }
  }, [currentTemplate])

  // 处理内容变化
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value)
    setHasChanges(currentTemplate?.content !== e.target.value)
  }

  // 保存
  const handleSave = () => {
    if (selectedSlug && hasChanges) {
      saveMutation.mutate({ slug: selectedSlug, content: editedContent })
    }
  }

  // 重置
  const handleReset = () => {
    if (currentTemplate) {
      setEditedContent(currentTemplate.content)
      setHasChanges(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📝 提示词模板编辑器
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        编辑 prompts/content-generation 下的Markdown模板文件
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 3 }}>
        {/* 左侧：模板列表 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              模板列表
            </Typography>

            {loadingList ? (
              <CircularProgress size={24} />
            ) : (
              <List>
                {templates?.map((template) => (
                  <ListItem key={template.slug} disablePadding>
                    <ListItemButton
                      selected={selectedSlug === template.slug}
                      onClick={() => setSelectedSlug(template.slug)}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <DescriptionIcon fontSize="small" />
                            <span>{template.filename}</span>
                          </Stack>
                        }
                        secondary={`${(template.size / 1024).toFixed(1)} KB`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* 右侧：编辑器 */}
        <Card>
          <CardContent>
            {!selectedSlug ? (
              <Alert severity="info">请从左侧选择要编辑的模板</Alert>
            ) : loadingContent ? (
              <CircularProgress />
            ) : (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    编辑: {selectedSlug}.md
                  </Typography>

                  <Stack direction="row" spacing={1}>
                    {hasChanges && (
                      <Chip label="未保存" color="warning" size="small" />
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={handleReset}
                      disabled={!hasChanges}
                    >
                      重置
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      disabled={!hasChanges || saveMutation.isPending}
                    >
                      {saveMutation.isPending ? '保存中...' : '保存'}
                    </Button>
                  </Stack>
                </Box>

                <TextField
                  fullWidth
                  multiline
                  rows={30}
                  value={editedContent}
                  onChange={handleContentChange}
                  variant="outlined"
                  sx={{
                    '& .MuiInputBase-root': {
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      lineHeight: '1.6'
                    }
                  }}
                />

                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  支持的变量占位符: {'{{targetKeyword}}'}, {'{{platform}}'}, {'{{audience}}'}, {'{{recommendedWordCount}}'}, 等
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      </Box>

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
