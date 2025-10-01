/**
 * 模板导入面板组件
 * 支持导入JSON模板文件并显示多语言内容
 */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Upload, 
  File, 
  AlertCircle, 
  CheckCircle, 
  X,
  Eye,
  Download,
  Trash2
} from '@/components/icons'
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '@/types/translation'
import { toast } from 'sonner'

interface ImportedTemplate {
  id: string
  fileName: string
  originalTemplate: any
  multilingualContent: Record<string, any>
  hasMultilingualContent: boolean
  importedAt: Date
  fileType?: 'standard' | 'translation_backup'
}

interface TemplateImportPanelProps {
  onTemplateImport?: (template: any) => void
  onTemplateSelect?: (template: any) => void
}

export default function TemplateImportPanel({
  onTemplateImport,
  onTemplateSelect
}: TemplateImportPanelProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [importedTemplates, setImportedTemplates] = useState<ImportedTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ImportedTemplate | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsImporting(true)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      if (!file.name.endsWith('.json')) {
        toast.error(`${file.name}: ${t('translation.import.invalidFileType')}`)
        continue
      }

      try {
        const content = await readFileAsText(file)
        const templateData = JSON.parse(content)
        
        // 验证模板结构
        const validation = validateTemplate(templateData)
        if (!validation.isValid) {
          toast.error(`${file.name}: ${validation.errors.join(', ')}`)
          continue
        }

        // 使用提取出的实际模板数据
        const actualTemplateData = validation.templateData
        
        // 分析多语言内容
        const multilingualContent = extractMultilingualContent(actualTemplateData)
        const hasMultilingualContent = Object.keys(multilingualContent).length > 0

        const importedTemplate: ImportedTemplate = {
          id: actualTemplateData.id || `imported-${Date.now()}-${i}`,
          fileName: file.name,
          originalTemplate: actualTemplateData,
          multilingualContent,
          hasMultilingualContent,
          importedAt: new Date(),
          fileType: validation.fileType // 添加文件类型信息
        }

        setImportedTemplates(prev => [...prev, importedTemplate])
        onTemplateImport?.(templateData)
        
        toast.success(`${file.name}: ${t('translation.import.importSuccess')}`)

      } catch (error) {
        console.error('导入模板失败:', error)
        toast.error(`${file.name}: ${t('translation.import.importFailed')}`)
      }
    }

    setIsImporting(false)
    // 清空文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 读取文件内容
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file, 'utf-8')
    })
  }

  // 检测文件类型
  const detectFileType = (data: any): 'standard' | 'translation_backup' => {
    // 翻译备份文件包含 translatedTemplate 字段
    if (data.translatedTemplate && typeof data.translatedTemplate === 'object') {
      return 'translation_backup'
    }
    return 'standard'
  }

  // 提取实际模板数据
  const extractTemplateData = (data: any, fileType: 'standard' | 'translation_backup'): any => {
    if (fileType === 'translation_backup') {
      return data.translatedTemplate
    }
    return data
  }

  // 验证模板结构
  const validateTemplate = (data: any): { isValid: boolean; errors: string[]; fileType: 'standard' | 'translation_backup'; templateData: any } => {
    const errors: string[] = []
    const fileType = detectFileType(data)
    const templateData = extractTemplateData(data, fileType)

    // 验证提取出的模板数据
    if (!templateData.id) errors.push(t('translation.import.missingTemplateId'))
    if (!templateData.name) errors.push(t('translation.import.missingTemplateName'))
    
    return {
      isValid: errors.length === 0,
      errors,
      fileType,
      templateData
    }
  }

  // 提取多语言内容
  const extractMultilingualContent = (template: any): Record<string, any> => {
    const content: Record<string, any> = {}
    const languageCodes = SUPPORTED_LANGUAGES.map(lang => lang.code)

    const extractFromObject = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') return

      Object.keys(obj).forEach(key => {
        const value = obj[key]
        const currentPath = path ? `${path}.${key}` : key

        if (typeof value === 'object' && value !== null) {
          // 检查是否是多语言对象
          const isMultilingual = languageCodes.some(code => value.hasOwnProperty(code))
          
          if (isMultilingual) {
            content[currentPath] = value
          } else {
            extractFromObject(value, currentPath)
          }
        }
      })
    }

    extractFromObject(template)
    return content
  }

  // 预览模板
  const handlePreviewTemplate = (template: ImportedTemplate) => {
    setSelectedTemplate(template)
    setShowPreview(true)
  }

  // 选择模板用于翻译
  const handleSelectTemplate = (template: ImportedTemplate) => {
    onTemplateSelect?.(template.originalTemplate)
    toast.success(t('translation.import.templateSelected', { name: template.fileName }))
  }

  // 删除导入的模板
  const handleDeleteTemplate = (templateId: string) => {
    setImportedTemplates(prev => prev.filter(t => t.id !== templateId))
    if (selectedTemplate?.id === templateId) {
      setSelectedTemplate(null)
      setShowPreview(false)
    }
    toast.success(t('translation.import.templateDeleted'))
  }

  // 导出模板
  const handleExportTemplate = (template: ImportedTemplate) => {
    const blob = new Blob([JSON.stringify(template.originalTemplate, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = template.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast.success(t('translation.export.exportCompleted'))
  }

  // 清空所有导入的模板
  const handleClearAll = () => {
    if (window.confirm(t('translation.import.confirmClearAll'))) {
      setImportedTemplates([])
      setSelectedTemplate(null)
      setShowPreview(false)
      toast.success(t('translation.import.allTemplatesCleared'))
    }
  }

  return (
    <div className="space-y-3">
      {/* 导入区域 */}
      <div className="border-2 border-dashed border-border rounded-lg p-4">
        <div className="text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium mb-1">{t('translation.import.importTemplates')}</p>
          <p className="text-xs text-muted-foreground mb-3">
            {t('translation.import.importDescription')}
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isImporting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {t('translation.import.importing')}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2 inline" />
                {t('translation.import.selectFiles')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 导入的模板列表 */}
      {importedTemplates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <File className="h-4 w-4" />
              {t('translation.import.importedTemplates')} ({importedTemplates.length})
            </h3>
            <button
              onClick={handleClearAll}
              className="text-xs text-destructive hover:text-destructive/80"
            >
              <Trash2 className="h-3 w-3 mr-1 inline" />
              {t('translation.import.clearAll')}
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {importedTemplates.map((template) => (
              <div
                key={template.id}
                className="border border-border rounded-lg p-3 bg-background"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium truncate">{template.fileName}</h4>
                      {template.fileType === 'translation_backup' && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                          翻译备份
                        </span>
                      )}
                      {template.fileType === 'standard' && (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                          标准模板
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('translation.import.importedAt')}: {template.importedAt.toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2">
                    {template.hasMultilingualContent ? (
                      <CheckCircle className="h-4 w-4 text-green-600" title={t('translation.import.hasMultilingualContent')} />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-orange-600" title={t('translation.import.noMultilingualContent')} />
                    )}
                  </div>
                </div>

                {/* 多语言内容统计 */}
                {template.hasMultilingualContent && (
                  <div className="mb-2 text-xs text-muted-foreground">
                    {t('translation.import.multilingualFields')}: {Object.keys(template.multilingualContent).length}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreviewTemplate(template)}
                    className="px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded"
                  >
                    <Eye className="h-3 w-3 mr-1 inline" />
                    {t('translation.import.preview')}
                  </button>
                  
                  <button
                    onClick={() => handleSelectTemplate(template)}
                    className="px-2 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded"
                  >
                    {t('translation.import.useForTranslation')}
                  </button>
                  
                  <button
                    onClick={() => handleExportTemplate(template)}
                    className="px-2 py-1 text-xs bg-green-600 text-white hover:bg-green-700 rounded"
                  >
                    <Download className="h-3 w-3 mr-1 inline" />
                    {t('translation.import.export')}
                  </button>
                  
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="px-2 py-1 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 预览模态框 */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-medium">{selectedTemplate.fileName}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* 模板基本信息 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">{t('translation.import.templateInfo')}</h4>
                <div className="bg-muted/30 rounded p-3 text-xs space-y-1">
                  <div><strong>ID:</strong> {selectedTemplate.originalTemplate.id}</div>
                  <div><strong>{t('translation.import.name')}:</strong> {JSON.stringify(selectedTemplate.originalTemplate.name)}</div>
                  {selectedTemplate.originalTemplate.description && (
                    <div><strong>{t('translation.import.description')}:</strong> {JSON.stringify(selectedTemplate.originalTemplate.description)}</div>
                  )}
                </div>
              </div>

              {/* 多语言内容 */}
              {selectedTemplate.hasMultilingualContent && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">{t('translation.import.multilingualContent')}</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedTemplate.multilingualContent).map(([path, content]) => (
                      <div key={path} className="bg-muted/30 rounded p-3">
                        <div className="text-xs font-medium mb-2 text-blue-600">{path}</div>
                        <div className="space-y-1">
                          {SUPPORTED_LANGUAGES.map(lang => {
                            const value = (content as any)[lang.code]
                            if (!value) return null
                            
                            return (
                              <div key={lang.code} className="flex gap-2 text-xs">
                                <span className="w-8 text-muted-foreground">{lang.code}:</span>
                                <span className="flex-1">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 原始JSON */}
              <div>
                <h4 className="text-sm font-medium mb-2">{t('translation.import.rawJson')}</h4>
                <pre className="bg-muted/30 rounded p-3 text-xs overflow-auto max-h-64">
                  {JSON.stringify(selectedTemplate.originalTemplate, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}