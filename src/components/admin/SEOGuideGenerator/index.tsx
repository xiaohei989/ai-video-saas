/**
 * SEO Guide Generator - Admin组件入口
 * 用于管理模板的SEO优化用户指南
 */

import React from 'react'
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  BooleanField,
  DateField,
  EditButton,
  DeleteButton,
  Create,
  Edit,
  SimpleForm,
  SelectInput,
  ReferenceInput,
  AutocompleteInput,
  useRecordContext,
  useNotify,
  useRefresh,
  Toolbar,
  SaveButton,
  Button,
  TopToolbar,
  CreateButton,
  ExportButton,
  FilterButton
} from 'react-admin'
import { Card, CardContent, Chip, Box, Typography, Badge, ToggleButtonGroup, ToggleButton, Alert, Button as MuiButton, CircularProgress } from '@mui/material'
import {
  Search,
  TrendingUp,
  CheckCircle,
  Cancel,
  Psychology,
  PlayArrow,
  Error as ErrorIcon
} from '@mui/icons-material'
import { SEOGuideFormContent } from './SEOGuideForm'
import { SEOScoreDisplay } from './SEOScoreDisplay'
import { AIModelProvider, useAIModel, getAIModelLabel, isLocalModel, type AIModelType } from './AIModelContext'

// 支持的语言列表
const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'zh', name: '中文' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'es', name: 'Español' },
  { id: 'de', name: 'Deutsch' },
  { id: 'fr', name: 'Français' },
  { id: 'ar', name: 'العربية' }
]

/**
 * SEO评分显示组件
 */
const SEOScoreField: React.FC<{ source: string }> = ({ source }) => {
  const record = useRecordContext()
  if (!record) return null

  const score = record[source] || 0
  let color: 'error' | 'warning' | 'success' = 'error'
  let label = '差'

  if (score >= 80) {
    color = 'success'
    label = '优秀'
  } else if (score >= 60) {
    color = 'warning'
    label = '良好'
  }

  return (
    <Chip
      label={`${score}分 (${label})`}
      color={color}
      size="small"
      icon={<TrendingUp />}
    />
  )
}

/**
 * 关键词标签显示
 */
const KeywordsField: React.FC<{ source: string }> = ({ source }) => {
  const record = useRecordContext()
  if (!record || !record[source]) return null

  const keywords = record[source] as string[]
  const displayKeywords = keywords.slice(0, 3)
  const remaining = keywords.length - 3

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {displayKeywords.map((keyword: string, index: number) => (
        <Chip key={index} label={keyword} size="small" variant="outlined" />
      ))}
      {remaining > 0 && (
        <Chip label={`+${remaining}`} size="small" color="primary" variant="outlined" />
      )}
    </Box>
  )
}

/**
 * 模板名称显示（解析JSON对象）
 */
const TemplateNameField: React.FC = () => {
  const record = useRecordContext()
  if (!record || !record.template) return null

  const templateName = record.template.name

  // 如果 name 是 JSON 字符串，先解析它
  if (typeof templateName === 'string' && templateName.startsWith('{')) {
    try {
      const parsed = JSON.parse(templateName)
      const displayName = parsed.en || parsed.zh || parsed.ja || Object.values(parsed)[0]
      return <span>{displayName}</span>
    } catch (e) {
      return <span>{templateName}</span>
    }
  }

  // 如果 name 是对象，直接提取语言
  if (typeof templateName === 'object') {
    const displayName = templateName.en || templateName.zh || templateName.ja || Object.values(templateName)[0]
    return <span>{displayName}</span>
  }

  // 如果是普通字符串，直接返回
  return <span>{templateName}</span>
}

/**
 * 发布状态显示
 */
const PublishStatusField: React.FC = () => {
  const record = useRecordContext()
  if (!record) return null

  return record.is_published ? (
    <Chip label="已发布" color="success" size="small" icon={<CheckCircle />} />
  ) : (
    <Chip label="草稿" color="default" size="small" icon={<Cancel />} />
  )
}

/**
 * AI 模型选择器组件（带本地服务器测试功能）
 */
