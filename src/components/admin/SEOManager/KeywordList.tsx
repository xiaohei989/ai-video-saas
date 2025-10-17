/**
 * Keyword List - 关键词管理列表
 */

import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  TextField,
  Checkbox,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Alert,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material'
import {
  FileDownload,
  Bolt,
  Assessment,
  Delete,
  MoreVert,
  Search,
  Visibility,
  Refresh,
  CheckCircle,
  RadioButtonUnchecked,
  Edit,
  DeleteOutline
} from '@mui/icons-material'
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { contentGenerationService } from '@/services/contentGenerationService'
import { seoAIService } from '@/services/seoAIService'
import { extractFullContent, calculateKeywordDensity, calculateKeywordDensityScore } from '@/services/seoScoreCalculator'

interface KeywordListProps {
  templateId: string | null
  language: string
  contentTemplate: string
  aiModel: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli'
  selectedKeyword: string | null
  onKeywordSelect: (keyword: string | null) => void
}

interface KeywordRow {
  id: string
  keyword: string
  status: 'generated' | 'draft' | 'not_generated' | 'published' | 'pending_score'
  seo_score: number | null
  is_published: boolean
  updated_at: string
  // 用于计算关键词密度的字段
  guide_content?: string
  meta_title?: string
  meta_description?: string
  meta_keywords?: string
  faq_items?: Array<{ question: string; answer: string }>
  secondary_keywords?: string[]
}

