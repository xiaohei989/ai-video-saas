/**
 * 翻译配置面板组件
 * 模仿ConfigPanel的样式和布局
 */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  ChevronRight, 
  ChevronDown, 
  Languages, 
  AlertCircle, 
  Sparkles, 
  Download,
  FileText,
  Shuffle,
  Upload,
  Settings
} from 'lucide-react'
import { Template } from '@/features/video-creator/data/templates'
import { localizeTemplate } from '@/features/video-creator/data/templates/index'
import { CustomSelect } from '@/components/ui/custom-select'
import PortalDropdown from '@/components/ui/portal-dropdown'
import TemplateImportPanel from './TemplateImportPanel'
import { 
  TranslationConfig, 
  TemplateTranslationJob,
  SupportedLanguageCode 
} from '@/types/translation'

interface TranslationConfigPanelProps {
  selectedTemplate: Template
  templates: Template[]
  config: TranslationConfig
  supportedLanguages: readonly { code: string; name: string; nativeName: string }[]
  isTranslating: boolean
  translationHistory: TemplateTranslationJob[]
  onTemplateChange: (templateId: string) => void
  onConfigChange: (config: Partial<TranslationConfig>) => void
  onStartTranslation: () => void
  onBatchTranslateAll: () => void
  onExportTranslation: () => void
}

