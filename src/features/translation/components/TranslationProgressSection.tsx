/**
 * 翻译进度显示组件
 * 显示当前翻译进度和历史记录
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap
} from '@/components/icons'
import { TemplateTranslationJob } from '@/types/translation'

interface TranslationProgressSectionProps {
  currentJob: TemplateTranslationJob | null
  isTranslating: boolean
  progress: number
  currentField: string
  translationHistory: TemplateTranslationJob[]
}

export default function TranslationProgressSection({
  currentJob,
  isTranslating,
  progress,
  currentField,
  translationHistory
}: TranslationProgressSectionProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'in_progress':
        return <Activity className="h-4 w-4 text-blue-600 animate-pulse" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  // 获取状态颜色类
  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'failed':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'in_progress':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  // 格式化时间
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  // 计算持续时间
  const calculateDuration = (job: TemplateTranslationJob) => {
    if (!job.completedAt) return null
    const duration = job.completedAt.getTime() - job.createdAt.getTime()
    const seconds = Math.round(duration / 1000)
    if (seconds < 60) return `${seconds}秒`
    const minutes = Math.round(seconds / 60)
    return `${minutes}分钟`
  }

  if (!isExpanded && !isTranslating && !currentJob) {
    return (
      <div className="border-t border-border bg-card">
        <button
          className="w-full p-2 flex items-center justify-center gap-2 text-muted-foreground hover:bg-accent"
          onClick={() => setIsExpanded(true)}
        >
          <Activity className="h-4 w-4" />
          <span className="text-sm">{t('translation.showTranslationProgress')}</span>
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="border-t border-border bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="font-medium">{t('translation.translationProgress')}</span>
            {isTranslating && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                {t('translation.running')}
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          
          {/* Current Progress */}
          {(isTranslating || currentJob) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t('translation.currentProgress')}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isTranslating 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                      : 'bg-gradient-to-r from-green-500 to-emerald-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Current Field */}
              {currentField && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{t('translation.currentField')}:</span> {currentField}
                </div>
              )}

              {/* Current Job Info */}
              {currentJob && (
                <div className={`p-3 rounded-lg border ${getStatusColorClass(currentJob.status)}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(currentJob.status)}
                    <span className="font-medium">{currentJob.templateName}</span>
                    <span className="text-xs px-2 py-0.5 bg-white/50 rounded">
                      {currentJob.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="font-medium">{t('translation.fields')}:</span> {currentJob.fields.length}
                    </div>
                    <div>
                      <span className="font-medium">{t('translation.languages')}:</span> {currentJob.targetLanguages.length}
                    </div>
                    <div>
                      <span className="font-medium">{t('translation.completed')}:</span> {currentJob.fields.filter(f => f.isTranslated).length}
                    </div>
                    <div>
                      <span className="font-medium">{t('translation.errors')}:</span> {currentJob.errors.length}
                    </div>
                  </div>

                  {currentJob.completedAt && (
                    <div className="text-xs mt-2 pt-2 border-t border-white/30">
                      <span className="font-medium">{t('translation.duration')}:</span> {calculateDuration(currentJob)}
                    </div>
                  )}

                  {/* Error Summary */}
                  {currentJob.errors.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/30">
                      <div className="flex items-center gap-1 text-red-600 mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-xs font-medium">{t('translation.recentErrors')}:</span>
                      </div>
                      <div className="max-h-20 overflow-y-auto space-y-1">
                        {currentJob.errors.slice(-3).map((error, index) => (
                          <div key={index} className="text-xs bg-red-100/50 p-1 rounded">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Translation History */}
          {translationHistory.length > 0 && (
            <div className="space-y-2">
              <button
                className="flex items-center justify-between w-full text-left"
                onClick={() => setShowHistory(!showHistory)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium text-sm">{t('translation.translationHistory')}</span>
                  <span className="text-xs text-muted-foreground">
                    ({translationHistory.length})
                  </span>
                </div>
                {showHistory ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showHistory && (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {translationHistory.slice(0, 10).map((job, index) => (
                    <div
                      key={index}
                      className="p-2 border border-border rounded-lg bg-background/50 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <span className="text-sm font-medium truncate">{job.templateName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(job.createdAt)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex gap-3">
                          <span>{job.fields.length} {t('translation.fields')}</span>
                          <span>{job.targetLanguages.length} {t('translation.languages')}</span>
                          {job.errors.length > 0 && (
                            <span className="text-red-600">{job.errors.length} {t('translation.errors')}</span>
                          )}
                        </div>
                        {job.completedAt && (
                          <div className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {calculateDuration(job)}
                          </div>
                        )}
                      </div>

                      {/* Progress for completed jobs */}
                      {job.status === 'completed' && (
                        <div className="mt-1">
                          <div className="w-full bg-secondary rounded-full h-1">
                            <div 
                              className="bg-green-500 h-1 rounded-full"
                              style={{ 
                                width: `${Math.round((job.fields.filter(f => f.isTranslated).length / job.fields.length) * 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {translationHistory.length > 10 && (
                    <div className="text-center text-xs text-muted-foreground py-2">
                      {t('translation.showingRecentJobs', { count: 10, total: translationHistory.length })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!isTranslating && !currentJob && translationHistory.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('translation.noTranslationActivity')}</p>
              <p className="text-xs">{t('translation.startTranslationToSeeProgress')}</p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}