const KeywordList: React.FC<KeywordListProps> = ({
  templateId,
  language,
  contentTemplate,
  aiModel,
  selectedKeyword,
  onKeywordSelect
}) => {
  const queryClient = useQueryClient()
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>([])
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingKeyword, setEditingKeyword] = useState<KeywordRow | null>(null)
  const [editKeywordText, setEditKeywordText] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingKeywords, setDeletingKeywords] = useState<string[]>([])
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateCompleted, setGenerateCompleted] = useState(false)
  const [generateProgress, setGenerateProgress] = useState({
    total: 0,
    current: 0,
    currentKeyword: '',
    logs: [] as string[]
  })
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [scoreProgress, setScoreProgress] = useState({
    total: 0,
    current: 0,
    currentKeyword: '',
    logs: [] as string[]
  })

  // Toast 状态
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('info')

  // 显示 toast 提示
  const showToast = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToastMessage(message)
    setToastSeverity(severity)
    setToastOpen(true)
  }

  // 获取关键词列表数据
  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ['seo-keywords', templateId, language, contentTemplate],
    queryFn: async () => {
      if (!templateId) return []

      // 从 seo_page_variants 表获取数据,包含计算关键词密度所需的字段
      const { data, error } = await supabase
        .from('seo_page_variants')
        .select('id, target_keyword, guide_content, meta_title, meta_description, meta_keywords, faq_items, secondary_keywords, seo_score, is_published, updated_at')
        .eq('template_id', templateId)
        .eq('language', language)
        .order('updated_at', { ascending: false })

      if (error) throw error

      return (data || []).map((row): KeywordRow => {
        let status: KeywordRow['status'] = 'draft'
        if (row.is_published) {
          status = 'published'
        } else if (row.guide_content && row.seo_score) {
          status = 'generated' // 有内容且已评分
        } else if (row.guide_content && !row.seo_score) {
          status = 'pending_score' // 有内容但未评分
        } else {
          status = 'not_generated' // 无内容
        }

        return {
          id: row.id,
          keyword: row.target_keyword,
          status,
          seo_score: row.seo_score,
          is_published: row.is_published,
          updated_at: row.updated_at,
          guide_content: row.guide_content,
          meta_title: row.meta_title,
          meta_description: row.meta_description,
          meta_keywords: row.meta_keywords,
          faq_items: row.faq_items,
          secondary_keywords: row.secondary_keywords
        }
      })
    },
    enabled: !!templateId
  })

  // 直接使用关键词列表
  const filteredKeywords = keywords

  // 计算目标关键词的实时密度（单关键词优化）
  const calculateKeywordDensityForRow = (kw: KeywordRow): number | null => {
    if (!kw.guide_content || !kw.keyword) return null

    const fullContent = extractFullContent({
      meta_title: kw.meta_title,
      meta_description: kw.meta_description,
      meta_keywords: kw.meta_keywords,
      guide_content: kw.guide_content,
      faq_items: kw.faq_items
    })

    // 只计算目标关键词的密度
    const density = calculateKeywordDensity(fullContent, [kw.keyword])

    return density[kw.keyword] || null
  }

  // 定义列
  const columns: GridColDef[] = [
    {
      field: 'keyword',
      headerName: '关键词',
      flex: 1,
      minWidth: 200
    },
    {
      field: 'status',
      headerName: '状态',
      width: 100,
      renderCell: (params) => {
        const statusConfig = {
          published: { label: '已发布', color: 'success' as const },
          generated: { label: '已评分', color: 'success' as const },
          pending_score: { label: '待评分', color: 'warning' as const },
          draft: { label: '草稿', color: 'default' as const },
          not_generated: { label: '未生成', color: 'default' as const }
        }
        const config = statusConfig[params.value as keyof typeof statusConfig]
        return <Chip label={config.label} color={config.color} size="small" />
      }
    },
    {
      field: 'seo_score',
      headerName: 'SEO分数',
      width: 120,
      renderCell: (params) => {
        if (!params.value) return <Typography variant="body2" color="textSecondary">--</Typography>

        const score = params.value as number
        const color = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error'

        return (
          <Chip
            label={`${score}分`}
            color={color}
            size="small"
            icon={<Assessment />}
          />
        )
      }
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 160,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="查看">
            <IconButton
              size="small"
              onClick={() => onKeywordSelect(params.row.keyword)}
            >
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="编辑">
            <IconButton
              size="small"
              onClick={() => handleEditClick(params.row)}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="删除">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteClick([params.row.id])}
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="重新生成">
            <IconButton size="small">
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ]

  // 批量操作菜单
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  // 全选/反选
  const handleSelectAll = () => {
    if (selectionModel.length === filteredKeywords.length) {
      setSelectionModel([])
    } else {
      setSelectionModel(filteredKeywords.map(k => k.id))
    }
  }

  // 处理单个关键字的选择/取消选择
  const handleToggleSelect = (keywordId: string) => {
    setSelectionModel(prev => {
      if (prev.includes(keywordId)) {
        // 如果已选中，则取消选择
        return prev.filter(id => id !== keywordId)
      } else {
        // 如果未选中，则添加到选择列表
        return [...prev, keywordId]
      }
    })
  }

  // 处理导入关键词
  const handleImport = () => {
    setImportDialogOpen(true)
  }

  // 处理批量生成
  const handleBatchGenerate = () => {
    if (selectionModel.length === 0) {
      showToast('请先选择要生成的关键词', 'warning')
      return
    }
    setGenerateCompleted(false)
    setGenerateDialogOpen(true)
  }

  // 处理批量评分
  const handleBatchScore = () => {
    if (selectionModel.length === 0) {
      showToast('请先选择要评分的关键词', 'warning')
      return
    }
    setScoreDialogOpen(true)
  }

  // 确认批量评分
  const handleConfirmScore = async () => {
    setScoring(true)
    const selectedKeywords = keywords.filter(k => selectionModel.includes(k.id))

    setScoreProgress({
      total: selectedKeywords.length,
      current: 0,
      currentKeyword: '',
      logs: [`开始批量评分 ${selectedKeywords.length} 个关键词...`]
    })

    let successCount = 0
    let failedCount = 0

    for (let i = 0; i < selectedKeywords.length; i++) {
      const kw = selectedKeywords[i]

      setScoreProgress(prev => ({
        ...prev,
        current: i + 1,
        currentKeyword: kw.keyword,
        logs: [...prev.logs, `\n[${i + 1}/${selectedKeywords.length}] 正在评分: ${kw.keyword}`]
      }))

      try {
        // 获取页面数据
        const { data: pageData, error: fetchError } = await supabase
          .from('seo_page_variants')
          .select('*')
          .eq('id', kw.id)
          .single()

        if (fetchError || !pageData) {
          throw new Error('无法获取页面数据')
        }

        // 提取完整内容用于计算关键词密度
        const fullContent = extractFullContent({
          meta_title: pageData.meta_title,
          meta_description: pageData.meta_description,
          meta_keywords: pageData.meta_keywords,
          guide_content: pageData.guide_content,
          faq_items: pageData.faq_items
        })

        // 计算目标关键词密度（单关键词优化）
        const keywordDensity = calculateKeywordDensity(fullContent, [pageData.target_keyword])

        // 准备评分数据
        const seoGuideData = {
          meta_title: pageData.meta_title,
          meta_description: pageData.meta_description,
          meta_keywords: pageData.meta_keywords,
          guide_content: pageData.guide_content,
          target_keyword: pageData.target_keyword,
          secondary_keywords: pageData.secondary_keywords || [],
          faq_items: pageData.faq_items || [],
          keyword_density: keywordDensity
        }

        // 调用 AI 评分服务
        const scoreResult = await seoAIService.calculateSEOScore(seoGuideData, aiModel)

        // 使用客户端算法重新计算关键词密度评分（确保准确性）
        const clientKeywordDensityScore = calculateKeywordDensityScore(
          keywordDensity,
          pageData.target_keyword
        )

        // 如果AI评分与客户端计算不一致，使用客户端计算
        if (scoreResult.keyword_density_score !== clientKeywordDensityScore) {
          scoreResult.keyword_density_score = clientKeywordDensityScore
          scoreResult.total_score =
            scoreResult.content_quality_score +
            scoreResult.keyword_optimization_score +
            scoreResult.readability_score +
            clientKeywordDensityScore
        }

        // 保存分数到数据库
        const { error: updateError } = await supabase
          .from('seo_page_variants')
          .update({
            seo_score: scoreResult.total_score,
            content_quality_score: scoreResult.content_quality_score,
            keyword_optimization_score: scoreResult.keyword_optimization_score,
            readability_score: scoreResult.readability_score,
            keyword_density_score: scoreResult.keyword_density_score,
            updated_at: new Date().toISOString()
          })
          .eq('id', kw.id)

        if (updateError) throw updateError

        successCount++
        setScoreProgress(prev => ({
          ...prev,
          logs: [...prev.logs, `✓ 评分完成: ${kw.keyword} - ${scoreResult.total_score}分`]
        }))
      } catch (error) {
        failedCount++
        setScoreProgress(prev => ({
          ...prev,
          logs: [...prev.logs, `✗ 评分失败: ${kw.keyword} - ${error.message}`]
        }))
      }
    }

    setScoreProgress(prev => ({
      ...prev,
      logs: [...prev.logs, `\n批量评分完成！成功: ${successCount}，失败: ${failedCount}`]
    }))

    setScoring(false)

    // 刷新列表
    queryClient.invalidateQueries({ queryKey: ['seo-keywords', templateId, language, contentTemplate] })
  }

  // 确认批量生成
  const handleConfirmGenerate = async () => {
    console.log('[批量生成] 函数被调用')
    console.log('[批量生成] templateId:', templateId)
    console.log('[批量生成] selectionModel:', selectionModel)
    console.log('[批量生成] keywords:', keywords)

    if (!templateId) {
      showToast('请先选择视频模板', 'warning')
      return
    }

    setGenerating(true)
    console.log('[批量生成] 设置 generating = true')

    const selectedKeywords = keywords.filter(k => selectionModel.includes(k.id))
    console.log('[批量生成] selectedKeywords:', selectedKeywords)

    setGenerateProgress({
      total: selectedKeywords.length,
      current: 0,
      currentKeyword: '',
      logs: [`开始批量生成 ${selectedKeywords.length} 个关键词的 SEO 内容...`]
    })
    console.log('[批量生成] 设置初始进度')

    let successCount = 0
    let failedCount = 0

    console.log('[批量生成] 开始循环,总数:', selectedKeywords.length)
    for (let i = 0; i < selectedKeywords.length; i++) {
      const kw = selectedKeywords[i]
      console.log(`[批量生成] 处理第 ${i + 1}/${selectedKeywords.length} 个关键词:`, kw.keyword)

      setGenerateProgress(prev => ({
        ...prev,
        current: i + 1,
        currentKeyword: kw.keyword,
        logs: [...prev.logs, `\n[${i + 1}/${selectedKeywords.length}] 正在生成: ${kw.keyword}`]
      }))

      try {
        console.log('[批量生成] 开始调用生成服务')
        console.log('[批量生成] 使用 AI 模型:', aiModel)
        // 调用内容生成服务
        const result = await contentGenerationService.generateContent({
          templateId: templateId,
          language: language,
          targetKeyword: kw.keyword,
          contentTemplateSlug: contentTemplate,
          aiModel: aiModel
        })
        console.log('[批量生成] 生成服务返回:', result)
        // generateContent 方法已经自动保存到数据库了,所以这里只需要记录成功即可
        console.log('[批量生成] 内容已生成并保存,页面ID:', result.pageVariantId)

        successCount++
        setGenerateProgress(prev => ({
          ...prev,
          logs: [...prev.logs, `✓ 成功生成: ${kw.keyword}`]
        }))
      } catch (error) {
        console.error('[批量生成] 错误:', error)
        failedCount++
        setGenerateProgress(prev => ({
          ...prev,
          logs: [...prev.logs, `✗ 生成失败: ${kw.keyword} - ${error.message}`]
        }))
      }
    }

    console.log('[批量生成] 循环结束,成功:', successCount, '失败:', failedCount)

    setGenerateProgress(prev => ({
      ...prev,
      logs: [...prev.logs, `\n批量生成完成！成功: ${successCount}，失败: ${failedCount}`]
    }))

    setGenerating(false)
    setGenerateCompleted(true)
    console.log('[批量生成] 设置 generating = false, generateCompleted = true')

    // 刷新列表
    queryClient.invalidateQueries({ queryKey: ['seo-keywords', templateId, language, contentTemplate] })
  }

  // 确认导入
  const handleConfirmImport = async () => {
    if (!importText.trim()) {
      showToast('请输入关键词', 'warning')
      return
    }

    if (!templateId) {
      showToast('请先选择视频模板', 'warning')
      return
    }

    // 解析关键词（按行分隔，去除空行）
    const keywordsArray = importText
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0)

    // 智能去重：将单词顺序不同但内容相同的关键词视为重复
    // 例如："how to create video" 和 "create video how to" 会被视为同一关键词
    const normalizeKeyword = (keyword: string): string => {
      // 转小写，分割单词，排序，重新组合
      return keyword
        .toLowerCase()
        .split(/\s+/)
        .sort()
        .join(' ')
    }

    const keywordMap = new Map<string, string>()
    const duplicates: string[] = []

    keywordsArray.forEach(keyword => {
      const normalized = normalizeKeyword(keyword)
      if (!keywordMap.has(normalized)) {
        // 保留第一次出现的原始形式
        keywordMap.set(normalized, keyword)
      } else {
        // 记录重复的关键词
        duplicates.push(keyword)
      }
    })

    const uniqueKeywords = Array.from(keywordMap.values())

    if (uniqueKeywords.length === 0) {
      showToast('没有有效的关键词', 'warning')
      return
    }

    try {
      // 1. 获取 content_template_id
      const { data: templateData, error: templateError } = await supabase
        .from('seo_content_templates')
        .select('id')
        .eq('slug', contentTemplate)
        .eq('is_active', true)
        .single()

      if (templateError || !templateData) {
        showToast(`获取内容模板失败: ${templateError?.message || '未找到模板'}`, 'error')
        return
      }

      // 2. 批量插入关键词到 seo_page_variants 表
      const records = uniqueKeywords.map(keyword => ({
        template_id: templateId,
        content_template_id: templateData.id,
        language: language,
        target_keyword: keyword,
        keyword_slug: keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        is_published: false,
        seo_score: 0
      }))

      const { data, error } = await supabase
        .from('seo_page_variants')
        .insert(records)
        .select()

      if (error) {
        console.error('导入关键词失败:', error)
        showToast(`导入失败: ${error.message}`, 'error')
        return
      }

      // 刷新关键词列表
      queryClient.invalidateQueries({ queryKey: ['seo-keywords', templateId, language, contentTemplate] })

      // 显示导入结果
      let message = `成功导入 ${uniqueKeywords.length} 个关键词！`
      if (duplicates.length > 0) {
        message += ` 已自动过滤 ${duplicates.length} 个重复关键词`
      }
      showToast(message, 'success')

      setImportDialogOpen(false)
      setImportText('')
    } catch (err) {
      console.error('导入关键词异常:', err)
      showToast('导入失败，请查看控制台错误信息', 'error')
    }
  }

  // 编辑关键词
  const handleEditClick = (keyword: KeywordRow) => {
    setEditingKeyword(keyword)
    setEditKeywordText(keyword.keyword)
    setEditDialogOpen(true)
  }

  const handleEditConfirm = async () => {
    if (!editingKeyword || !editKeywordText.trim()) {
      showToast('请输入关键词', 'warning')
      return
    }

    try {
      const { error } = await supabase
        .from('seo_page_variants')
        .update({
          target_keyword: editKeywordText.trim(),
          keyword_slug: editKeywordText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingKeyword.id)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['seo-keywords', templateId, language, contentTemplate] })
      showToast('关键词更新成功！', 'success')
      setEditDialogOpen(false)
      setEditingKeyword(null)
      setEditKeywordText('')
    } catch (error: any) {
      console.error('更新关键词失败:', error)
      showToast(`更新失败: ${error.message}`, 'error')
    }
  }

  // 删除关键词
  const handleDeleteClick = (keywordIds: string[]) => {
    setDeletingKeywords(keywordIds)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (deletingKeywords.length === 0) return

    try {
      const { error } = await supabase
        .from('seo_page_variants')
        .delete()
        .in('id', deletingKeywords)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['seo-keywords', templateId, language, contentTemplate] })
      showToast(`成功删除 ${deletingKeywords.length} 个关键词！`, 'success')
      setDeleteConfirmOpen(false)
      setDeletingKeywords([])
      setSelectionModel([])
    } catch (error: any) {
      console.error('删除关键词失败:', error)
      showToast(`删除失败: ${error.message}`, 'error')
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}>
      {/* 标题和操作栏 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          关键词管理
        </Typography>

        {!templateId && (
          <Alert severity="info" sx={{ mb: 2 }}>
            请先在左侧选择视频模板
          </Alert>
        )}

        {/* 操作按钮组 */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<FileDownload />}
            disabled={!templateId}
            onClick={handleImport}
          >
            导入关键词
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<Bolt />}
            disabled={!templateId || selectionModel.length === 0}
            onClick={handleBatchGenerate}
          >
            批量生成 ({selectionModel.length})
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Assessment />}
            disabled={!templateId || selectionModel.length === 0}
            onClick={handleBatchScore}
          >
            批量评分 ({selectionModel.length})
          </Button>
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            disabled={!templateId}
          >
            <MoreVert />
          </IconButton>
        </Box>

        {/* 更多操作菜单 */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleSelectAll}>
            {selectionModel.length === filteredKeywords.length ? (
              <>
                <RadioButtonUnchecked sx={{ mr: 1 }} />
                取消全选
              </>
            ) : (
              <>
                <CheckCircle sx={{ mr: 1 }} />
                全选
              </>
            )}
          </MenuItem>
          <MenuItem
            disabled={selectionModel.length === 0}
            onClick={() => {
              handleDeleteClick(selectionModel as string[])
              handleMenuClose()
            }}
          >
            <Delete sx={{ mr: 1 }} />
            删除选中 ({selectionModel.length})
          </MenuItem>
        </Menu>

      </Box>

      {/* 数据表格 */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {isLoading ? (
          <LinearProgress />
        ) : filteredKeywords.length === 0 ? (
          <Alert severity="info">
            {!templateId ? '请先选择视频模板' : '暂无关键词数据'}
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filteredKeywords.map((kw) => (
              <Box
                key={kw.id}
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: selectedKeyword === kw.keyword ? 'action.selected' : 'background.paper',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* 左侧：复选框 + 关键词文本 */}
                  <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <Checkbox
                      checked={selectionModel.includes(kw.id)}
                      onChange={() => handleToggleSelect(kw.id)}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ mr: 1 }}
                    />
                    <Typography
                      variant="body1"
                      fontWeight="medium"
                      sx={{
                        flex: 1,
                        cursor: 'pointer',
                        mr: 1
                      }}
                      onClick={() => onKeywordSelect(kw.keyword)}
                    >
                      {kw.keyword}
                    </Typography>
                  </Box>
                  {/* 右侧：评分信息 + 状态标签 + 操作按钮 */}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {/* 评分和密度信息 */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mr: 1 }}>
                      {kw.seo_score && (
                        <Chip
                          label={`${kw.seo_score}分`}
                          color={kw.seo_score >= 80 ? 'success' : kw.seo_score >= 60 ? 'warning' : 'error'}
                          size="small"
                        />
                      )}
                      {(() => {
                        const density = calculateKeywordDensityForRow(kw)
                        if (density === null) return null

                        let densityColor: 'success' | 'warning' | 'error' = 'error'
                        if (density >= 1.5 && density <= 2.5) {
                          densityColor = 'success'
                        } else if ((density >= 1.0 && density < 1.5) || (density > 2.5 && density <= 3.0)) {
                          densityColor = 'warning'
                        }

                        return (
                          <Tooltip title={`关键词 "${kw.keyword}" 的密度`}>
                            <Chip
                              label={`密度: ${density.toFixed(2)}%`}
                              color={densityColor}
                              size="small"
                              variant="outlined"
                            />
                          </Tooltip>
                        )
                      })()}
                    </Box>

                    {/* 状态标签 */}
                    <Chip
                      label={
                        kw.status === 'published' ? '已发布' :
                        kw.status === 'generated' ? '已评分' :
                        kw.status === 'pending_score' ? '待评分' :
                        kw.status === 'not_generated' ? '未生成' : '草稿'
                      }
                      color={
                        kw.status === 'published' || kw.status === 'generated' ? 'success' :
                        kw.status === 'pending_score' ? 'warning' : 'default'
                      }
                      size="small"
                    />
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditClick(kw)
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick([kw.id])
                        }}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* 统计信息 */}
      <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="textSecondary">
          共 {keywords.length} 个关键词 | 已选择 {selectionModel.length} 个
        </Typography>
      </Box>

      {/* 导入关键词对话框 */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>导入关键词</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            每行输入一个关键词，系统会自动去重
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={10}
            placeholder="例如：&#10;asmr crunchy food&#10;asmr eating sounds&#10;crunchy asmr videos"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            sx={{ mt: 1 }}
          />
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            当前输入: {importText.split('\n').filter(k => k.trim()).length} 个关键词
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleConfirmImport}>
            确认导入
          </Button>
        </DialogActions>
      </Dialog>

      {/* 批量生成对话框 */}
      <Dialog
        open={generateDialogOpen}
        onClose={() => !generating && setGenerateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>批量生成 SEO 内容</DialogTitle>
        <DialogContent>
          {!generating && !generateCompleted ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              即将为 {selectionModel.length} 个关键词生成 SEO 内容，这可能需要一些时间。确认开始？
            </Alert>
          ) : generateCompleted ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                批量生成已完成！
              </Alert>
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  maxHeight: 300,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {generateProgress.logs.join('\n')}
              </Box>
            </>
          ) : (
            <>
              <LinearProgress
                variant="determinate"
                value={(generateProgress.current / generateProgress.total) * 100}
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" gutterBottom>
                进度: {generateProgress.current} / {generateProgress.total}
              </Typography>
              {generateProgress.currentKeyword && (
                <Typography variant="body2" color="primary" gutterBottom>
                  当前: {generateProgress.currentKeyword}
                </Typography>
              )}
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  maxHeight: 300,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {generateProgress.logs.join('\n')}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          {generateCompleted ? (
            <Button variant="contained" onClick={() => setGenerateDialogOpen(false)}>
              关闭
            </Button>
          ) : (
            <>
              <Button onClick={() => setGenerateDialogOpen(false)} disabled={generating}>
                {generating ? '生成中...' : '取消'}
              </Button>
              {!generating && (
                <Button variant="contained" onClick={handleConfirmGenerate}>
                  开始生成
                </Button>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* 批量评分对话框 */}
      <Dialog
        open={scoreDialogOpen}
        onClose={() => !scoring && setScoreDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>批量评分</DialogTitle>
        <DialogContent>
          {!scoring ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              即将为 {selectionModel.length} 个关键词计算 SEO 分数。确认开始？
            </Alert>
          ) : (
            <>
              <LinearProgress
                variant="determinate"
                value={(scoreProgress.current / scoreProgress.total) * 100}
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" gutterBottom>
                进度: {scoreProgress.current} / {scoreProgress.total}
              </Typography>
              {scoreProgress.currentKeyword && (
                <Typography variant="body2" color="primary" gutterBottom>
                  当前: {scoreProgress.currentKeyword}
                </Typography>
              )}
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  maxHeight: 300,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {scoreProgress.logs.join('\n')}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScoreDialogOpen(false)} disabled={scoring}>
            {scoring ? '评分中...' : '取消'}
          </Button>
          {!scoring && (
            <Button variant="contained" onClick={handleConfirmScore}>
              开始评分
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 编辑关键词对话框 */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>编辑关键词</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="关键词"
              value={editKeywordText}
              onChange={(e) => setEditKeywordText(e.target.value)}
              placeholder="输入关键词"
              helperText="修改后将自动更新 slug"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            取消
          </Button>
          <Button variant="contained" onClick={handleEditConfirm}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="sm"
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              确定要删除 <strong>{deletingKeywords.length}</strong> 个关键词吗？
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              此操作无法撤销，相关的内容和评分数据也会被删除。
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            取消
          </Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast 提示 */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToastOpen(false)}
          severity={toastSeverity}
          sx={{ width: '100%' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default KeywordList
