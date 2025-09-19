/**
 * 翻译预览面板组件
 * 显示原始模板和翻译结果的对比
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Eye, 
  EyeOff, 
  Languages, 
  Copy, 
  Check,
  ChevronDown,
  FileText,
  AlertTriangle
} from 'lucide-react'
import { Template } from '@/features/video-creator/data/templates'
import { localizeTemplate } from '@/features/video-creator/data/templates/index'
import { CustomSelect } from '@/components/ui/custom-select'
import { 
  TemplateTranslationJob,
  SupportedLanguageCode,
  TranslationField
} from '@/types/translation'
import { toast } from 'sonner'

interface TranslationPreviewPanelProps {
  originalTemplate: Template
  translatedTemplate: any
  currentJob: TemplateTranslationJob | null
  previewLanguage: SupportedLanguageCode
  supportedLanguages: readonly { code: string; name: string; nativeName: string }[]
  onPreviewLanguageChange: (language: SupportedLanguageCode) => void
}

export default function TranslationPreviewPanel({
  originalTemplate,
  translatedTemplate,
  currentJob,
  previewLanguage,
  supportedLanguages,
  onPreviewLanguageChange
}: TranslationPreviewPanelProps) {
  const { t, i18n } = useTranslation()
  
  const [showOriginal, setShowOriginal] = useState(true)
  const [showTranslated, setShowTranslated] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    templateInfo: true,
    parameters: true,
    translationStats: false
  })
  const [copiedFields, setCopiedFields] = useState<Record<string, boolean>>({})

  // 本地化原始模板
  const localizedOriginalTemplate = localizeTemplate(originalTemplate, 'en') // 总是使用英文作为原始语言

  // 语言选项
  const languageOptions = supportedLanguages.map(lang => ({
    value: lang.code,
    label: `${lang.nativeName} (${lang.name})`
  }))

  // 切换展开状态
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // 复制文本到剪贴板
  const copyToClipboard = async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedFields(prev => ({ ...prev, [fieldKey]: true }))
      toast.success(t('translation.copiedToClipboard'))
      
      // 2秒后重置复制状态
      setTimeout(() => {
        setCopiedFields(prev => ({ ...prev, [fieldKey]: false }))
      }, 2000)
    } catch (error) {
      toast.error(t('translation.copyFailed'))
    }
  }

  // 获取字段的翻译文本
  const getTranslatedText = (field: TranslationField, language: string): string => {
    return field.translatedTexts[language] || field.originalText
  }

  // 获取字段显示名称
  const getFieldDisplayName = (field: TranslationField): string => {
    const pathParts = field.path.split('.')
    const lastPart = pathParts[pathParts.length - 1]
    
    if (lastPart === 'label') {
      return `${pathParts.slice(0, -1).join('.')} ${t('translation.label')}`
    }
    
    if (field.fieldType === 'name') {
      return t('translation.templateName')
    }
    
    if (field.fieldType === 'description') {
      return t('translation.templateDescription')
    }
    
    return field.path
  }

  // 渲染参数预览
  const renderParameterPreview = (params: any, isTranslated: boolean = false) => {
    if (!params) return null

    return (
      <div className="space-y-2">
        {Object.entries(params).map(([key, param]: [string, any]) => (
          <div key={key} className="border border-border rounded p-2 bg-background/50">
            <div className="text-xs font-medium mb-1">
              {isTranslated && typeof param.label === 'object' 
                ? param.label[previewLanguage] || param.label['en'] || key
                : typeof param.label === 'string' 
                ? param.label 
                : key
              }
            </div>
            
            {param.type === 'select' && param.options && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{t('translation.options')}:</div>
                {param.options.map((option: any, index: number) => (
                  <div key={index} className="text-xs pl-2 border-l-2 border-muted">
                    {isTranslated && typeof option.label === 'object'
                      ? option.label[previewLanguage] || option.label['en'] || option.value
                      : typeof option.label === 'string'
                      ? option.label
                      : option.value
                    }
                  </div>
                ))}
              </div>
            )}
            
            {param.description && (
              <div className="text-xs text-muted-foreground mt-1">
                {isTranslated && typeof param.description === 'object'
                  ? param.description[previewLanguage] || param.description['en']
                  : param.description
                }
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // 渲染翻译统计
  const renderTranslationStats = () => {
    if (!currentJob) return null

    const totalFields = currentJob.fields.length
    const translatedFields = currentJob.fields.filter(f => f.isTranslated).length
    const errorCount = currentJob.errors.length
    const completionRate = totalFields > 0 ? Math.round((translatedFields / totalFields) * 100) : 0

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-blue-50 p-2 rounded">
            <div className="font-medium text-blue-800">{t('translation.totalFields')}</div>
            <div className="text-blue-600">{totalFields}</div>
          </div>
          <div className="bg-green-50 p-2 rounded">
            <div className="font-medium text-green-800">{t('translation.translatedFields')}</div>
            <div className="text-green-600">{translatedFields}</div>
          </div>
          <div className="bg-purple-50 p-2 rounded">
            <div className="font-medium text-purple-800">{t('translation.completionRate')}</div>
            <div className="text-purple-600">{completionRate}%</div>
          </div>
          <div className="bg-red-50 p-2 rounded">
            <div className="font-medium text-red-800">{t('translation.errors')}</div>
            <div className="text-red-600">{errorCount}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-secondary rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>

        {/* Target Languages */}
        <div className="text-xs">
          <div className="font-medium mb-1">{t('translation.targetLanguages')}:</div>
          <div className="flex flex-wrap gap-1">
            {currentJob.targetLanguages.map(langCode => {
              const lang = supportedLanguages.find(l => l.code === langCode)
              return (
                <span key={langCode} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {lang?.nativeName || langCode}
                </span>
              )
            })}
          </div>
        </div>

        {/* Errors */}
        {errorCount > 0 && (
          <div className="text-xs">
            <div className="font-medium mb-1 text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t('translation.translationErrors')}:
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {currentJob.errors.slice(0, 5).map((error, index) => (
                <div key={index} className="text-red-600 bg-red-50 p-1 rounded text-xs">
                  {error}
                </div>
              ))}
              {currentJob.errors.length > 5 && (
                <div className="text-muted-foreground text-xs">
                  ...{t('translation.andMoreErrors', { count: currentJob.errors.length - 5 })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Languages className="h-5 w-5" />
            {t('translation.translationPreview')}
          </h2>
          
          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('translation.previewLanguage')}:</span>
            <CustomSelect
              value={previewLanguage}
              onChange={(value) => onPreviewLanguageChange(value as SupportedLanguageCode)}
              options={languageOptions}
              className="w-48"
            />
          </div>
        </div>

        {/* View Toggle Buttons */}
        <div className="flex gap-2">
          <button
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              showOriginal 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'bg-background border-border text-muted-foreground hover:bg-accent'
            }`}
            onClick={() => setShowOriginal(!showOriginal)}
          >
            {showOriginal ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {t('translation.originalTemplate')}
          </button>
          
          <button
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              showTranslated 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : 'bg-background border-border text-muted-foreground hover:bg-accent'
            }`}
            onClick={() => setShowTranslated(!showTranslated)}
            disabled={!translatedTemplate}
          >
            {showTranslated ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {t('translation.translatedTemplate')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className={`h-full flex ${showOriginal && showTranslated ? 'divide-x divide-border' : ''}`}>
          
          {/* Original Template */}
          {showOriginal && (
            <div className={`${showTranslated ? 'w-1/2' : 'w-full'} p-4 space-y-4`}>
              <h3 className="font-medium text-blue-700 border-b border-blue-200 pb-2">
                {t('translation.originalTemplate')} (English)
              </h3>

              {/* Template Info */}
              <div className="space-y-2">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => toggleSection('templateInfo')}
                >
                  <span className="font-medium text-sm">{t('translation.templateInformation')}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.templateInfo ? 'rotate-180' : ''}`} />
                </button>
                
                {expandedSections.templateInfo && (
                  <div className="space-y-2 pl-4">
                    <div className="flex items-start justify-between group">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">{t('translation.name')}:</div>
                        <div className="text-sm">{localizedOriginalTemplate.name}</div>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded"
                        onClick={() => copyToClipboard(localizedOriginalTemplate.name, 'original-name')}
                      >
                        {copiedFields['original-name'] ? 
                          <Check className="h-3 w-3 text-green-600" /> : 
                          <Copy className="h-3 w-3" />
                        }
                      </button>
                    </div>
                    
                    {localizedOriginalTemplate.description && (
                      <div className="flex items-start justify-between group">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">{t('translation.description')}:</div>
                          <div className="text-sm">{localizedOriginalTemplate.description}</div>
                        </div>
                        <button
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded"
                          onClick={() => copyToClipboard(localizedOriginalTemplate.description, 'original-desc')}
                        >
                          {copiedFields['original-desc'] ? 
                            <Check className="h-3 w-3 text-green-600" /> : 
                            <Copy className="h-3 w-3" />
                          }
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Parameters */}
              {localizedOriginalTemplate.params && (
                <div className="space-y-2">
                  <button
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => toggleSection('parameters')}
                  >
                    <span className="font-medium text-sm">{t('translation.parameters')}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.parameters ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {expandedSections.parameters && (
                    <div className="pl-4">
                      {renderParameterPreview(localizedOriginalTemplate.params, false)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Translated Template */}
          {showTranslated && (
            <div className={`${showOriginal ? 'w-1/2' : 'w-full'} p-4 space-y-4`}>
              {translatedTemplate ? (
                <>
                  <h3 className="font-medium text-green-700 border-b border-green-200 pb-2">
                    {t('translation.translatedTemplate')} ({supportedLanguages.find(l => l.code === previewLanguage)?.nativeName})
                  </h3>

                  {/* Template Info */}
                  <div className="space-y-2">
                    <div className="font-medium text-sm">{t('translation.templateInformation')}</div>
                    
                    <div className="space-y-2 pl-4">
                      {translatedTemplate.name && (
                        <div className="flex items-start justify-between group">
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground">{t('translation.name')}:</div>
                            <div className="text-sm">
                              {typeof translatedTemplate.name === 'object' 
                                ? translatedTemplate.name[previewLanguage] || translatedTemplate.name['en']
                                : translatedTemplate.name
                              }
                            </div>
                          </div>
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded"
                            onClick={() => {
                              const text = typeof translatedTemplate.name === 'object' 
                                ? translatedTemplate.name[previewLanguage] || translatedTemplate.name['en']
                                : translatedTemplate.name
                              copyToClipboard(text, 'translated-name')
                            }}
                          >
                            {copiedFields['translated-name'] ? 
                              <Check className="h-3 w-3 text-green-600" /> : 
                              <Copy className="h-3 w-3" />
                            }
                          </button>
                        </div>
                      )}
                      
                      {translatedTemplate.description && (
                        <div className="flex items-start justify-between group">
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground">{t('translation.description')}:</div>
                            <div className="text-sm">
                              {typeof translatedTemplate.description === 'object'
                                ? translatedTemplate.description[previewLanguage] || translatedTemplate.description['en']
                                : translatedTemplate.description
                              }
                            </div>
                          </div>
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded"
                            onClick={() => {
                              const text = typeof translatedTemplate.description === 'object'
                                ? translatedTemplate.description[previewLanguage] || translatedTemplate.description['en']
                                : translatedTemplate.description
                              copyToClipboard(text, 'translated-desc')
                            }}
                          >
                            {copiedFields['translated-desc'] ? 
                              <Check className="h-3 w-3 text-green-600" /> : 
                              <Copy className="h-3 w-3" />
                            }
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Parameters */}
                  {translatedTemplate.params && (
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{t('translation.parameters')}</div>
                      <div className="pl-4">
                        {renderParameterPreview(translatedTemplate.params, true)}
                      </div>
                    </div>
                  )}

                  {/* Translation Statistics */}
                  {currentJob && (
                    <div className="space-y-2">
                      <button
                        className="flex items-center justify-between w-full text-left"
                        onClick={() => toggleSection('translationStats')}
                      >
                        <span className="font-medium text-sm">{t('translation.translationStatistics')}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.translationStats ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {expandedSections.translationStats && (
                        <div className="pl-4">
                          {renderTranslationStats()}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">{t('translation.noTranslationAvailable')}</p>
                  <p className="text-sm">{t('translation.startTranslationToSeePreview')}</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}