/**
 * SEO Manager - 统一的 pSEO 管理界面
 * 三栏布局：模板选择 | 关键词列表 | 页面编辑/预览
 */

import React, { useState } from 'react'
import { Box, Paper } from '@mui/material'
import TemplateSelector from './TemplateSelector'
import KeywordList from './KeywordList'
import PageEditor from './PageEditor'

export interface SEOManagerState {
  selectedTemplateId: string | null
  selectedLanguage: string
  selectedKeyword: string | null
  selectedContentTemplate: string
  selectedAIModel: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli'
}

const SEOManager: React.FC = () => {
  // 全局状态管理
  const [state, setState] = useState<SEOManagerState>({
    selectedTemplateId: null,
    selectedLanguage: 'en',
    selectedKeyword: null,
    selectedContentTemplate: 'how-to',
    selectedAIModel: 'claude'
  })

  // 更新状态的辅助函数
  const updateState = (updates: Partial<SEOManagerState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 2, p: 2 }}>
      {/* 左栏 - 模板选择器 (20%) */}
      <Paper
        elevation={2}
        sx={{
          width: '20%',
          minWidth: '250px',
          maxWidth: '300px',
          overflow: 'auto',
          p: 2
        }}
      >
        <TemplateSelector
          selectedTemplateId={state.selectedTemplateId}
          selectedLanguage={state.selectedLanguage}
          selectedContentTemplate={state.selectedContentTemplate}
          selectedAIModel={state.selectedAIModel}
          onTemplateChange={(templateId) => updateState({ selectedTemplateId: templateId })}
          onLanguageChange={(language) => updateState({ selectedLanguage: language })}
          onContentTemplateChange={(contentTemplate) => updateState({ selectedContentTemplate: contentTemplate })}
          onAIModelChange={(aiModel) => updateState({ selectedAIModel: aiModel })}
        />
      </Paper>

      {/* 中栏 - 关键词列表 (40%) */}
      <Paper
        elevation={2}
        sx={{
          flex: '0 0 40%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <KeywordList
          templateId={state.selectedTemplateId}
          language={state.selectedLanguage}
          contentTemplate={state.selectedContentTemplate}
          aiModel={state.selectedAIModel}
          selectedKeyword={state.selectedKeyword}
          onKeywordSelect={(keyword) => updateState({ selectedKeyword: keyword })}
        />
      </Paper>

      {/* 右栏 - 页面编辑/预览 (40%) */}
      <Paper
        elevation={2}
        sx={{
          flex: '0 0 40%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <PageEditor
          templateId={state.selectedTemplateId}
          language={state.selectedLanguage}
          keyword={state.selectedKeyword}
          contentTemplate={state.selectedContentTemplate}
          aiModel={state.selectedAIModel}
        />
      </Paper>
    </Box>
  )
}

export default SEOManager
