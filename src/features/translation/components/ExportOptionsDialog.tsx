/**
 * 导出选项对话框组件
 * 允许用户选择不同的导出模式和配置
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Download, 
  FileText, 
  Shield, 
  AlertTriangle,
  X,
  Check,
  Info
} from 'lucide-react'
import { ExportMode, ExportOptions, ExportConfig } from '@/types/translation'

interface ExportOptionsDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (options: ExportOptions, config: ExportConfig) => void
  templateName: string
}

export default function ExportOptionsDialog({
  isOpen,
  onClose,
  onConfirm,
  templateName
}: ExportOptionsDialogProps) {
  const { t } = useTranslation()

  const [exportMode, setExportMode] = useState<ExportMode>('download')
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    includeOriginalTemplate: true,
    includeTranslationJob: true,
    includeMetadata: true,
    exportFormat: 'json',
    outputMode: 'compatible' // 默认使用兼容模式
  })
  const [showConfirmation, setShowConfirmation] = useState(false)

  const exportModes = [
    {
      mode: 'download' as ExportMode,
      icon: Download,
      title: t('translation.export.downloadMode'),
      description: t('translation.export.downloadModeDescription'),
      risk: 'low',
      recommended: true
    },
    {
      mode: 'backup_overwrite' as ExportMode,
      icon: Shield,
      title: t('translation.export.backupOverwriteMode'),
      description: t('translation.export.backupOverwriteModeDescription'),
      risk: 'medium',
      recommended: false
    },
    {
      mode: 'overwrite' as ExportMode,
      icon: FileText,
      title: t('translation.export.overwriteMode'),
      description: t('translation.export.overwriteModeDescription'),
      risk: 'high',
      recommended: false
    }
  ]

  const handleModeSelect = (mode: ExportMode) => {
    setExportMode(mode)
    setShowConfirmation(false)
  }

  const handleConfirm = () => {
    if (exportMode === 'overwrite' && !showConfirmation) {
      setShowConfirmation(true)
      return
    }

    const options: ExportOptions = {
      mode: exportMode,
      createBackup: exportMode === 'backup_overwrite',
      confirmOverwrite: exportMode === 'overwrite'
    }

    onConfirm(options, exportConfig)
    onClose()
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {t('translation.export.chooseExportOption')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {t('translation.export.templateName')}: <span className="font-medium">{templateName}</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Export Mode Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              {t('translation.export.selectExportMode')}
            </h3>
            
            {exportModes.map((modeConfig) => {
              const Icon = modeConfig.icon
              const isSelected = exportMode === modeConfig.mode
              const isHighRisk = modeConfig.risk === 'high'
              
              return (
                <div
                  key={modeConfig.mode}
                  className={`relative p-4 border rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleModeSelect(modeConfig.mode)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{modeConfig.title}</h4>
                        {modeConfig.recommended && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            {t('translation.export.recommended')}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${getRiskColor(modeConfig.risk)}`}>
                          {t(`translation.export.risk.${modeConfig.risk}`)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{modeConfig.description}</p>
                      
                      {isHighRisk && isSelected && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-red-700">
                            {t('translation.export.overwriteWarning')}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {isSelected && (
                      <div className="text-blue-600">
                        <Check className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Export Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              {t('translation.export.exportConfiguration')}
            </h3>
            
            {/* Output Mode Selection */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">
                导出格式
              </h4>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="outputMode"
                    value="compatible"
                    checked={exportConfig.outputMode === 'compatible'}
                    onChange={(e) => setExportConfig(prev => ({
                      ...prev,
                      outputMode: e.target.value as 'compatible' | 'wrapped'
                    }))}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      兼容格式（推荐）
                    </span>
                    <p className="text-xs text-gray-500">
                      导出标准模板文件，可直接替换原文件使用
                    </p>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="outputMode"
                    value="wrapped"
                    checked={exportConfig.outputMode === 'wrapped'}
                    onChange={(e) => setExportConfig(prev => ({
                      ...prev,
                      outputMode: e.target.value as 'compatible' | 'wrapped'
                    }))}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      完整记录格式
                    </span>
                    <p className="text-xs text-gray-500">
                      包含原始模板、翻译结果和完整元数据的备份格式
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Additional Options (only for wrapped mode) */}
            {exportConfig.outputMode === 'wrapped' && (
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportConfig.includeOriginalTemplate}
                  onChange={(e) => setExportConfig(prev => ({
                    ...prev,
                    includeOriginalTemplate: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {t('translation.export.includeOriginalTemplate')}
                  </span>
                  <p className="text-xs text-gray-500">
                    {t('translation.export.includeOriginalTemplateDescription')}
                  </p>
                </div>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportConfig.includeTranslationJob}
                  onChange={(e) => setExportConfig(prev => ({
                    ...prev,
                    includeTranslationJob: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {t('translation.export.includeTranslationJob')}
                  </span>
                  <p className="text-xs text-gray-500">
                    {t('translation.export.includeTranslationJobDescription')}
                  </p>
                </div>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportConfig.includeMetadata}
                  onChange={(e) => setExportConfig(prev => ({
                    ...prev,
                    includeMetadata: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {t('translation.export.includeMetadata')}
                  </span>
                  <p className="text-xs text-gray-500">
                    {t('translation.export.includeMetadataDescription')}
                  </p>
                </div>
              </label>
            </div>
            )}
          </div>

          {/* Confirmation for Overwrite Mode */}
          {exportMode === 'overwrite' && showConfirmation && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-red-900 mb-1">
                    {t('translation.export.confirmOverwrite')}
                  </h4>
                  <p className="text-sm text-red-700 mb-3">
                    {t('translation.export.confirmOverwriteDescription', { templateName })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowConfirmation(false)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      {t('translation.export.confirmOverwriteButton')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">
                  {t('translation.export.exportInfo')}
                </h4>
                <p className="text-sm text-blue-700">
                  {t('translation.export.exportInfoDescription')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={exportMode === 'overwrite' && !showConfirmation}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exportMode === 'overwrite' && !showConfirmation 
              ? t('translation.export.reviewAndConfirm')
              : t('translation.export.export')
            }
          </button>
        </div>
      </div>
    </div>
  )
}