/**
 * SEO Guide Form - AI驱动的简化表单
 * 统一使用 Context 中的 AI 模型选择
 */

import React, { useState, useMemo } from 'react'
import {
  TextInput,
  SelectInput,
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
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  LinearProgress
} from '@mui/material'
import {
  AutoAwesome,
  Layers,
  Description
} from '@mui/icons-material'
import { seoAIService } from '@/services/seoAIService'
import { useAIModel, getAIModelName, isLocalModel } from './AIModelContext'

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

  // 使用全局 AI 模型选择
  const { aiModel } = useAIModel()

  // 获取模板列表
  const { data: templatesData, isLoading: templatesLoading } = useGetList('templates', {
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

    // 如果是编辑模式且当前记录有template信息，确保它在列表中
    let templates = [...templatesData]
    if (isEdit && record?.template) {
      const existingTemplate = templates.find(t => t.id === record.template_id)
      if (!existingTemplate) {
        // 如果当前模板不在列表中，添加它
        templates.unshift(record.template)
      }
    }

    return templates.sort((a, b) => {
      const textA = getDisplayText(a).toLowerCase()
      const textB = getDisplayText(b).toLowerCase()
      return textA.localeCompare(textB)
    })
  }, [templatesData, isEdit, record])

  // 状态管理
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationMode, setGenerationMode] = useState<'single' | 'batch'>('single')
  const [batchProgress, setBatchProgress] = useState({
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    current: ''
  })

  // 编辑模式：将数组格式的关键词转换为文本
  React.useEffect(() => {
    if (isEdit && record?.long_tail_keywords && Array.isArray(record.long_tail_keywords)) {
      const keywordsText = record.long_tail_keywords.join('\n')
      setValue('long_tail_keywords_text', keywordsText)
    }
  }, [isEdit, record, setValue])

  /**
   * 统一的 AI 生成内容函数
   * 根据 Context 中的 aiModel 自动选择在线或本地服务
   */
  const handleGenerateContent = async () => {
    // 获取当前表单值
    const values = getValues()

    // 验证必填字段
    if (!values.template_id) {
      notify('请先选择模板', { type: 'warning' })
      return
    }
    if (!values.target_keyword) {
      notify('请输入目标关键词', { type: 'warning' })
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
      // 判断是本地模型还是在线模型
      if (isLocalModel(aiModel)) {
        // 本地 Claude CLI 模式：调用本地服务器
        const response = await fetch('http://localhost:3030/generate-seo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            templateId: values.template_id,
            targetKeyword: values.target_keyword,
            longTailKeywords: longTailKeywords,
            language: values.language || 'en'
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '本地服务器调用失败')
        }

        const result = await response.json()

        if (!result.success || !result.data) {
          throw new Error('生成失败，未返回有效数据')
        }

        // 显示成功消息并刷新页面
        notify('✨ 本地生成成功！内容已保存到数据库，页面即将刷新...', { type: 'success' })

        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        // 在线模式：调用 APICore 服务并直接保存到数据库
        // 1. 获取模板信息
        const { data: template, error: templateError } = await supabase
          .from('templates')
          .select('*')
          .eq('id', values.template_id)
          .single()

        if (templateError || !template) {
          throw new Error('模板信息获取失败')
        }

        // 2. 调用在线 AI 生成服务
        const content = await seoAIService.generateSEOContent({
          templateName: template.name,
          templateDescription: template.description || '',
          templateCategory: template.category || '',
          templateTags: template.tags || [],
          targetKeyword: values.target_keyword,
          longTailKeywords: longTailKeywords,
          targetLanguage: values.language || 'en',
          aiModel: aiModel
        })

        // 3. 检查是否已存在记录（upsert 逻辑）
        const { data: existingGuide } = await supabase
          .from('template_seo_guides')
          .select('id')
          .eq('template_id', values.template_id)
          .eq('language', values.language || 'en')
          .maybeSingle()

        let saveResult

        if (existingGuide) {
          // 已存在，更新记录并自动发布
          console.log('[在线生成] 找到已存在记录，将更新内容并发布...')
          saveResult = await supabase
            .from('template_seo_guides')
            .update({
              target_keyword: values.target_keyword,
              long_tail_keywords: longTailKeywords,
              meta_title: content.meta_title,
              meta_description: content.meta_description,
              meta_keywords: content.meta_keywords,
              guide_intro: content.guide_intro,
              guide_content: content.guide_content,
              faq_items: content.faq_items,
              secondary_keywords: content.secondary_keywords,
              generated_by: 'ai',
              ai_model: getAIModelName(aiModel),
              is_published: true,
              published_at: new Date().toISOString(),
              review_status: 'approved',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingGuide.id)
            .select()
            .single()
        } else {
          // 不存在，插入新记录并自动发布
          console.log('[在线生成] 未找到旧记录，创建新记录并发布...')
          saveResult = await supabase
            .from('template_seo_guides')
            .insert({
              template_id: values.template_id,
              language: values.language || 'en',
              target_keyword: values.target_keyword,
              long_tail_keywords: longTailKeywords,
              meta_title: content.meta_title,
              meta_description: content.meta_description,
              meta_keywords: content.meta_keywords,
              guide_intro: content.guide_intro,
              guide_content: content.guide_content,
              faq_items: content.faq_items,
              secondary_keywords: content.secondary_keywords,
              generated_by: 'ai',
              ai_model: getAIModelName(aiModel),
              is_published: true,
              published_at: new Date().toISOString(),
              review_status: 'approved'
            })
            .select()
            .single()
        }

        if (saveResult.error) {
          throw new Error(`保存失败: ${saveResult.error.message}`)
        }

        // 显示成功消息并刷新页面
        notify('✨ 在线生成成功！内容已保存到数据库，页面即将刷新...', { type: 'success' })

        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (error) {
      console.error('[SEOGuideForm] AI生成失败:', error)

      // 检查是否是本地服务器连接错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        notify('❌ 无法连接到本地服务器，请确保已启动服务器（npm run seo:server）', {
          type: 'error'
        })
      } else {
        notify(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`, {
          type: 'error'
        })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  /**
   * 批量生成 AI 内容
   */
  const handleBatchGenerate = async () => {
    const values = getValues()

    // 验证必填字段
    if (!values.template_id || !values.language) {
      notify('请先选择模板和语言', { type: 'warning' })
      return
    }

    const keywordsText = values.long_tail_keywords_text || ''
    const keywords = keywordsText
      .split('\n')
      .map((k: string) => k.trim())
      .filter((k: string) => k)

    if (keywords.length === 0) {
      notify('请至少输入一个关键词', { type: 'warning' })
      return
    }

    if (keywords.length > 100) {
      notify('批量生成最多支持100个关键词', { type: 'warning' })
      return
    }

    setIsGenerating(true)
    setBatchProgress({
      total: keywords.length,
      processed: 0,
      successful: 0,
      failed: 0,
      current: ''
    })

    try {
      notify(`🚀 开始批量生成 ${keywords.length} 个SEO页面...`, { type: 'info' })

      // 批量处理关键词
      const concurrency = 3 // 并发数
      const results = []

      for (let i = 0; i < keywords.length; i += concurrency) {
        const batch = keywords.slice(i, i + concurrency)

        const batchPromises = batch.map(async (keyword, index) => {
          setBatchProgress(prev => ({
            ...prev,
            current: keyword
          }))

          try {
            // 调用 AI 生成
            const content = await seoAIService.generateSEOContent({
              templateId: values.template_id,
              language: values.language,
              primaryKeyword: keyword,
              aiModel: aiModel
            })

            // 保存到数据库
            const { error } = await supabase
              .from('template_seo_guides')
              .upsert({
                template_id: values.template_id,
                language: values.language,
                target_keyword: keyword,
                long_tail_keywords: [keyword],
                meta_title: content.meta_title,
                meta_description: content.meta_description,
                meta_keywords: content.meta_keywords,
                guide_intro: content.guide_intro,
                guide_content: content.guide_content,
                faq_items: content.faq_items,
                secondary_keywords: content.secondary_keywords,
                generated_by: 'ai',
                ai_model: getAIModelName(aiModel),
                is_published: true,
                published_at: new Date().toISOString(),
                review_status: 'approved'
              }, {
                onConflict: 'template_id,language,target_keyword'
              })

            if (error) throw error

            setBatchProgress(prev => ({
              ...prev,
              processed: prev.processed + 1,
              successful: prev.successful + 1
            }))

            return { success: true, keyword }
          } catch (error) {
            console.error(`[批量生成] "${keyword}" 失败:`, error)
            setBatchProgress(prev => ({
              ...prev,
              processed: prev.processed + 1,
              failed: prev.failed + 1
            }))

            return { success: false, keyword, error }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)

        // 批次间延迟
        if (i + concurrency < keywords.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // 完成
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      notify(
        `✅ 批量生成完成！成功: ${successful}，失败: ${failed}`,
        { type: successful > failed ? 'success' : 'warning' }
      )

      setTimeout(() => {
        window.location.reload()
      }, 2000)

    } catch (error) {
      console.error('[批量生成] 失败:', error)
      notify(`批量生成失败: ${error instanceof Error ? error.message : '未知错误'}`, {
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
            {templatesLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">加载模板列表...</Typography>
              </Box>
            ) : (
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
            )}
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

      {/* 步骤2: 生成模式选择 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label="步骤 2" color="primary" size="small" />
          选择生成模式
        </Typography>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <ToggleButtonGroup
            value={generationMode}
            exclusive
            onChange={(_, newMode) => {
              if (newMode) setGenerationMode(newMode)
            }}
            aria-label="生成模式"
            fullWidth
          >
            <ToggleButton value="single" aria-label="单个生成">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1 }}>
                <Description sx={{ fontSize: 24 }} />
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  单个生成
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  生成一个SEO页面
                </Typography>
              </Box>
            </ToggleButton>
            <ToggleButton value="batch" aria-label="批量生成">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1 }}>
                <Layers sx={{ fontSize: 24 }} />
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  批量生成
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  批量生成多个SEO页面
                </Typography>
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>

          {generationMode === 'batch' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                💡 批量模式将为每个关键词生成一个独立的SEO页面。建议每批不超过100个关键词。
              </Typography>
            </Alert>
          )}
        </Paper>
      </Box>

      {/* 步骤3: 关键词输入 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label="步骤 3" color="primary" size="small" />
          输入关键词
        </Typography>

        {generationMode === 'single' ? (
          <>
            <TextInput
              source="target_keyword"
              label="目标关键词"
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
          </>
        ) : (
          <TextInput
            source="long_tail_keywords_text"
            label="关键词列表（批量模式）"
            helperText="每行输入一个关键词，系统将为每个关键词生成一个独立的SEO页面（最多100个）"
            multiline
            rows={15}
            fullWidth
            validate={[required()]}
            placeholder="how to make youtube shorts
youtube shorts vs tiktok
best youtube shorts ideas
youtube shorts monetization
how to edit youtube shorts
..."
          />
        )}
      </Box>

      {/* 步骤4: AI 生成 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label="步骤 4" color="primary" size="small" />
          AI 自动生成内容
        </Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          💡 使用页面顶部选择的 AI 模型进行生成。{isLocalModel(aiModel) && ' 本地模式需要先启动服务器: npm run seo:server'}
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={isGenerating ? <CircularProgress size={20} /> : <AutoAwesome />}
            onClick={generationMode === 'single' ? handleGenerateContent : handleBatchGenerate}
            disabled={isGenerating}
          >
            {isGenerating
              ? (generationMode === 'batch' ? '批量生成中...' : '正在生成中...')
              : (generationMode === 'batch' ? '🚀 批量生成并保存' : '🚀 AI 一键生成并保存')
            }
          </Button>
        </Box>

        {/* 批量生成进度显示 */}
        {isGenerating && generationMode === 'batch' && batchProgress.total > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              批量生成进度
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="textSecondary">
                  {batchProgress.processed} / {batchProgress.total}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {Math.round((batchProgress.processed / batchProgress.total) * 100)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(batchProgress.processed / batchProgress.total) * 100}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
              <Chip
                label={`✓ 成功: ${batchProgress.successful}`}
                size="small"
                color="success"
              />
              <Chip
                label={`✗ 失败: ${batchProgress.failed}`}
                size="small"
                color={batchProgress.failed > 0 ? 'error' : 'default'}
              />
            </Box>
            {batchProgress.current && (
              <Typography variant="caption" color="textSecondary">
                当前处理: {batchProgress.current}
              </Typography>
            )}
          </Paper>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          ℹ️ 点击"AI 一键生成并保存"后，内容将自动保存到数据库。
          <br />
          如需编辑，请在列表中找到对应记录点击"编辑"按钮。
        </Alert>
      </Box>
    </Box>
  )
}

export default SEOGuideFormContent
