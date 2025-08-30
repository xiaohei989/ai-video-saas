import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronDown, Coins, AlertCircle, Zap, Sparkles, Shuffle } from 'lucide-react'
import { Template } from '../data/templates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CustomSelect } from '@/components/ui/custom-select'
import ImageUploader from './ImageUploader'
import { PromptGenerator } from '@/services/promptGenerator'
import { generateRandomParams } from '@/utils/randomParams'
import { getVideoCreditCost } from '@/config/credits'

interface ConfigPanelProps {
  selectedTemplate: Template
  templates: Template[]
  params: Record<string, any>
  quality: 'fast' | 'high'
  onTemplateChange: (templateId: string) => void
  onParamChange: (key: string, value: any) => void
  onGenerate: () => void
  isGenerating: boolean
}

export default function ConfigPanel({
  selectedTemplate,
  templates,
  params,
  quality,
  onTemplateChange,
  onParamChange,
  onGenerate,
  isGenerating
}: ConfigPanelProps) {
  const { t } = useTranslation()
  const [showTemplateList, setShowTemplateList] = useState(false)

  const renderParam = (key: string, param: any) => {
    const value = params[key]

    switch (param.type) {
      case 'image':
        return (
          <ImageUploader
            key={key}
            label={param.label}
            value={value}
            onChange={(file) => onParamChange(key, file)}
            required={param.required}
          />
        )
      
      case 'text':
        return (
          <div key={key} className="space-y-0">
            <label className="text-xs font-medium">
              {param.label}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </label>
            <input
              type="text"
              className="w-full px-2 py-1 text-xs border border-input bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              value={value || param.default || ''}
              onChange={(e) => onParamChange(key, e.target.value)}
              placeholder={`e.g., ${param.default || 'Enter value'}`}
            />
          </div>
        )
      
      case 'select':
        return (
          <div key={key} className="space-y-0">
            <label className="text-xs font-medium">
              {param.label}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </label>
            <CustomSelect
              value={value || param.default}
              onChange={(newValue) => onParamChange(key, newValue)}
              options={param.options || []}
            />
          </div>
        )
      
      case 'slider':
        return (
          <div key={key} className="space-y-0">
            <div className="flex justify-between">
              <label className="text-xs font-medium">
                {param.label}
                {param.required && <span className="text-destructive ml-1">*</span>}
              </label>
              <span className="text-xs text-muted-foreground">{value || param.default}</span>
            </div>
            <input
              type="range"
              className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
              min={param.min || 0}
              max={param.max || 100}
              value={value || param.default}
              onChange={(e) => onParamChange(key, Number(e.target.value))}
            />
          </div>
        )
      
      case 'toggle':
        return (
          <div key={key} className="flex items-center justify-between">
            <label className="text-xs font-medium">{param.label}</label>
            <button
              className={`relative w-11 h-6 rounded-full transition-colors ${
                (value !== undefined ? value : param.default)
                  ? 'bg-primary'
                  : 'bg-secondary'
              }`}
              onClick={() => onParamChange(key, !(value !== undefined ? value : param.default))}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  (value !== undefined ? value : param.default)
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )
      
      default:
        return null
    }
  }

  const canGenerate = () => {
    // 验证所有必需参数是否已填写
    const missingParams: string[] = []
    
    Object.entries(selectedTemplate.params).forEach(([key, param]) => {
      if (param.required) {
        const value = params[key]
        if (value === undefined || value === null || value === '') {
          missingParams.push(param.label)
        }
      }
    })
    
    return missingParams.length === 0
  }
  
  const getMissingParams = () => {
    const missing: string[] = []
    Object.entries(selectedTemplate.params).forEach(([key, param]) => {
      if (param.required) {
        const value = params[key]
        if (value === undefined || value === null || value === '') {
          missing.push(param.label)
        }
      }
    })
    return missing
  }
  
  const generatePrompt = () => {
    // 使用提示词生成器生成最终提示词
    let prompt = selectedTemplate.promptTemplate
    
    // 替换占位符
    Object.entries(selectedTemplate.params).forEach(([key, param]) => {
      const value = params[key]
      const placeholder = `{${key}}`
      
      if (prompt.includes(placeholder)) {
        let replacementValue = ''
        
        switch (param.type) {
          case 'text':
          case 'select':
            replacementValue = String(value || param.default || '')
            break
          case 'slider':
            replacementValue = String(value ?? param.default ?? '')
            break
          case 'toggle':
            replacementValue = value ? 'enabled' : 'disabled'
            break
          case 'image':
            replacementValue = value ? '[uploaded image]' : ''
            break
          default:
            replacementValue = String(value || '')
        }
        
        prompt = prompt.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacementValue)
      }
    })
    
    return prompt
  }
  
  const handleGenerate = () => {
    if (!canGenerate()) {
      const missing = getMissingParams()
      alert(`Please fill in required fields: ${missing.join(', ')}`)
      return
    }
    
    const prompt = generatePrompt()
    console.log('Generated prompt:', prompt)
    console.log('Parameters:', params)
    
    // 调用实际的生成函数
    onGenerate()
  }

  return (
    <div className="h-full lg:h-full flex flex-col max-h-[50vh] lg:max-h-none">
      {/* Top Section with Credits and Generate Button */}
      <div className="p-3 lg:p-4 border-b border-border">
        {/* Credits Required */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-xs">
            <Coins className="h-3 w-3 text-yellow-600" />
            <span className="text-muted-foreground">{t('configPanel.creditsRequired')}:</span>
            <span className="font-medium">
              {getVideoCreditCost(quality === 'fast' ? 'standard' : 'high')}
            </span>
            {quality === 'fast' && (
              <span className="text-xs text-green-600">({t('configPanel.standard')})</span>
            )}
            {quality === 'high' && (
              <span className="text-xs text-blue-600">({t('configPanel.highQuality')})</span>
            )}
          </div>
        </div>

        {/* Generate Button with gradient and shimmer effect */}
        <button
          className={`
            w-full relative overflow-hidden rounded-md px-4 py-2.5 font-medium text-white
            ${canGenerate() && !isGenerating 
              ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 active:scale-95' 
              : 'bg-gray-400 cursor-not-allowed opacity-50'
            }
          `}
          onClick={handleGenerate}
          disabled={!canGenerate() || isGenerating}
        >
          <span className="relative z-10 flex items-center justify-center">
            {isGenerating ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {t('configPanel.generating')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {t('configPanel.generateVideo')}
              </>
            )}
          </span>
        </button>


        
        {/* Validation Messages */}
        {!canGenerate() && (
          <div className="flex items-start gap-1.5 mt-2 p-2 bg-destructive/10 rounded-md">
            <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-destructive">Required fields missing</p>
              <p className="text-xs text-muted-foreground mt-0">
                Please fill in: {getMissingParams().join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 lg:p-2.5">
        <div className="space-y-2">
          {/* Template Selector with Random Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <button
                className="w-full px-2.5 py-1.5 text-xs border border-input bg-background rounded-md hover:bg-accent flex items-center justify-between"
                onClick={() => setShowTemplateList(!showTemplateList)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{selectedTemplate.icon}</span>
                  <span className="truncate">{selectedTemplate.name}</span>
                </div>
                {showTemplateList ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {/* Template List (dropdown) */}
              {showTemplateList && (
                <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      className="w-full px-2.5 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-1.5"
                      onClick={() => {
                        onTemplateChange(template.id)
                        setShowTemplateList(false)
                      }}
                    >
                      <span className="text-sm">{template.icon}</span>
                      <span>{template.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Random Button */}
            <button
              className="px-2.5 py-1.5 text-xs border border-input bg-background rounded-md hover:bg-accent flex items-center justify-center"
              onClick={() => {
                const randomParams = generateRandomParams(selectedTemplate)
                Object.entries(randomParams).forEach(([key, value]) => {
                  onParamChange(key, value)
                })
                console.log('=== Random Parameters Generated ===')
                console.log('Template:', selectedTemplate.name)
                console.log('Random Params:', randomParams)
              }}
              title="Randomize all parameters"
            >
              <Shuffle className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Parameters Container with Rounded Rectangle */}
          <div className="bg-muted/30 border border-border rounded-lg p-2">
            <div className="space-y-1.5">
              {Object.entries(selectedTemplate.params)
                .filter(([key]) => key !== 'makePublic') // Exclude makePublic if it exists
                .map(([key, param]) => 
                  renderParam(key, param)
                )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}