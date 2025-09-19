/**
 * 模板翻译工具主页面
 * 模仿视频生成页面的布局
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { templates } from '@/features/video-creator/data/templates'
import TranslationConfigPanel from './components/TranslationConfigPanel'
import TranslationPreviewPanel from './components/TranslationPreviewPanel'
import TranslationProgressSection from './components/TranslationProgressSection'
import ExportOptionsDialog from './components/ExportOptionsDialog'
import templateTranslationService from '@/services/templateTranslationService'
import fileExportService from '@/services/fileExportService'
import { 
  TemplateTranslationJob,
  TranslationConfig,
  ExportOptions,
  ExportConfig,
  SUPPORTED_LANGUAGES,
  SupportedLanguageCode
} from '@/types/translation'
import { toast } from 'sonner'
import { useSEO } from '@/hooks/useSEO'

export default function TemplateTranslationPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  
  // SEO优化
  useSEO('translation')
  
  // 选中的模板
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0])
  
  // 翻译配置
  const [translationConfig, setTranslationConfig] = useState<TranslationConfig>({
    sourceLanguage: 'en' as SupportedLanguageCode,
    targetLanguages: ['zh', 'ja', 'ko', 'es', 'de', 'fr', 'ar'] as SupportedLanguageCode[],
    includeParameterLabels: true,
    includeOptionLabels: true,
    includeDescriptions: true,
    includeTemplateNames: true,
    preserveEmojis: true,
    maxRetries: 2,
    batchSize: 5
  })
  
  // 翻译任务状态
  const [currentJob, setCurrentJob] = useState<TemplateTranslationJob | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationProgress, setTranslationProgress] = useState(0)
  const [currentField, setCurrentField] = useState<string>('')
  
  // 翻译历史记录
  const [translationHistory, setTranslationHistory] = useState<TemplateTranslationJob[]>([])
  
  // 预览相关状态
  const [previewLanguage, setPreviewLanguage] = useState<SupportedLanguageCode>('zh')
  const [translatedTemplate, setTranslatedTemplate] = useState<any>(null)
  
  // 导出对话框状态
  const [showExportDialog, setShowExportDialog] = useState(false)

  useEffect(() => {
    // 检查用户权限 (暂时禁用用于测试)
    // if (!user) {
    //   toast.error(t('translation.loginRequired'))
    //   return
    // }
    
    // 可以添加管理员权限检查
    // if (!user.isAdmin) {
    //   toast.error(t('translation.adminRequired'))
    //   return
    // }
  }, [user, t])

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(template)
      setTranslatedTemplate(null)
      setCurrentJob(null)
      setTranslationProgress(0)
      setCurrentField('')
    }
  }

  const handleConfigChange = (config: Partial<TranslationConfig>) => {
    setTranslationConfig(prev => ({ ...prev, ...config }))
  }

  const handleStartTranslation = async () => {
    // if (!user) {
    //   toast.error(t('translation.loginRequired'))
    //   return
    // }

    setIsTranslating(true)
    setTranslationProgress(0)
    setCurrentField('')

    try {
      console.log('[TRANSLATION] 开始翻译模板:', {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        config: translationConfig
      })

      const job = await templateTranslationService.translateTemplate(
        selectedTemplate,
        translationConfig,
        (progress, field) => {
          setTranslationProgress(progress)
          setCurrentField(field || '')
          console.log(`[TRANSLATION] 进度更新: ${progress}% - ${field}`)
        }
      )

      setCurrentJob(job)
      setTranslationHistory(prev => [job, ...prev])

      if (job.status === 'completed') {
        // 应用翻译结果到模板
        const translated = templateTranslationService.applyTranslationToTemplate(
          selectedTemplate,
          job
        )
        setTranslatedTemplate(translated)
        
        toast.success(t('translation.translationCompleted'), {
          description: t('translation.translationCompletedDescription', {
            fields: job.fields.length,
            languages: translationConfig.targetLanguages.length
          })
        })
      } else {
        toast.warning(t('translation.translationPartiallyCompleted'), {
          description: t('translation.translationPartiallyCompletedDescription', {
            errors: job.errors.length
          })
        })
      }

    } catch (error) {
      console.error('[TRANSLATION] 翻译失败:', error)
      toast.error(t('translation.translationFailed'), {
        description: error instanceof Error ? error.message : t('translation.unknownError')
      })
    } finally {
      setIsTranslating(false)
    }
  }

  const handleExportTranslation = () => {
    if (!currentJob) {
      toast.error(t('translation.noTranslationToExport'))
      return
    }

    // 打开导出选项对话框
    setShowExportDialog(true)
  }

  const handleExportConfirm = async (options: ExportOptions, config: ExportConfig) => {
    if (!currentJob || !translatedTemplate) {
      toast.error(t('translation.noTranslationToExport'))
      return
    }

    try {
      console.log('[TRANSLATION] 开始导出:', {
        templateSlug: selectedTemplate.slug,
        templateName: selectedTemplate.name?.zh || selectedTemplate.name?.en || selectedTemplate.slug,
        options,
        config
      })

      // 构建导出数据
      const exportData = {
        originalTemplate: selectedTemplate,
        translatedTemplate: translatedTemplate,
        translationJob: currentJob,
        exportDate: new Date().toISOString(),
        config: translationConfig
      }

      // 使用文件导出服务
      await fileExportService.exportTranslation(
        selectedTemplate.slug,
        selectedTemplate.name?.zh || selectedTemplate.name?.en || selectedTemplate.slug,
        exportData,
        options,
        config
      )

      toast.success(t('translation.exportCompleted'), {
        description: options.mode === 'download' 
          ? t('translation.exportDownloadCompleted')
          : options.mode === 'backup_overwrite'
          ? t('translation.exportBackupOverwriteCompleted')
          : t('translation.exportOverwriteCompleted')
      })

    } catch (error) {
      console.error('[TRANSLATION] 导出失败:', error)
      toast.error(t('translation.exportFailed'), {
        description: error instanceof Error ? error.message : t('translation.unknownError')
      })
    }
  }

  const handleBatchTranslateAll = async () => {
    // if (!user) {
    //   toast.error(t('translation.loginRequired'))
    //   return
    // }

    // 确认对话框
    const confirmed = window.confirm(
      t('translation.batchTranslateConfirm', { count: templates.length })
    )
    
    if (!confirmed) return

    setIsTranslating(true)
    const batchJobs: TemplateTranslationJob[] = []
    let completed = 0

    try {
      for (const template of templates) {
        setCurrentField(`${t('translation.translatingTemplate')}: ${template.name?.en || template.slug}`)
        
        const job = await templateTranslationService.translateTemplate(
          template,
          translationConfig,
          (progress) => {
            const overallProgress = Math.round(
              ((completed / templates.length) + (progress / 100 / templates.length)) * 100
            )
            setTranslationProgress(overallProgress)
          }
        )

        batchJobs.push(job)
        completed++
        setTranslationProgress(Math.round((completed / templates.length) * 100))
      }

      setTranslationHistory(prev => [...batchJobs, ...prev])
      
      const successCount = batchJobs.filter(job => job.status === 'completed').length
      const failureCount = batchJobs.length - successCount

      toast.success(t('translation.batchTranslationCompleted'), {
        description: t('translation.batchTranslationCompletedDescription', {
          success: successCount,
          failure: failureCount,
          total: batchJobs.length
        })
      })

    } catch (error) {
      console.error('[TRANSLATION] 批量翻译失败:', error)
      toast.error(t('translation.batchTranslationFailed'), {
        description: error instanceof Error ? error.message : t('translation.unknownError')
      })
    } finally {
      setIsTranslating(false)
      setCurrentField('')
    }
  }

  return (
    <div className="h-full bg-background -mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      {/* 桌面端：左右分栏布局 */}
      <div className="hidden lg:flex flex-row h-full">
        {/* 左侧：翻译配置面板 */}
        <div className="w-80 border-r border-border bg-card flex-shrink-0">
          <TranslationConfigPanel
            selectedTemplate={selectedTemplate}
            templates={templates}
            config={translationConfig}
            supportedLanguages={SUPPORTED_LANGUAGES}
            isTranslating={isTranslating}
            translationHistory={translationHistory}
            onTemplateChange={handleTemplateChange}
            onConfigChange={handleConfigChange}
            onStartTranslation={handleStartTranslation}
            onBatchTranslateAll={handleBatchTranslateAll}
            onExportTranslation={handleExportTranslation}
          />
        </div>
        
        {/* 右侧：预览面板 + 进度区域 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1">
            <TranslationPreviewPanel
              originalTemplate={selectedTemplate}
              translatedTemplate={translatedTemplate}
              currentJob={currentJob}
              previewLanguage={previewLanguage}
              supportedLanguages={SUPPORTED_LANGUAGES}
              onPreviewLanguageChange={setPreviewLanguage}
            />
          </div>
          <TranslationProgressSection
            currentJob={currentJob}
            isTranslating={isTranslating}
            progress={translationProgress}
            currentField={currentField}
            translationHistory={translationHistory}
          />
        </div>
      </div>

      {/* 移动端：垂直堆叠布局 */}
      <div className="lg:hidden flex flex-col h-full">
        {/* 1. 翻译配置面板（紧凑布局） */}
        <div className="border-b border-border bg-card">
          <TranslationConfigPanel
            selectedTemplate={selectedTemplate}
            templates={templates}
            config={translationConfig}
            supportedLanguages={SUPPORTED_LANGUAGES}
            isTranslating={isTranslating}
            translationHistory={translationHistory}
            onTemplateChange={handleTemplateChange}
            onConfigChange={handleConfigChange}
            onStartTranslation={handleStartTranslation}
            onBatchTranslateAll={handleBatchTranslateAll}
            onExportTranslation={handleExportTranslation}
          />
        </div>
        
        {/* 2. 预览面板 */}
        <div className="flex-1 min-h-[300px]">
          <TranslationPreviewPanel
            originalTemplate={selectedTemplate}
            translatedTemplate={translatedTemplate}
            currentJob={currentJob}
            previewLanguage={previewLanguage}
            supportedLanguages={SUPPORTED_LANGUAGES}
            onPreviewLanguageChange={setPreviewLanguage}
          />
        </div>
        
        {/* 3. 进度区域（底部） */}
        <TranslationProgressSection
          currentJob={currentJob}
          isTranslating={isTranslating}
          progress={translationProgress}
          currentField={currentField}
          translationHistory={translationHistory}
        />
      </div>
      
      {/* 导出选项对话框 */}
      <ExportOptionsDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onConfirm={handleExportConfirm}
        templateName={selectedTemplate.name?.zh || selectedTemplate.name?.en || selectedTemplate.slug}
      />
    </div>
  )
}