/**
 * SEO Guide Form - AI驱动的简化表单
 */

import React, { useState, useMemo } from 'react'
import {
  TextInput,
  SelectInput,
  ReferenceInput,
  AutocompleteInput,
  BooleanInput,
  ArrayInput,
  SimpleFormIterator,
  required,
  useNotify,
  useRecordContext,
  useGetList
} from 'react-admin'
import { useFormContext } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButtonGroup,
  ToggleButton,
  Chip
} from '@mui/material'
import {
  AutoAwesome,
  ExpandMore,
  CheckCircle,
  Edit as EditIcon
} from '@mui/icons-material'
import { seoAIService } from '@/services/seoAIService'

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

interface SEOGuideFormContentProps {
  isEdit?: boolean
}

export const SEOGuideFormContent: React.FC<SEOGuideFormContentProps> = ({ isEdit }) => {
  const notify = useNotify()
  const record = useRecordContext()
  const { getValues, setValue } = useFormContext()

  // 获取模板列表
  const { data: templatesData } = useGetList('templates', {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: 'name', order: 'ASC' }
  })

  // 客户端排序模板
  const sortedTemplates = useMemo(() => {
    if (!templatesData) return []

    const getDisplayText = (record: any) => {
      if (!record?.name) return record?.id || ''
      if (typeof record.name === 'string' && record.name.startsWith('{')) {
        try {
          const parsed = JSON.parse(record.name)
          return parsed.en || parsed.zh || parsed.ja || Object.values(parsed)[0] || record.id
        } catch (e) {
          return record.name
        }
      }
      if (typeof record.name === 'object') {
        return record.name.en || record.name.zh || record.name.ja || Object.values(record.name)[0] || record.id
      }
      return record.name
    }

    return [...templatesData].sort((a, b) => {
      const textA = getDisplayText(a).toLowerCase()
      const textB = getDisplayText(b).toLowerCase()
      return textA.localeCompare(textB)
    })
  }, [templatesData])

  // 状态管理
  const [aiModel, setAiModel] = useState<'claude' | 'gpt'>('claude')
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<any>(null)

  // 编辑模式：将数组格式的关键词转换为文本
  React.useEffect(() => {
    if (isEdit && record?.long_tail_keywords && Array.isArray(record.long_tail_keywords)) {
      const keywordsText = record.long_tail_keywords.join('\n')
      setValue('long_tail_keywords_text', keywordsText)
    }
  }, [isEdit, record, setValue])

  /**
   * AI生成内容
   */
  const handleGenerateContent = async () => {
    // 获取当前表单值
    const values = getValues()

    // 验证必填字段
    if (!values.template_id) {
      notify('请先选择模板', { type: 'warning' })
      return
    }
    if (!values.primary_keyword) {
      notify('请输入主关键词', { type: 'warning' })
      return
    }
    if (!values.long_tail_keywords_text || values.long_tail_keywords_text.trim() === '') {
      notify('请至少输入一个长尾关键词', { type: 'warning' })
      return
    }

    // 将多行文本转换为关键词数组
    const longTailKeywords = values.long_tail_keywords_text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)

    if (longTailKeywords.length === 0) {
      notify('请至少输入一个长尾关键词', { type: 'warning' })
      return
    }

    setIsGenerating(true)

    try {
      // 获取模板信息
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('*')
        .eq('id', values.template_id)
        .single()

      if (templateError || !template) {
        throw new Error('模板信息获取失败')
      }

      // 调用AI生成服务
      const content = await seoAIService.generateSEOContent({
        templateName: template.name,
        templateDescription: template.description || '',
        templateCategory: template.category || '',
        templateTags: template.tags || [],
        primaryKeyword: values.primary_keyword,
        longTailKeywords: longTailKeywords,
        targetLanguage: values.language || 'en',
        aiModel: aiModel
      })

      // 保存生成的内容
      setGeneratedContent(content)
      setHasGenerated(true)

      // 更新表单值
      setValue('meta_title', content.meta_title)
      setValue('meta_description', content.meta_description)
      setValue('meta_keywords', content.meta_keywords)
      setValue('guide_intro', content.guide_intro)
      setValue('guide_content', content.guide_content)
      setValue('faq_items', content.faq_items)
      setValue('secondary_keywords', content.secondary_keywords)
      setValue('long_tail_keywords', longTailKeywords) // 保存为数组格式
      setValue('generated_by', 'ai')
      setValue('ai_model', aiModel === 'claude' ? 'claude-opus-4-1-20250805' : 'gpt-4-gizmo-*')

      notify('✨ AI内容生成成功！请预览并根据需要调整', { type: 'success' })
    } catch (error) {
      console.error('[SEOGuideForm] AI生成失败:', error)
      notify(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`, {
        type: 'error'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* 步骤1: 基本信息 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label="步骤 1" color="primary" size="small" />
          选择模板和语言
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
            <SelectInput
              source="template_id"
              label="选择模板"
              choices={sortedTemplates.map((template) => {
                // 提取显示文本
                let displayText = template.id
                if (template.name) {
                  if (typeof template.name === 'string' && template.name.startsWith('{')) {
                    try {
                      const parsed = JSON.parse(template.name)
                      displayText = parsed.en || parsed.zh || parsed.ja || Object.values(parsed)[0] || template.id
                    } catch (e) {
                      displayText = template.name
                    }
                  } else if (typeof template.name === 'object') {
                    displayText = template.name.en || template.name.zh || template.name.ja || Object.values(template.name)[0] || template.id
                  } else {
                    displayText = template.name
                  }
                }
                return {
                  id: template.id,
                  name: displayText
                }
              })}
              fullWidth
              validate={[required()]}
            />
          </Box>

          <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
            <SelectInput
              source="language"
              choices={LANGUAGES}
              label="目标语言"
              validate={[required()]}
              fullWidth
              defaultValue="en"
            />
          </Box>
        </Box>
      </Box>

      {/* 步骤2: 关键词输入 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label="步骤 2" color="primary" size="small" />
          输入关键词
        </Typography>

        <TextInput
          source="primary_keyword"
          label="主关键词"
          helperText="例如：ASMR Food Videos"
          fullWidth
          validate={[required()]}
        />

        <TextInput
          source="long_tail_keywords_text"
          label="长尾关键词"
          helperText="每行输入一个关键词（建议15-20个），例如：
asmr food videos
food asmr videos no talking
how to make asmr food videos"
          multiline
          rows={10}
          fullWidth
          validate={[required()]}
          placeholder="asmr food videos
food asmr videos no talking
asmr video food
how to make asmr food videos
..."
        />
      </Box>

      {/* 步骤3: AI模型选择和生成 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label="步骤 3" color="primary" size="small" />
          AI自动生成内容
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            选择AI模型：
          </Typography>
          <ToggleButtonGroup
            value={aiModel}
            exclusive
            onChange={(e, value) => value && setAiModel(value)}
            aria-label="AI模型选择"
          >
            <ToggleButton value="claude" aria-label="Claude">
              <Box sx={{ textAlign: 'center', px: 2 }}>
                <Typography variant="body2" fontWeight="bold">
                  Claude Opus 4
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  claude-opus-4-1-20250805
                </Typography>
              </Box>
            </ToggleButton>
            <ToggleButton value="gpt" aria-label="GPT-4">
              <Box sx={{ textAlign: 'center', px: 2 }}>
                <Typography variant="body2" fontWeight="bold">
                  GPT-4 Gizmo
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  gpt-4-gizmo-*
                </Typography>
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Button
          variant="contained"
          size="large"
          startIcon={isGenerating ? <CircularProgress size={20} /> : <AutoAwesome />}
          onClick={handleGenerateContent}
          disabled={isGenerating}
          sx={{ mb: 2 }}
        >
          {isGenerating ? '正在生成中...' : '🚀 AI一键生成完整内容'}
        </Button>

        {hasGenerated && (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
            ✨ 内容已自动生成！AI已根据您的关键词生成完整的用户指南、Meta标签和FAQ。
            请在下方预览和编辑。
          </Alert>
        )}
      </Box>

      {/* 步骤4: 预览和编辑生成的内容 */}
      {hasGenerated && generatedContent && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="步骤 4" color="primary" size="small" />
            预览和编辑（可选）
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            内容已自动填充，您可以直接保存，或展开下方折叠面板进行编辑调整。
          </Alert>

          {/* Meta标签 */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EditIcon fontSize="small" />
                <Typography>Meta标签（SEO元信息）</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TextInput
                source="meta_title"
                label="Meta Title"
                helperText="55-60字符"
                fullWidth
                validate={[required()]}
                defaultValue={generatedContent.meta_title}
              />
              <TextInput
                source="meta_description"
                label="Meta Description"
                helperText="150-155字符"
                multiline
                rows={3}
                fullWidth
                validate={[required()]}
                defaultValue={generatedContent.meta_description}
              />
              <TextInput
                source="meta_keywords"
                label="Meta Keywords"
                fullWidth
                defaultValue={generatedContent.meta_keywords}
              />
            </AccordionDetails>
          </Accordion>

          {/* 用户指南内容 */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EditIcon fontSize="small" />
                <Typography>用户指南内容（Markdown格式）</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TextInput
                source="guide_intro"
                label="简介段落"
                multiline
                rows={3}
                fullWidth
                defaultValue={generatedContent.guide_intro}
              />
              <TextInput
                source="guide_content"
                label="完整内容"
                helperText="Markdown格式，已由AI生成完整结构"
                multiline
                rows={20}
                fullWidth
                validate={[required()]}
                defaultValue={generatedContent.guide_content}
              />
            </AccordionDetails>
          </Accordion>

          {/* FAQ */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EditIcon fontSize="small" />
                <Typography>常见问题（FAQ）- 共{generatedContent.faq_items.length}个</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <ArrayInput source="faq_items" label="" defaultValue={generatedContent.faq_items}>
                <SimpleFormIterator>
                  <TextInput source="question" label="问题" fullWidth />
                  <TextInput source="answer" label="答案" multiline rows={3} fullWidth />
                </SimpleFormIterator>
              </ArrayInput>
            </AccordionDetails>
          </Accordion>

          {/* 次要关键词 */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EditIcon fontSize="small" />
                <Typography>次要关键词（AI推荐）</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <ArrayInput source="secondary_keywords" label="" defaultValue={generatedContent.secondary_keywords}>
                <SimpleFormIterator inline>
                  <TextInput source="" label="" />
                </SimpleFormIterator>
              </ArrayInput>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* 发布选项 */}
      <Box sx={{ mt: 4, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <BooleanInput
          source="is_published"
          label="保存后立即发布（发布后用户可在前端看到此指南）"
          defaultValue={false}
        />
      </Box>

      {/* 隐藏字段（自动填充） */}
      <input type="hidden" name="generated_by" value={hasGenerated ? 'ai' : 'manual'} />
      {hasGenerated && (
        <input
          type="hidden"
          name="ai_model"
          value={aiModel === 'claude' ? 'claude-opus-4-1-20250805' : 'gpt-4-gizmo-*'}
        />
      )}
    </Box>
  )
}

export default SEOGuideFormContent
