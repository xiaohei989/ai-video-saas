/**
 * Template Selector - 模板和语言选择
 */

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  TextField,
  CircularProgress
} from '@mui/material'
import { Settings, Description, Layers, Adjust, Save } from '@mui/icons-material'
import { useGetList } from 'react-admin'
import { supabase } from '@/lib/supabase'

interface TemplateSelectorProps {
  selectedTemplateId: string | null
  selectedLanguage: string
  selectedContentTemplate: string
  selectedAIModel: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli'
  onTemplateChange: (templateId: string) => void
  onLanguageChange: (language: string) => void
  onContentTemplateChange: (contentTemplate: string) => void
  onAIModelChange: (aiModel: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli') => void
}

const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'zh', name: '中文' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'es', name: 'Español' }
]

const AI_MODELS = [
  { id: 'claude', name: 'Claude Opus 4', description: '最强推理能力' },
  { id: 'gpt', name: 'GPT-4.1', description: '快速响应' },
  { id: 'gemini', name: 'Gemini 2.5 Pro', description: '超长上下文' },
  { id: 'claude-code-cli', name: 'Claude Code CLI', description: '本地模型' }
]

const CONTENT_TEMPLATES = [
  { id: 'how-to', name: 'How-To 教程', icon: <Description /> },
  { id: 'alternatives', name: 'Alternatives 对比', icon: <Layers /> },
  { id: 'platform-specific', name: 'Platform-Specific 指南', icon: <Adjust /> }
]

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplateId,
  selectedLanguage,
  selectedContentTemplate,
  selectedAIModel,
  onTemplateChange,
  onLanguageChange,
  onContentTemplateChange,
  onAIModelChange
}) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [templateData, setTemplateData] = useState<any>(null)
  const [schemaJSON, setSchemaJSON] = useState('')
  const [densityJSON, setDensityJSON] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  // 加载模板数据
  useEffect(() => {
    if (dialogOpen && selectedContentTemplate) {
      loadTemplateData()
    }
  }, [dialogOpen, selectedContentTemplate])

  const loadTemplateData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('seo_content_templates')
        .select('*')
        .eq('slug', selectedContentTemplate)
        .eq('is_active', true)
        .single()

      if (error) throw error

      setTemplateData(data)
      setSchemaJSON(JSON.stringify(data.structure_schema, null, 2))
      setDensityJSON(JSON.stringify(data.keyword_density_targets, null, 2))
      setJsonError(null)
    } catch (error: any) {
      alert(`加载模板失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      // 验证 JSON 格式
      const parsedSchema = JSON.parse(schemaJSON)
      const parsedDensity = JSON.parse(densityJSON)

      setSaving(true)

      const { error } = await supabase
        .from('seo_content_templates')
        .update({
          structure_schema: parsedSchema,
          keyword_density_targets: parsedDensity,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateData.id)

      if (error) throw error

      alert('保存成功！')
      setDialogOpen(false)
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        setJsonError(`JSON 格式错误: ${error.message}`)
      } else {
        alert(`保存失败: ${error.message}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleJSONChange = (value: string, type: 'schema' | 'density') => {
    if (type === 'schema') {
      setSchemaJSON(value)
    } else {
      setDensityJSON(value)
    }

    // 实时验证 JSON
    try {
      JSON.parse(value)
      setJsonError(null)
    } catch (e: any) {
      setJsonError(`JSON 格式错误: ${e.message}`)
    }
  }

  // 获取视频模板列表
  const { data: templates, isLoading } = useGetList('templates', {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: 'name', order: 'ASC' },
    filter: { is_active: true }
  })

  // 解析模板名称
  const getTemplateName = (template: any) => {
    if (!template?.name) return template?.id || ''

    if (typeof template.name === 'string' && template.name.startsWith('{')) {
      try {
        const parsed = JSON.parse(template.name)
        return parsed.en || parsed.zh || parsed.ja || Object.values(parsed)[0] || template.id
      } catch (e) {
        return template.name
      }
    }

    if (typeof template.name === 'object') {
      return template.name.en || template.name.zh || template.name.ja || Object.values(template.name)[0] || template.id
    }

    return template.name
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 标题 */}
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Settings />
        配置选择
      </Typography>

      <Divider />

      {/* AI 模型选择 */}
      <FormControl fullWidth size="small">
        <InputLabel>AI 模型</InputLabel>
        <Select
          value={selectedAIModel}
          label="AI 模型"
          onChange={(e) => onAIModelChange(e.target.value as any)}
        >
          {AI_MODELS.map((model) => (
            <MenuItem key={model.id} value={model.id}>
              <Box>
                <Typography variant="body2">{model.name}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {model.description}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 视频模板选择 */}
      <FormControl fullWidth size="small">
        <InputLabel>视频模板</InputLabel>
        <Select
          value={selectedTemplateId || ''}
          label="视频模板"
          onChange={(e) => onTemplateChange(e.target.value)}
          disabled={isLoading}
        >
          <MenuItem value="">
            <em>请选择模板</em>
          </MenuItem>
          {templates?.map((template) => (
            <MenuItem key={template.id} value={template.id}>
              {getTemplateName(template)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 语言选择 */}
      <FormControl fullWidth size="small">
        <InputLabel>目标语言</InputLabel>
        <Select
          value={selectedLanguage}
          label="目标语言"
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          {LANGUAGES.map((lang) => (
            <MenuItem key={lang.id} value={lang.id}>
              {lang.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider />

      {/* SEO 内容模板选择 */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          SEO 内容模板
        </Typography>
        <Tabs
          orientation="vertical"
          value={selectedContentTemplate}
          onChange={(_, value) => onContentTemplateChange(value)}
          sx={{ minHeight: 120 }}
        >
          {CONTENT_TEMPLATES.map((template) => (
            <Tab
              key={template.id}
              value={template.id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                  {template.icon}
                  <Typography variant="body2">{template.name}</Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', minHeight: 40 }}
            />
          ))}
        </Tabs>
      </Box>

      <Divider />

      {/* 编辑模板按钮 */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<Settings />}
        fullWidth
        disabled={!selectedContentTemplate}
        onClick={() => setDialogOpen(true)}
      >
        编辑模板结构
      </Button>

      {/* 帮助文本 */}
      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Typography variant="caption" color="textSecondary">
          💡 选择视频模板和 SEO 内容模板后，可在中栏管理关键词
        </Typography>
      </Box>

      {/* 模板结构编辑对话框 */}
      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>编辑 SEO 内容模板结构</DialogTitle>
        <DialogContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                当前模板: <strong>{CONTENT_TEMPLATES.find(t => t.id === selectedContentTemplate)?.name}</strong>
              </Alert>

              {templateData && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* 基本信息 */}
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      模板信息
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      名称: {templateData.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Slug: {templateData.slug}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      建议字数: {templateData.min_word_count} - {templateData.max_word_count} (推荐: {templateData.recommended_word_count})
                    </Typography>
                  </Box>

                  {/* 结构 Schema 编辑器 */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      内容结构 (Structure Schema)
                    </Typography>
                    <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                      定义章节结构、字数要求、关键词分布等
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={20}
                      value={schemaJSON}
                      onChange={(e) => handleJSONChange(e.target.value, 'schema')}
                      sx={{
                        mt: 1,
                        fontFamily: 'monospace',
                        '& textarea': {
                          fontFamily: 'monospace',
                          fontSize: '13px'
                        }
                      }}
                      placeholder='{ "required_sections": [...], "faq_config": {...} }'
                    />
                  </Box>

                  <Divider />

                  {/* 关键词密度目标编辑器 */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      关键词密度目标 (Keyword Density Targets)
                    </Typography>
                    <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                      设置目标关键词和相关关键词的密度范围
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={8}
                      value={densityJSON}
                      onChange={(e) => handleJSONChange(e.target.value, 'density')}
                      sx={{
                        mt: 1,
                        fontFamily: 'monospace',
                        '& textarea': {
                          fontFamily: 'monospace',
                          fontSize: '13px'
                        }
                      }}
                      placeholder='{ "target_keyword": { "ideal": 2.5, "min": 2.0, "max": 3.0 } }'
                    />
                  </Box>

                  {/* 错误提示 */}
                  {jsonError && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {jsonError}
                    </Alert>
                  )}

                  {/* 使用说明 */}
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight="600" gutterBottom>
                      注意事项
                    </Typography>
                    <Typography variant="caption" component="div">
                      • 请确保 JSON 格式正确，否则无法保存
                    </Typography>
                    <Typography variant="caption" component="div">
                      • 修改模板结构后，新生成的内容将使用新结构
                    </Typography>
                    <Typography variant="caption" component="div">
                      • 已生成的内容不会自动更新
                    </Typography>
                  </Alert>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            取消
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <Save />}
            onClick={handleSave}
            disabled={saving || !!jsonError || loading || !templateData}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default TemplateSelector
