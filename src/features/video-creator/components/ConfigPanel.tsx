import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronDown, Gem, AlertCircle, Zap, Sparkles, Shuffle, Copy, Eye, EyeOff } from 'lucide-react'
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
  aspectRatio: '16:9' | '9:16'
  onTemplateChange: (templateId: string) => void
  onParamChange: (key: string, value: any) => void
  onGenerate: (promptData: { prompt: string; jsonPrompt: any }) => void
  isGenerating: boolean
}

export default function ConfigPanel({
  selectedTemplate,
  templates,
  params,
  quality,
  aspectRatio,
  onTemplateChange,
  onParamChange,
  onGenerate,
  isGenerating
}: ConfigPanelProps) {
  const { t } = useTranslation()
  const [showTemplateList, setShowTemplateList] = useState(false)
  const [showPromptDebug, setShowPromptDebug] = useState(false)
  const [showValidationError, setShowValidationError] = useState(false)

  // Auto-fill activity description and voiceover when activity changes
  useEffect(() => {
    const activityContentParam = selectedTemplate.params?.activity_content
    if (activityContentParam && params.activity_content) {
      const selectedOption = activityContentParam.options?.find(
        option => option.value === params.activity_content
      )
      
      if (selectedOption) {
        // Auto-fill activity_description if it exists in the option
        if (selectedOption.activity_description && selectedTemplate.params?.activity_description) {
          onParamChange('activity_description', selectedOption.activity_description)
        }
        
        // Auto-fill voiceover_content if it exists in the option
        if (selectedOption.voiceover_content && selectedTemplate.params?.voiceover_content) {
          onParamChange('voiceover_content', selectedOption.voiceover_content)
        }
      }
    }
  }, [params.activity_content, selectedTemplate.id])

  // Time Travel Vlogger: Auto-fill dialogue based on character + scene combination
  useEffect(() => {
    if (selectedTemplate.slug === 'time-travel-vlogger' && params.character_type && params.historical_scene) {
      // Character-Scene dialogue combinations
      const dialogueMap: Record<string, string> = {
        "yeti_jurassic_chase": "0.0s: 'Oh my... these massive footprints...', 1.8s: 'We've actually traveled back to the age of dinosaurs!', 3.2s: 'Look! A real T-Rex is hunting right there!', 5.0s: 'The air smells of ancient earth and primal fear...', 6.5s: 'This is the real prehistoric world in all its glory!'",
        "yeti_ancient_rome_battle": "0.0s: 'The arena horns are sounding—', 1.8s: 'I'm standing in the heart of ancient Rome!', 3.2s: 'Look! Those gladiators' armor gleams in the sunlight!', 5.0s: 'I can hear the clash of sword against shield...', 6.5s: 'This is the legendary Roman Empire in its glory!'",
        "yeti_d_day_normandy": "0.0s: 'The landing craft engines grow louder—', 1.8s: 'We're witnessing history's most crucial landing!', 3.2s: 'Look! Brave soldiers are charging the beach!', 5.0s: 'The air fills with smoke and courage...', 6.5s: 'This is the moment that changed the world!'",
        "yeti_ancient_india_war": "0.0s: 'The war drums thunder across the field—', 1.8s: 'We're witnessing an epic ancient Indian battle!', 3.2s: 'Look! The war elephant cavalry is charging!', 5.0s: 'The earth trembles beneath these giants...', 6.5s: 'This is ancient warfare in all its magnificent glory!'",
        
        "bigfoot_jurassic_chase": "0.0s: 'Folks, something ain't right here—', 1.8s: 'We just dropped into a world full of dinosaurs!', 3.2s: 'Look at that! A real predator in action!', 5.0s: 'The danger level here is off the charts...', 6.5s: 'Welcome to the ultimate survival challenge!'",
        "bigfoot_ancient_rome_battle": "0.0s: 'The scent of war fills the air—', 1.8s: 'This is what a real ancient battlefield looks like!', 3.2s: 'Look! Roman legion tactics at their finest!', 5.0s: 'Steel meets flesh in deadly combat...', 6.5s: 'Now that's what I call true warrior spirit!'",
        "bigfoot_d_day_normandy": "0.0s: 'Brothers, this is it—', 1.8s: 'We're witnessing the greatest amphibious assault ever!', 3.2s: 'Look! Heroes breaking through the defenses!', 5.0s: 'Freedom's price is being paid right here...', 6.5s: 'This is courage and sacrifice in its purest form!'",
        "bigfoot_ancient_india_war": "0.0s: 'Ancient war horns echo across the plains—', 1.8s: 'This is the most epic battle scene from the ancient world!', 3.2s: 'Look! War elephants charging like moving mountains!', 5.0s: 'The very ground shakes beneath their might...', 6.5s: 'Ancient warfare at its most powerful!'",
        
        "polar_bear_jurassic_chase": "0.0s: 'Friends, we've crossed through time itself—', 1.8s: 'Now we find ourselves in the Cretaceous period!', 3.2s: 'Observe! Natural selection's power on full display!', 5.0s: 'This place pulses with primordial life force...', 6.5s: 'Earth's most spectacular chapter unfolds before us!'",
        "polar_bear_ancient_rome_battle": "0.0s: 'Imperial glory is about to unfold—', 1.8s: 'We've entered the splendor of ancient Rome!', 3.2s: 'Look! Civilization and might in perfect harmony!', 5.0s: 'History's wheels are turning before our eyes...', 6.5s: 'This is the power and glory of empire!'",
        "polar_bear_d_day_normandy": "0.0s: 'Liberation's bell is about to toll—', 1.8s: 'We're witnessing history's greatest turning point!', 3.2s: 'Look! Freedom fighters advancing with courage!', 5.0s: 'Hope and fear intertwine in this moment...', 6.5s: 'This represents humanity's finest spirit!'",
        "polar_bear_ancient_india_war": "0.0s: 'Ancient civilization's war begins—', 1.8s: 'We're witnessing the glory of Indian history!', 3.2s: 'Look! Wisdom and strength united in ancient combat!', 5.0s: 'The ancient war drums call across time...', 6.5s: 'This is Eastern martial arts at its pinnacle!'",
        
        "human_vlogger_jurassic_chase": "0.0s: 'OMG guys, this isn't CGI—', 1.8s: 'We actually time-traveled to the dinosaur age!', 3.2s: 'Look! A living, breathing T-Rex right there!', 5.0s: 'This beats Jurassic Park by miles...', 6.5s: 'Hit that follow button for real prehistoric content!'",
        "human_vlogger_ancient_rome_battle": "0.0s: 'Family, this is absolutely epic—', 1.8s: 'We've time-traveled to the Roman Empire!', 3.2s: 'Look! Real gladiators in actual combat!', 5.0s: 'This scene is more epic than any movie...', 6.5s: 'Double-tap for ancient Rome live content!'",
        "human_vlogger_d_day_normandy": "0.0s: 'Guys, history is happening right in front of me—', 1.8s: 'We're actually witnessing the D-Day landings!', 3.2s: 'Look! Real heroes charging into battle!', 5.0s: 'This courage brings tears to my eyes...', 6.5s: 'This is the moment that changed everything!'",
        "human_vlogger_ancient_india_war": "0.0s: 'Amazing! War elephants incoming—', 1.8s: 'We're in the middle of an ancient Indian epic battle!', 3.2s: 'Look! Elephant cavalry making their grand entrance!', 5.0s: 'This visual is absolutely mind-blowing...', 6.5s: 'Ancient warfare's ultimate visual spectacle!'"
      }
      
      const dialogueKey = `${params.character_type}_${params.historical_scene}`
      const dialogue = dialogueMap[dialogueKey]
      
      if (dialogue && selectedTemplate.params?.dialogue_combination) {
        onParamChange('dialogue_combination', dialogue)
      }
    }
  }, [params.character_type, params.historical_scene, selectedTemplate.slug])

  // Baby Profession Interview: Auto-fill dialogues when profession changes
  useEffect(() => {
    if (selectedTemplate.slug === 'baby-profession-interview' && params.baby_profession) {
      const defaultDialogue = PromptGenerator.getDefaultDialogueForProfession(selectedTemplate, params.baby_profession)
      
      if (defaultDialogue.reporter_question && defaultDialogue.baby_response) {
        // Only update if the current values are empty or match the previous profession's defaults
        onParamChange('reporter_question', defaultDialogue.reporter_question)
        onParamChange('baby_response', defaultDialogue.baby_response)
      }
    }
  }, [params.baby_profession, selectedTemplate.slug])

  // Reset validation error when parameters change
  useEffect(() => {
    setShowValidationError(false)
  }, [params])

  const renderParam = (key: string, param: any) => {
    const value = params[key]
    
    // Check conditional display logic
    if (param.showWhen) {
      const dependentValue = params[param.showWhen.field]
      if (dependentValue !== param.showWhen.value) {
        return null // Hide this parameter
      }
    }

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
              value={value !== undefined ? value : (param.default || '')}
              onChange={(e) => onParamChange(key, e.target.value)}
              placeholder={param.placeholder || `e.g., ${param.default || 'Enter value'}`}
            />
          </div>
        )
      
      case 'textarea':
        return (
          <div key={key} className="space-y-0">
            <label className="text-xs font-medium">
              {param.label}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </label>
            <textarea
              className="w-full px-2 py-1 text-xs border border-input bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-vertical"
              value={value !== undefined ? value : (param.default || '')}
              onChange={(e) => onParamChange(key, e.target.value)}
              placeholder={param.placeholder || 'Enter content...'}
              rows={param.rows || 3}
            />
            {param.description && (
              <p className="text-xs text-muted-foreground mt-1">{param.description}</p>
            )}
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
    
    // Special validation for editable content fields
    if (selectedTemplate.slug === 'bigfoot-survival-vlog') {
      // For bigfoot template, ensure activity_description and voiceover_content are not empty when generating
      const activityDesc = params.activity_description
      const voiceoverContent = params.voiceover_content
      
      if (!activityDesc || activityDesc.trim() === '') {
        missingParams.push('Activity Description')
      }
      if (!voiceoverContent || voiceoverContent.trim() === '') {
        missingParams.push('Voiceover Content')
      }
    }
    
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
    
    // Special validation for editable content fields
    if (selectedTemplate.slug === 'bigfoot-survival-vlog') {
      const activityDesc = params.activity_description
      const voiceoverContent = params.voiceover_content
      
      if (!activityDesc || activityDesc.trim() === '') {
        missing.push('Activity Description')
      }
      if (!voiceoverContent || voiceoverContent.trim() === '') {
        missing.push('Voiceover Content')
      }
    }
    
    return missing
  }
  
  const generatePrompt = () => {
    // 统一使用generateJsonPrompt，根据模板格式自动决定输出格式
    // 字符串模板 → 输出字符串，JSON模板 → 输出JSON对象
    return PromptGenerator.generateJsonPrompt(selectedTemplate, params)
  }

  const generateLegacyPrompt = () => {
    // 为了兼容性保留的旧方法（总是输出字符串）
    return PromptGenerator.generatePromptForLocal(selectedTemplate, params)
  }

  const copyPromptToClipboard = async () => {
    const promptResult = generatePrompt()
    
    // 根据结果类型决定复制内容
    const textToCopy = typeof promptResult === 'string' 
      ? promptResult 
      : JSON.stringify(promptResult, null, 2)
    
    try {
      await navigator.clipboard.writeText(textToCopy)
      // 这里可以添加 toast 通知，但为了简洁暂时省略
      console.log('提示词已复制到剪贴板', typeof promptResult === 'string' ? '(文本格式)' : '(JSON格式)')
    } catch (error) {
      console.error('复制失败:', error)
      // 降级方案：创建临时 textarea 进行复制
      const textarea = document.createElement('textarea')
      textarea.value = textToCopy
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      console.log('提示词已复制到剪贴板 (降级方案)')
    }
  }
  
  const handleGenerate = () => {
    if (!canGenerate()) {
      const missing = getMissingParams()
      setShowValidationError(true)
      alert(`Please fill in required fields: ${missing.join(', ')}`)
      return
    }
    
    setShowValidationError(false)
    const promptResult = generatePrompt()
    
    // 为了兼容现有API，同时提供字符串格式
    const stringPrompt = typeof promptResult === 'string' 
      ? promptResult 
      : generateLegacyPrompt()
    
    console.log('Generated prompt result:', promptResult)
    console.log('Prompt type:', typeof promptResult)
    console.log('Parameters:', params)
    
    // 调用实际的生成函数，传递格式化后的数据
    onGenerate({ 
      prompt: stringPrompt, 
      jsonPrompt: promptResult 
    })
  }

  return (
    <div className="h-full lg:h-full flex flex-col max-h-[50vh] lg:max-h-none">
      {/* Top Section with Credits and Generate Button */}
      <div className="p-3 lg:p-4 border-b border-border">
        {/* Credits Required */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-xs">
            <Gem className="h-3 w-3 text-purple-600" />
            <span className="text-muted-foreground">{t('configPanel.creditsRequired')}:</span>
            <span className="font-medium text-purple-600">
              {getVideoCreditCost(quality === 'fast' ? 'standard' : 'high', aspectRatio)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({aspectRatio}, {quality === 'fast' ? t('configPanel.standard') : t('configPanel.highQuality')})
            </span>
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


        
        {/* Validation Messages - only show after generate attempt */}
        {showValidationError && !canGenerate() && (
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

      {/* 测试模式：提示词显示区域 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="border-t border-border bg-muted/20 p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">测试模式 - 最新提示词</span>
            <div className="flex gap-1">
              <button
                className="p-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPromptDebug(!showPromptDebug)}
                title={showPromptDebug ? "隐藏提示词" : "显示提示词"}
              >
                {showPromptDebug ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
              <button
                className="p-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={copyPromptToClipboard}
                title="复制提示词到剪贴板"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
          {showPromptDebug && (
            <div className="bg-background border border-border rounded-md p-2 max-h-32 overflow-y-auto">
              <pre className="text-xs text-foreground whitespace-pre-wrap break-words">
                {(() => {
                  const promptResult = generatePrompt()
                  return typeof promptResult === 'string' 
                    ? promptResult 
                    : JSON.stringify(promptResult, null, 2)
                })()}
              </pre>
            </div>
          )}
        </div>
      )}

    </div>
  )
}