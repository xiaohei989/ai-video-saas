import React, { useState, useEffect, useContext } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ConfigPanel from './ConfigPanel'
import PreviewPanel from './PreviewPanel'
import { templates } from '../data/templates'
import veo3Service from '@/services/veo3Service'
import supabaseVideoService from '@/services/supabaseVideoService'
import videoQueueService from '@/services/videoQueueService'
import { generateRandomParams, getParamsDescription } from '@/utils/randomParams'
import { AuthContext } from '@/contexts/AuthContext'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Clock, Users, Info } from 'lucide-react'
import { toast } from 'sonner'
import { getVideoCreditCost } from '@/config/credits'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useSEO } from '@/hooks/useSEO'
import { useVideoGenerationLimiter } from '@/hooks/useRateLimiter'
import { InputValidator } from '@/utils/inputValidator'
import { securityMonitor } from '@/services/securityMonitorService'
import { ThreatType, SecurityLevel } from '@/config/security'

export default function VideoCreator() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const templateIdFromUrl = searchParams.get('template')
  const paramsFromUrl = searchParams.get('params')
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const { trackVideoGeneration, trackTemplateView, trackTemplateUse, trackEvent } = useAnalytics()
  const { executeWithLimit, isLimited, getRemainingRequests } = useVideoGenerationLimiter()

  // SEO优化
  useSEO('create')
  
  // Find template from URL parameter or default to first template
  const foundTemplate = templateIdFromUrl ? templates.find(t => t.id === templateIdFromUrl || t.slug === templateIdFromUrl) : null
  const initialTemplate = foundTemplate || templates[0]
  
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate)
  const [params, setParams] = useState<Record<string, any>>(() => {
    // 首先尝试从URL参数恢复之前的配置
    if (paramsFromUrl) {
      try {
        const urlParams = JSON.parse(decodeURIComponent(paramsFromUrl))
        return urlParams
      } catch (error) {
        console.error('解析URL参数失败:', error)
      }
    }
    
    // 如果没有URL参数或解析失败，使用随机参数
    const randomParams = generateRandomParams(initialTemplate)
    return randomParams
  })
  const [quality, setQuality] = useState<'fast' | 'high'>('fast')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null)
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStatus, setGenerationStatus] = useState<string>('')
  const [startTime, setStartTime] = useState<number | null>(null)
  
  // 队列相关状态
  const [queueStatus, setQueueStatus] = useState<{
    isQueued: boolean
    position?: number
    estimatedWaitMinutes?: number
    message?: string
  }>({ isQueued: false })
  const [userQueueInfo, setUserQueueInfo] = useState<{
    activeCount: number
    maxAllowed: number
    tier?: string
  } | null>(null)

  // Handle template selection from URL parameter on component mount
  useEffect(() => {
    if (templateIdFromUrl) {
      const templateFromUrl = templates.find(t => t.id === templateIdFromUrl || t.slug === templateIdFromUrl)
      if (templateFromUrl && templateFromUrl.id !== selectedTemplate.id) {
        setSelectedTemplate(templateFromUrl)
        
        // 只有在没有URL参数时才生成随机参数，避免覆盖恢复的参数
        if (!paramsFromUrl) {
          const randomParams = generateRandomParams(templateFromUrl)
          setParams(randomParams)
          
        }
      }
    }
  }, [templateIdFromUrl, paramsFromUrl]) // 移除 selectedTemplate.id 依赖

  // 初始化队列服务并获取用户队列信息
  useEffect(() => {
    const initializeQueue = async () => {
      if (!user) return
      
      // 初始化队列服务
      await videoQueueService.initialize()
      
      // 获取用户当前队列状态
      const userStatus = await videoQueueService.getUserQueueStatus(user.id)
      
      // 检查用户提交状态以获取订阅等级
      const submitStatus = await videoQueueService.canUserSubmit(user.id)
      
      setUserQueueInfo({
        activeCount: userStatus.activeCount,
        maxAllowed: userStatus.maxAllowed,
        tier: submitStatus.tier
      })
      
      // 检查是否有排队的视频
      if (userStatus.queuedJobs.length > 0) {
        const nextJob = userStatus.queuedJobs[0]
        setQueueStatus({
          isQueued: true,
          position: nextJob.position,
          estimatedWaitMinutes: nextJob.estimatedWaitMinutes,
          message: t('videoCreator.videosInQueue', { count: userStatus.queuedJobs.length })
        })
      }
    }
    
    initializeQueue()
  }, [user])

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(template)
      
      // 跟踪模板查看事件
      trackTemplateView(template.id, template.category)
      
      // Generate random params for the new template
      const randomParams = generateRandomParams(template)
      setParams(randomParams)
      
      // Clear any previously generated video to show the new template's preview
      setGeneratedVideoUrl(null)
      setCurrentVideoId(null)
      setIsGenerating(false)
      setGenerationProgress(0)
      setGenerationStatus('')
      setStartTime(null)
      
      // Update URL to reflect the new template selection
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('template', template.slug)
      navigate({ search: newSearchParams.toString() }, { replace: true })
      
    }
  }

  const handleParamChange = (key: string, value: any) => {
    // 安全验证用户输入
    if (typeof value === 'string' && value.length > 0) {
      const validation = InputValidator.validateString(value, {
        sanitize: true,
        allowHtml: false,
        maxLength: 2000
      })
      
      if (!validation.isValid) {
        toast.error(`输入验证失败: ${validation.errors[0]}`)
        return
      }
      
      // 记录可疑活动
      if (validation.threatLevel === SecurityLevel.HIGH || validation.threatLevel === SecurityLevel.CRITICAL) {
        securityMonitor.logSecurityEvent({
          type: ThreatType.SUSPICIOUS_PATTERN,
          level: validation.threatLevel,
          userId: user?.id,
          details: {
            input: value.substring(0, 100), // 只记录前100个字符
            paramKey: key,
            templateId: selectedTemplate.id,
            threats: validation.threats
          },
          blocked: false,
          action: 'param_input'
        })
      }
      
      value = validation.sanitized || value
    }
    
    setParams(prev => ({ ...prev, [key]: value }))
  }

  const handleGenerate = async (promptData?: { prompt: string; jsonPrompt: any }) => {
    // Check if user is authenticated
    if (!user) {
      toast.error(t('videoCreator.loginRequired'))
      return
    }
    
    // 检查是否被限流
    if (isLimited()) {
      toast.error(t('videoCreator.generationLimited'))
      return
    }

    // 检查用户是否可以提交新任务
    try {
      const submitStatus = await videoQueueService.canUserSubmit(user.id)
      
      if (!submitStatus.canSubmit) {
        toast.error(submitStatus.reason || t('videoCreator.cannotSubmit'), {
          action: submitStatus.tier !== 'enterprise' ? {
            label: t('videoCreator.upgradePlan'),
            onClick: () => navigate('/pricing')
          } : undefined
        })
        return
      }
    } catch (error) {
      console.error('Failed to check submit status:', error)
      toast.error(t('videoCreator.systemBusy'))
      return
    }

    // 使用传入的提示词数据，如果没有传入则生成
    let prompt: string
    let jsonPrompt: any
    
    if (promptData) {
      // 使用传入的提示词数据
      prompt = promptData.prompt
      jsonPrompt = promptData.jsonPrompt
      console.log('Using provided prompt data:', { prompt, jsonPrompt })
    } else {
      // 兼容旧的调用方式，生成提示词
      prompt = selectedTemplate.promptTemplate as string
      
      // Replace placeholders (保留原有逻辑作为备用)
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
    }

    // Calculate credits based on quality and aspect ratio
    const requiredCredits = getVideoCreditCost(quality === 'fast' ? 'standard' : 'high', aspectRatio)


    // Extract image data from parameters if present
    let imageData = null
    Object.entries(selectedTemplate.params).forEach(([key, param]) => {
      if (param.type === 'image' && params[key]) {
        imageData = params[key]
        console.log('Found image parameter:', key, 'with data')
      }
    })
    
    // Removed special handling for art-coffee-machine custom images

    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationStatus(t('videoCreator.submittingTask'))
    setStartTime(Date.now())
    
    // 使用限流保护的视频生成
    const result = await executeWithLimit(async () => {
      try {
        // 跟踪模板使用和视频生成开始事件
        trackTemplateUse(selectedTemplate.id, selectedTemplate.category)
        // 验证提示词内容
        const promptValidation = InputValidator.validateString(prompt, {
          sanitize: true,
          allowHtml: false,
          maxLength: 5000
        })
        
        if (!promptValidation.isValid) {
          toast.error(`提示词验证失败: ${promptValidation.errors[0]}`)
          throw new Error('Invalid prompt')
        }
        
        // 记录视频生成尝试
        await securityMonitor.logSecurityEvent({
          type: ThreatType.SUSPICIOUS_PATTERN,
          level: SecurityLevel.LOW,
          userId: user.id,
          details: {
            templateId: selectedTemplate.id,
            quality,
            aspectRatio,
            creditsUsed: requiredCredits
          },
          blocked: false,
          action: 'video_generation_attempt'
        })
        
        trackVideoGeneration({
          template_id: selectedTemplate.id,
          template_category: selectedTemplate.category || 'uncategorized',
          video_quality: quality,
          aspect_ratio: aspectRatio,
          api_provider: (import.meta.env.VITE_PRIMARY_VIDEO_API as 'qingyun' | 'apicore') || 'qingyun',
          credits_used: requiredCredits,
          success: false // 先标记为开始，完成时再更新
        })
        
        // 使用队列服务提交任务
        const result = await videoQueueService.submitJob({
          userId: user.id,
          videoData: {
            templateId: selectedTemplate.id,
            title: selectedTemplate.name,
            description: selectedTemplate.description,
            prompt: promptValidation.sanitized || prompt,
            jsonPrompt: jsonPrompt,
            parameters: params,
            creditsUsed: requiredCredits,
            isPublic: false,
            aspectRatio: aspectRatio,
            quality: quality === 'high' ? 'pro' : 'fast',
            apiProvider: import.meta.env.VITE_PRIMARY_VIDEO_API as 'qingyun' | 'apicore' || 'qingyun'
          }
        })

        setCurrentVideoId(result.videoRecordId)
        console.log('Video job submitted:', result)

        // 根据结果更新UI状态
        if (result.status === 'queued') {
          setQueueStatus({
            isQueued: true,
            position: result.queuePosition,
            estimatedWaitMinutes: result.estimatedWaitMinutes,
            message: result.queuePosition && result.queuePosition > 1 
              ? t('videoCreator.videosAheadInQueue', { count: result.queuePosition - 1 })
              : t('videoCreator.videoInQueue')
          })
          setGenerationStatus(t('videoCreator.queuedForProcessing'))
          setIsGenerating(false)
        } else {
          setGenerationStatus(t('videoCreator.generationStarted'))
          setQueueStatus({ isQueued: false })
        }
        
        // 立即跳转到我的视频页面
        navigate('/videos')
        
        console.log('Task submitted successfully, redirecting to videos page')
        return true
        
      } catch (error) {
        console.error('Failed to submit video generation job:', error)
        setIsGenerating(false)
        setGenerationProgress(0)
        setGenerationStatus('')
        setStartTime(null)
        setQueueStatus({ isQueued: false })
        
        // 记录失败的生成尝试
        await securityMonitor.logSecurityEvent({
          type: ThreatType.SUSPICIOUS_PATTERN,
          level: SecurityLevel.LOW,
          userId: user.id,
          details: {
            error: error.message,
            templateId: selectedTemplate.id
          },
          blocked: false,
          action: 'video_generation_failed'
        })
        
        toast.error(t('videoCreator.submitFailed'))
        throw error
      }
    })
    
    if (result === null) {
      // 生成被限流
      toast.error(`视频生成频率过高，剩余额度: ${getRemainingRequests()}`)
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-full bg-background -mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      {/* 配置面板 - 移动端在上方，桌面端在左侧 */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border bg-card flex-shrink-0">
        <ConfigPanel
          selectedTemplate={selectedTemplate}
          templates={templates}
          params={params}
          quality={quality}
          aspectRatio={aspectRatio}
          onTemplateChange={handleTemplateChange}
          onParamChange={handleParamChange}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          isLimited={isLimited()}
          remainingRequests={getRemainingRequests()}
        />
      </div>
      
      {/* 预览面板 - 移动端在下方，桌面端在右侧 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1">
          <PreviewPanel
            template={selectedTemplate}
            videoUrl={generatedVideoUrl}
            isGenerating={isGenerating}
            progress={generationProgress}
            status={generationStatus}
            startTime={startTime}
            quality={quality}
            aspectRatio={aspectRatio}
            onQualityChange={setQuality}
            onAspectRatioChange={setAspectRatio}
          />
        </div>
      </div>
    </div>
  )
}