const AIModelSelector: React.FC = () => {
  const { aiModel, setAiModel } = useAIModel()
  const notify = useNotify()
  const [isTesting, setIsTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{
    status: 'idle' | 'success' | 'error'
    message: string
  } | null>(null)

  const handleChange = (_event: React.MouseEvent<HTMLElement>, newModel: AIModelType | null) => {
    if (newModel) {
      setAiModel(newModel)
      // 切换模型时重置测试结果
      setTestResult(null)
    }
  }

  /**
   * 测试本地服务器状态
   */
  const handleTestServer = async () => {
    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('http://localhost:3030/test-claude', {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setTestResult({
          status: 'success',
          message: result.message || '✅ 本地服务器运行正常，Claude CLI 可用'
        })
        notify('✅ 本地服务器连接成功！', { type: 'success' })
      } else {
        setTestResult({
          status: 'error',
          message: result.error || '❌ 服务器响应异常'
        })
        notify('⚠️ 服务器响应异常', { type: 'warning' })
      }
    } catch (error) {
      console.error('[Test Server] 测试失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isConnectionError = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')

      setTestResult({
        status: 'error',
        message: isConnectionError
          ? '❌ 无法连接到本地服务器 (localhost:3030)'
          : `❌ 测试失败: ${errorMessage}`
      })
      notify('❌ 本地服务器连接失败', { type: 'error' })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Psychology color="primary" />
        <Typography variant="subtitle1" fontWeight="medium">
          AI 模型选择
        </Typography>
      </Box>

      <Typography variant="body2" color="textSecondary" gutterBottom sx={{ mb: 2 }}>
        选择用于生成、评分和优化的 AI 模型:
      </Typography>

      <ToggleButtonGroup
        value={aiModel}
        exclusive
        onChange={handleChange}
        aria-label="AI模型选择"
        sx={{ flexWrap: 'wrap' }}
      >
        <ToggleButton value="claude" aria-label="Claude Opus 4">
          <Box sx={{ textAlign: 'center', px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight="bold">
              Claude Opus 4
            </Typography>
            <Typography variant="caption" color="textSecondary">
              claude-opus-4-1-20250805
            </Typography>
          </Box>
        </ToggleButton>

        <ToggleButton value="gpt" aria-label="GPT-4 Gizmo">
          <Box sx={{ textAlign: 'center', px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight="bold">
              GPT-4 Gizmo
            </Typography>
            <Typography variant="caption" color="textSecondary">
              gpt-4-gizmo-*
            </Typography>
          </Box>
        </ToggleButton>

        <ToggleButton value="gemini" aria-label="Gemini 2.5 Pro">
          <Box sx={{ textAlign: 'center', px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight="bold">
              Gemini 2.5 Pro
            </Typography>
            <Typography variant="caption" color="textSecondary">
              gemini-2.5-pro
            </Typography>
          </Box>
        </ToggleButton>

        <ToggleButton value="local-claude" aria-label="本地 Claude CLI">
          <Box sx={{ textAlign: 'center', px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight="bold">
              本地 Claude CLI
            </Typography>
            <Typography variant="caption" color="textSecondary">
              claude-sonnet-4-5 (Local)
            </Typography>
          </Box>
        </ToggleButton>
      </ToggleButtonGroup>

      {isLocalModel(aiModel) && (
        <>
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              💡 本地模式需要启动服务器: <code>npm run seo:server</code>
            </Typography>
          </Alert>

          {/* 测试按钮 */}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <MuiButton
              variant="outlined"
              size="small"
              startIcon={isTesting ? <CircularProgress size={16} /> : <PlayArrow />}
              onClick={handleTestServer}
              disabled={isTesting}
            >
              {isTesting ? '测试中...' : '测试服务器状态'}
            </MuiButton>

            {testResult && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {testResult.status === 'success' ? (
                  <CheckCircle color="success" fontSize="small" />
                ) : (
                  <ErrorIcon color="error" fontSize="small" />
                )}
                <Typography
                  variant="body2"
                  color={testResult.status === 'success' ? 'success.main' : 'error.main'}
                >
                  {testResult.message}
                </Typography>
              </Box>
            )}
          </Box>
        </>
      )}

      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
        当前选择: <strong>{getAIModelLabel(aiModel)}</strong>
      </Typography>
    </Box>
  )
}

/**
 * 列表视图的过滤器
 */
const guideFilters = [
  <ReferenceInput
    key="template"
    source="template_id"
    reference="templates"
    sort={{ field: 'name', order: 'ASC' }}
    alwaysOn
  >
    <AutocompleteInput
      optionText={(record) => {
        if (!record?.name) return record?.id || '';

        // 如果 name 是 JSON 字符串，先解析它
        if (typeof record.name === 'string' && record.name.startsWith('{')) {
          try {
            const parsed = JSON.parse(record.name);
            return parsed.en || parsed.zh || parsed.ja || Object.values(parsed)[0] || record.id;
          } catch (e) {
            return record.name;
          }
        }

        // 如果 name 是对象，直接提取语言
        if (typeof record.name === 'object') {
          return record.name.en || record.name.zh || record.name.ja || Object.values(record.name)[0] || record.id;
        }

        // 如果是普通字符串，直接返回
        return record.name;
      }}
      label="模板"
    />
  </ReferenceInput>,
  <SelectInput
    key="language"
    source="language"
    choices={LANGUAGES}
    label="语言"
    alwaysOn
  />,
  <SelectInput
    key="published"
    source="is_published"
    choices={[
      { id: 'true', name: '已发布' },
      { id: 'false', name: '草稿' }
    ]}
    label="发布状态"
  />
]

/**
 * 列表工具栏
 */
const ListActions = () => (
  <TopToolbar>
    <FilterButton />
    <CreateButton label="创建SEO指南" />
    <ExportButton />
  </TopToolbar>
)

/**
 * SEO指南列表
 */
export const SEOGuideList: React.FC = () => {
  return (
    <List
      filters={guideFilters}
      actions={<ListActions />}
      sort={{ field: 'updated_at', order: 'DESC' }}
      perPage={25}
    >
      <Datagrid rowClick="edit" bulkActionButtons={false}>
        <TemplateNameField label="模板名称" />
        <TextField source="language" label="语言" />
        <TextField source="target_keyword" label="目标关键词" />
        <KeywordsField source="long_tail_keywords" label="长尾关键词" />
        <SEOScoreField source="seo_score" label="SEO评分" />
        <NumberField source="page_views" label="访问量" />
        <PublishStatusField label="状态" />
        <DateField source="updated_at" label="更新时间" showTime />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  )
}

/**
 * 编辑/创建表单工具栏
 */
const SEOGuideToolbar: React.FC<{ isEdit?: boolean }> = ({ isEdit }) => {
  const record = useRecordContext()
  const notify = useNotify()
  const refresh = useRefresh()

  const handlePublish = async () => {
    try {
      // 这里调用发布API
      notify('指南已发布', { type: 'success' })
      refresh()
    } catch (error) {
      notify('发布失败', { type: 'error' })
    }
  }

  return (
    <Toolbar>
      <SaveButton label="保存" />
      {isEdit && !record?.is_published && (
        <Button label="保存并发布" onClick={handlePublish} />
      )}
    </Toolbar>
  )
}

/**
 * SEO指南编辑器（AI驱动）
 */
export const SEOGuideEdit: React.FC = () => {
  return (
    <AIModelProvider defaultModel="claude">
      <Edit>
        <SimpleForm toolbar={<SEOGuideToolbar isEdit />}>
          {/* AI 模型选择器 */}
          <AIModelSelector />

          {/* SEO评分展示 */}
          <SEOScoreDisplay />

          {/* 编辑表单 */}
          <SEOGuideFormContent isEdit />
        </SimpleForm>
      </Edit>
    </AIModelProvider>
  )
}

/**
 * SEO指南创建器（AI驱动）
 */
export const SEOGuideCreate: React.FC = () => {
  return (
    <AIModelProvider defaultModel="claude">
      <Create>
        <SimpleForm toolbar={<SEOGuideToolbar />}>
          {/* AI 模型选择器 */}
          <AIModelSelector />

          {/* 编辑表单 */}
          <SEOGuideFormContent />
        </SimpleForm>
      </Create>
    </AIModelProvider>
  )
}

export default { SEOGuideList, SEOGuideEdit, SEOGuideCreate }