export default function TranslationConfigPanel({
  selectedTemplate,
  templates,
  config,
  supportedLanguages,
  isTranslating,
  translationHistory,
  onTemplateChange,
  onConfigChange,
  onStartTranslation,
  onBatchTranslateAll,
  onExportTranslation
}: TranslationConfigPanelProps) {
  const { t, i18n } = useTranslation()
  
  // 本地化模板
  const localizedSelectedTemplate = localizeTemplate(selectedTemplate, i18n.language)
  const localizedTemplates = templates.map(template => localizeTemplate(template, i18n.language))
  
  const [showTemplateList, setShowTemplateList] = useState(false)
  const [showTargetLanguages, setShowTargetLanguages] = useState(false)
  const [activeTab, setActiveTab] = useState<'translation' | 'import'>('translation')
  const templateTriggerRef = useRef<HTMLButtonElement>(null)
  const languagesTriggerRef = useRef<HTMLButtonElement>(null)

  // 语言选项
  const languageOptions = supportedLanguages.map(lang => ({
    value: lang.code,
    label: `${lang.nativeName} (${lang.name})`
  }))

  // 获取源语言显示文本
  const getSourceLanguageText = () => {
    const sourceLang = supportedLanguages.find(lang => lang.code === config.sourceLanguage)
    return sourceLang ? `${sourceLang.nativeName} (${sourceLang.name})` : config.sourceLanguage
  }

  // 获取目标语言显示文本
  const getTargetLanguagesText = () => {
    if (config.targetLanguages.length === 0) return t('translation.selectTargetLanguages')
    if (config.targetLanguages.length === 1) {
      const lang = supportedLanguages.find(l => l.code === config.targetLanguages[0])
      return lang ? lang.nativeName : config.targetLanguages[0]
    }
    return t('translation.languagesSelected', { count: config.targetLanguages.length })
  }

  // 检查是否可以开始翻译
  const canStartTranslation = () => {
    return config.targetLanguages.length > 0 && !isTranslating
  }

  // 获取缺失的配置
  const getMissingConfig = () => {
    const missing: string[] = []
    if (config.targetLanguages.length === 0) {
      missing.push(t('translation.targetLanguages'))
    }
    return missing
  }

  // 切换目标语言选择
  const handleTargetLanguageToggle = (langCode: string) => {
    const currentTargets = [...config.targetLanguages]
    const index = currentTargets.indexOf(langCode as SupportedLanguageCode)
    
    if (index > -1) {
      // 移除语言
      currentTargets.splice(index, 1)
    } else {
      // 添加语言
      currentTargets.push(langCode as SupportedLanguageCode)
    }
    
    onConfigChange({ targetLanguages: currentTargets })
  }

  // 快速选择所有语言
  const handleSelectAllLanguages = () => {
    const allLanguages = supportedLanguages
      .map(lang => lang.code)
      .filter(code => code !== config.sourceLanguage) as SupportedLanguageCode[]
    onConfigChange({ targetLanguages: allLanguages })
  }

  // 清空目标语言
  const handleClearLanguages = () => {
    onConfigChange({ targetLanguages: [] })
  }

  // 处理导入的模板
  const handleImportedTemplateSelect = (template: any) => {
    // 将导入的模板转换为系统模板格式
    const convertedTemplate = {
      ...template,
      // 确保必要字段存在
      icon: template.icon || '🎬',
      credits: template.credits || template.credit_cost || 0,
      tags: template.tags || [],
      params: template.params || template.parameters || {}
    }
    
    onTemplateChange(convertedTemplate.id)
    setActiveTab('translation') // 切换回翻译标签页
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex">
          <button
            className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'translation'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
            onClick={() => setActiveTab('translation')}
          >
            <Settings className="w-4 h-4 mr-2 inline" />
            {t('translation.translationTool')}
          </button>
          <button
            className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
            onClick={() => setActiveTab('import')}
          >
            <Upload className="w-4 h-4 mr-2 inline" />
            {t('translation.import.importTemplates')}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'translation' && (
        <>
          {/* Top Section with Action Buttons */}
          <div className="p-2 lg:p-4 border-b border-border">
        {/* Translation Info */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1 text-xs">
            <Languages className="h-3 w-3 text-blue-600" />
            <span className="text-muted-foreground">{t('translation.supportedLanguages')}:</span>
            <span className="font-medium text-blue-600">
              {supportedLanguages.length}
            </span>
          </div>
        </div>

        {/* Single Template Translation Button */}
        <button
          className={`
            w-full relative overflow-hidden rounded-md px-3 py-2 lg:px-4 lg:py-2.5 font-medium text-white text-sm mb-2
            ${canStartTranslation() && !isTranslating 
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 active:scale-95' 
              : 'bg-gray-400 cursor-not-allowed opacity-50'
            }
          `}
          onClick={onStartTranslation}
          disabled={!canStartTranslation() || isTranslating}
        >
          <span className="relative z-10 flex items-center justify-center">
            {isTranslating ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {t('translation.translating')}
              </>
            ) : (
              <>
                <Languages className="w-4 h-4 mr-2" />
                {t('translation.translateTemplate')}
              </>
            )}
          </span>
        </button>

        {/* Batch Translation Button */}
        <button
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium px-3 py-2 rounded-md text-sm mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onBatchTranslateAll}
          disabled={!canStartTranslation() || isTranslating}
        >
          <span className="flex items-center justify-center">
            <Sparkles className="w-4 h-4 mr-2" />
            {t('translation.batchTranslateAll')}
          </span>
        </button>

        {/* Export Button */}
        <button
          className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-medium px-3 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onExportTranslation}
          disabled={!translationHistory.length}
        >
          <span className="flex items-center justify-center">
            <Download className="w-4 h-4 mr-2" />
            {t('translation.exportTranslation')}
          </span>
        </button>
        
        {/* Validation Messages */}
        {!canStartTranslation() && !isTranslating && (
          <div className="flex items-start gap-1.5 mt-2 p-2 bg-destructive/10 rounded-md">
            <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-destructive">配置不完整</p>
              <p className="text-xs text-muted-foreground mt-0">
                请完成: {getMissingConfig().join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1.5">
          {/* Template Selector */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <button
                ref={templateTriggerRef}
                className="w-full px-2 py-1.5 text-xs border border-input bg-background rounded-md hover:bg-accent flex items-center justify-between"
                onClick={() => setShowTemplateList(!showTemplateList)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{selectedTemplate.icon}</span>
                  <span className="truncate">{localizedSelectedTemplate.name}</span>
                </div>
                {showTemplateList ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              <PortalDropdown
                isOpen={showTemplateList}
                onClose={() => setShowTemplateList(false)}
                triggerRef={templateTriggerRef}
              >
                {localizedTemplates.map((template, index) => (
                  <button
                    key={template.id}
                    className="w-full px-2.5 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-1.5"
                    onClick={() => {
                      onTemplateChange(templates[index].id)
                      setShowTemplateList(false)
                    }}
                  >
                    <span className="text-sm">{template.icon}</span>
                    <span>{template.name}</span>
                  </button>
                ))}
              </PortalDropdown>
            </div>
          </div>

          {/* Translation Configuration */}
          <div className="bg-muted/30 border border-border rounded-lg p-1.5 lg:p-2">
            <div className="space-y-1 lg:space-y-1.5">
              
              {/* Source Language */}
              <div className="space-y-0">
                <label className="text-xs font-medium">
                  {t('translation.sourceLanguage')}
                  <span className="text-destructive ml-1">*</span>
                </label>
                <CustomSelect
                  value={config.sourceLanguage}
                  onChange={(value) => onConfigChange({ sourceLanguage: value as SupportedLanguageCode })}
                  options={languageOptions}
                />
              </div>

              {/* Target Languages */}
              <div className="space-y-0">
                <label className="text-xs font-medium">
                  {t('translation.targetLanguages')}
                  <span className="text-destructive ml-1">*</span>
                </label>
                <div className="relative">
                  <button
                    ref={languagesTriggerRef}
                    className="w-full px-2 py-1.5 text-xs border border-input bg-background rounded-md hover:bg-accent flex items-center justify-between"
                    onClick={() => setShowTargetLanguages(!showTargetLanguages)}
                  >
                    <span className="truncate text-left">
                      {getTargetLanguagesText()}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showTargetLanguages ? 'rotate-180' : ''}`} />
                  </button>

                  <PortalDropdown
                    isOpen={showTargetLanguages}
                    onClose={() => setShowTargetLanguages(false)}
                    triggerRef={languagesTriggerRef}
                  >
                    {/* Quick Actions */}
                    <div className="border-b border-border p-1">
                      <button
                        className="w-full px-2 py-1 text-xs text-blue-600 hover:bg-accent rounded"
                        onClick={handleSelectAllLanguages}
                      >
                        {t('translation.selectAll')}
                      </button>
                      <button
                        className="w-full px-2 py-1 text-xs text-red-600 hover:bg-accent rounded"
                        onClick={handleClearLanguages}
                      >
                        {t('translation.clearAll')}
                      </button>
                    </div>
                    
                    {/* Language List */}
                    {supportedLanguages
                      .filter(lang => lang.code !== config.sourceLanguage)
                      .map(lang => (
                      <button
                        key={lang.code}
                        className="w-full px-2.5 py-1.5 text-xs text-left hover:bg-accent flex items-center justify-between"
                        onClick={() => handleTargetLanguageToggle(lang.code)}
                      >
                        <span>{lang.nativeName} ({lang.name})</span>
                        {config.targetLanguages.includes(lang.code as SupportedLanguageCode) && (
                          <span className="text-green-600">✓</span>
                        )}
                      </button>
                    ))}
                  </PortalDropdown>
                </div>
              </div>

              {/* Translation Options */}
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('translation.translationOptions')}</label>
                
                {/* Include Parameter Labels */}
                <div className="flex items-center justify-between">
                  <label className="text-xs">{t('translation.includeParameterLabels')}</label>
                  <button
                    className={`relative w-8 h-4 rounded-full transition-colors ${
                      config.includeParameterLabels ? 'bg-primary' : 'bg-secondary'
                    }`}
                    onClick={() => onConfigChange({ includeParameterLabels: !config.includeParameterLabels })}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                        config.includeParameterLabels ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Include Option Labels */}
                <div className="flex items-center justify-between">
                  <label className="text-xs">{t('translation.includeOptionLabels')}</label>
                  <button
                    className={`relative w-8 h-4 rounded-full transition-colors ${
                      config.includeOptionLabels ? 'bg-primary' : 'bg-secondary'
                    }`}
                    onClick={() => onConfigChange({ includeOptionLabels: !config.includeOptionLabels })}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                        config.includeOptionLabels ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Include Descriptions */}
                <div className="flex items-center justify-between">
                  <label className="text-xs">{t('translation.includeDescriptions')}</label>
                  <button
                    className={`relative w-8 h-4 rounded-full transition-colors ${
                      config.includeDescriptions ? 'bg-primary' : 'bg-secondary'
                    }`}
                    onClick={() => onConfigChange({ includeDescriptions: !config.includeDescriptions })}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                        config.includeDescriptions ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Include Template Names */}
                <div className="flex items-center justify-between">
                  <label className="text-xs">{t('translation.includeTemplateNames')}</label>
                  <button
                    className={`relative w-8 h-4 rounded-full transition-colors ${
                      config.includeTemplateNames ? 'bg-primary' : 'bg-secondary'
                    }`}
                    onClick={() => onConfigChange({ includeTemplateNames: !config.includeTemplateNames })}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                        config.includeTemplateNames ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('translation.advancedOptions')}</label>
                
                {/* Batch Size */}
                <div className="space-y-0">
                  <div className="flex justify-between">
                    <label className="text-xs">{t('translation.batchSize')}</label>
                    <span className="text-xs text-muted-foreground">{config.batchSize}</span>
                  </div>
                  <input
                    type="range"
                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
                    min={1}
                    max={10}
                    value={config.batchSize}
                    onChange={(e) => onConfigChange({ batchSize: Number(e.target.value) })}
                  />
                </div>

                {/* Max Retries */}
                <div className="space-y-0">
                  <div className="flex justify-between">
                    <label className="text-xs">{t('translation.maxRetries')}</label>
                    <span className="text-xs text-muted-foreground">{config.maxRetries}</span>
                  </div>
                  <input
                    type="range"
                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
                    min={0}
                    max={5}
                    value={config.maxRetries}
                    onChange={(e) => onConfigChange({ maxRetries: Number(e.target.value) })}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Translation History */}
          {translationHistory.length > 0 && (
            <div className="bg-muted/30 border border-border rounded-lg p-1.5 lg:p-2">
              <div className="flex items-center gap-1 mb-2">
                <FileText className="h-3 w-3" />
                <span className="text-xs font-medium">{t('translation.translationHistory')}</span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {translationHistory.slice(0, 5).map((job, index) => (
                  <div key={index} className="text-xs p-1.5 bg-background rounded border">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{job.templateName}</span>
                      <span className={`text-xs px-1 rounded ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {job.fields.length} {t('translation.fields')}, {job.targetLanguages.length} {t('translation.languages')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
        </>
      )}

      {/* Import Tab Content */}
      {activeTab === 'import' && (
        <div className="flex-1 overflow-y-auto p-2 lg:p-4">
          <TemplateImportPanel
            onTemplateSelect={handleImportedTemplateSelect}
          />
        </div>
      )}
    </div>
  )
}