/**
 * AI 模型 Context
 * 用于在 SEO 指南生成器中统一管理 AI 模型选择
 * 应用于生成、评分和优化三个功能
 */

import React, { createContext, useContext, useState, ReactNode } from 'react'

// AI 模型类型
export type AIModelType = 'claude' | 'gpt' | 'gemini' | 'local-claude'

// Context 类型定义
interface AIModelContextType {
  aiModel: AIModelType
  setAiModel: (model: AIModelType) => void
}

// 创建 Context
const AIModelContext = createContext<AIModelContextType | undefined>(undefined)

// Provider Props
interface AIModelProviderProps {
  children: ReactNode
  defaultModel?: AIModelType
}

/**
 * AI 模型 Provider
 */
export const AIModelProvider: React.FC<AIModelProviderProps> = ({
  children,
  defaultModel = 'claude'
}) => {
  const [aiModel, setAiModel] = useState<AIModelType>(defaultModel)

  return (
    <AIModelContext.Provider value={{ aiModel, setAiModel }}>
      {children}
    </AIModelContext.Provider>
  )
}

/**
 * 使用 AI 模型 Context 的 Hook
 */
export const useAIModel = (): AIModelContextType => {
  const context = useContext(AIModelContext)

  if (context === undefined) {
    throw new Error('useAIModel must be used within an AIModelProvider')
  }

  return context
}

/**
 * 获取 AI 模型的完整名称
 */
export const getAIModelName = (model: AIModelType): string => {
  switch (model) {
    case 'claude':
      return 'claude-opus-4-1-20250805'
    case 'gpt':
      return 'gpt-4-gizmo-*'
    case 'gemini':
      return 'gemini-2.5-pro'
    case 'local-claude':
      return 'claude-sonnet-4-5 (Local CLI)'
    default:
      return 'unknown'
  }
}

/**
 * 获取 AI 模型的显示标签
 */
export const getAIModelLabel = (model: AIModelType): string => {
  switch (model) {
    case 'claude':
      return 'Claude Opus 4'
    case 'gpt':
      return 'GPT-4 Gizmo'
    case 'gemini':
      return 'Gemini 2.5 Pro'
    case 'local-claude':
      return '本地 Claude CLI'
    default:
      return 'Unknown'
  }
}

/**
 * 判断是否为本地模型
 */
export const isLocalModel = (model: AIModelType): boolean => {
  return model === 'local-claude'
}
