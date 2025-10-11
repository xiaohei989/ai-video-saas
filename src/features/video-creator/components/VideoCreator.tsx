import { useState, useEffect, useContext } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguageRouter } from '@/hooks/useLanguageRouter'
import ConfigPanel from './ConfigPanel'
import PreviewPanel from './PreviewPanel'
import PromptSection from './PromptSection'
import { templates } from '../data/templates'
import { videoQueueService } from '@/services/videoQueue'
import { generateRandomParams } from '@/utils/randomParams'
import { AuthContext } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { getVideoCreditCost } from '@/config/credits'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useSEO } from '@/hooks/useSEO'
// import { useVideoGenerationLimiter } from '@/hooks/useRateLimiter' // 已移除限流功能
import { InputValidator } from '@/utils/inputValidator'
import { securityMonitor } from '@/services/securityMonitorService'
import { ThreatType, SecurityLevel } from '@/config/security'
import creditService from '@/services/creditService'
import { videoCacheService } from '@/services/videoCacheService'

export default function VideoCreator() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const templateIdFromUrl = searchParams.get('template')
  const paramsFromUrl = searchParams.get('params')
  const navigate = useNavigate() // for updating URL search params only
  const { navigateTo } = useLanguageRouter()
  const authContext = useContext(AuthContext)
  const user = authContext?.user
  const { trackVideoGeneration, trackTemplateView, trackTemplateUse } = useAnalytics()
  // const { executeWithLimit, isLimited, getRemainingRequests } = useVideoGenerationLimiter() // 已移除限流功能

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
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStatus, setGenerationStatus] = useState<string>('')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [_currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  
  // 队列相关状态
  const [_queueStatus, setQueueStatus] = useState<{
    isQueued: boolean
    position?: number
    estimatedWaitMinutes?: number
    message?: string
  }>({ isQueued: false })
  const [_userQueueInfo, setUserQueueInfo] = useState<{
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
      trackTemplateView(template.id, template.category || 'unknown')
      
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
      newSearchParams.set('template', template.slug || template.id)
      navigate({ search: newSearchParams.toString() }, { replace: true })
      
    }
  }

  const handleParamChange = (key: string, value: any) => {
    // 检查是否是预定义的select选项，如果是则跳过验证
    const param = selectedTemplate.params[key]
    const isSelectOption = param?.type === 'select' && 
      param.options?.some(option => option.value === value)
    
    // 对于预定义的select选项，直接使用不验证
    if (isSelectOption) {
      setParams(prev => ({ ...prev, [key]: value }))
      return
    }
    
    // 安全验证用户输入（仅对非预定义选项）
    if (typeof value === 'string' && value.length > 0) {
      const validation = InputValidator.validateString(value, {
        sanitize: true,
        allowHtml: false,
        maxLength: 2000
      })
      
      if (!validation.isValid) {
        toast.error(`${t('errors.video.validationFailed')}: ${validation.errors[0]}`)
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
    
    // 限流检查已临时禁用 - 解决误判问题
    // if (isLimited()) {
    //   const remainingRequests = getRemainingRequests()
    //   console.error('[限流检查] 用户被限流', {
    //     userId: user?.id,
    //     email: user?.email,
    //     remainingRequests,
    //     isNewUser: !user?.id
    //   })
    //   
    //   toast.error(t('videoCreator.generationLimited'), {
    //     description: `当前剩余请求数：${remainingRequests}。如果这是错误，请刷新页面重试。`,
    //     action: {
    //       label: '刷新页面',
    //       onClick: () => window.location.reload()
    //     }
    //   })
    //   return
    // }

    // 检查用户是否可以提交新任务
    try {
      const submitStatus = await videoQueueService.canUserSubmit(user.id)
      
      if (!submitStatus.canSubmit) {
        const userQueueInfo = await videoQueueService.getUserQueueStatus(user.id)
        toast.error(t('videoCreator.concurrencyLimitError'), {
          description: t('videoCreator.concurrencyLimitDescription', {
            tier: submitStatus.tier || 'free',
            limit: userQueueInfo.maxAllowed
          }),
          action: submitStatus.tier !== 'enterprise' ? {
            label: t('videoCreator.upgradePlan'),
            onClick: () => navigateTo('/pricing')
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
      jsonPrompt = null  // 旧方式不使用JSON格式
      
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
      
      // 为fallback逻辑也添加aspectRatio处理
      if (aspectRatio === '9:16') {
        prompt = `Aspect ratio: 9:16. ${prompt}`
      }
    }

    // Calculate credits based on quality and aspect ratio
    const requiredCredits = getVideoCreditCost(quality === 'fast' ? 'standard' : 'high', aspectRatio)

    // 前置检查：积分是否足够
    try {
      const userCredits = await creditService.getUserCredits(user.id)
      console.log('[前置检查] 用户积分:', userCredits)
      if (!userCredits || userCredits.credits < requiredCredits) {
        console.log('[前置检查] 积分不足，显示错误提示')
        toast.error(t('videoCreator.insufficientCreditsError'), {
          description: t('videoCreator.insufficientCreditsDescription', {
            required: requiredCredits,
            current: userCredits?.credits || 0
          }),
          action: {
            label: t('videoCreator.viewPricingPlans'),
            onClick: () => navigateTo('/pricing')
          }
        })
        return
      }
    } catch (error) {
      console.error('[前置检查] Failed to check user credits:', error)
      // 如果检查失败，直接显示积分不足错误，不继续执行
      toast.error(t('videoCreator.insufficientCreditsError'), {
        description: t('videoCreator.insufficientCreditsDescription', {
          required: requiredCredits,
          current: 0
        }),
        action: {
          label: t('videoCreator.viewPricingPlans'),
          onClick: () => navigateTo('/pricing')
        }
      })
      return
    }


    // Removed special handling for art-coffee-machine custom images

    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationStatus(t('videoCreator.submittingTask'))
    setStartTime(Date.now())
    
    // 直接执行视频生成（已移除限流保护）
    try {
        // 跟踪模板使用和视频生成开始事件
        trackTemplateUse(selectedTemplate.id, selectedTemplate.category || 'unknown')
        // 验证提示词内容
        const promptValidation = InputValidator.validateString(prompt, {
          sanitize: true,
          allowHtml: false,
          maxLength: 5000
        })
        
        if (!promptValidation.isValid) {
          toast.error(`${t('errors.video.promptValidationFailed')}: ${promptValidation.errors[0]}`)
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

        // 清除视频列表缓存，确保跳转后能看到新视频
        console.log('[VideoCreator] 清除视频列表缓存，准备跳转')
        await videoCacheService.clearUserCache(user.id)

        // 立即跳转到我的视频页面，添加 refresh 参数确保强制刷新
        navigateTo('/videos?refresh=true')

        console.log('Task submitted successfully, redirecting to videos page')
        
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
            error: (error as Error)?.message || 'Unknown error',
            templateId: selectedTemplate.id
          },
          blocked: false,
          action: 'video_generation_failed'
        })
        
        // 根据错误类型显示不同的提示信息
        const errorMessage = (error as Error)?.message || ''
        
        if (errorMessage.includes('积分余额不足') || errorMessage.includes('积分不足') || errorMessage.includes('Insufficient credits') || errorMessage.includes('insufficient')) {
          // 积分不足错误
          const userCredits = await creditService.getUserCredits(user.id).catch(() => ({ credits: 0 }))
          toast.error(t('videoCreator.insufficientCreditsError'), {
            description: t('videoCreator.insufficientCreditsDescription', {
              required: requiredCredits,
              current: userCredits?.credits || 0
            }),
            action: {
              label: t('videoCreator.viewPricingPlans'),
              onClick: () => navigateTo('/pricing')
            }
          })
        } else if (errorMessage.includes('达到.*限制') || errorMessage.includes('并发') || errorMessage.includes('concurrent') || errorMessage.includes('limit')) {
          // 并发限制错误
          try {
            const submitStatus = await videoQueueService.canUserSubmit(user.id)
            const userQueueInfo = await videoQueueService.getUserQueueStatus(user.id)
            toast.error(t('videoCreator.concurrencyLimitError'), {
              description: t('videoCreator.concurrencyLimitDescription', {
                tier: submitStatus.tier || 'free',
                limit: userQueueInfo.maxAllowed
              }),
              action: submitStatus.tier !== 'enterprise' ? {
                label: t('videoCreator.upgradePlan'),
                onClick: () => navigateTo('/pricing')
              } : undefined
            })
          } catch {
            toast.error(t('videoCreator.concurrencyLimitError'), {
              description: errorMessage,
              action: {
                label: t('videoCreator.upgradePlan'),
                onClick: () => navigateTo('/pricing')
              }
            })
          }
        } else {
          // 通用错误
          toast.error(t('videoCreator.submitFailed'), {
            description: errorMessage
          })
        }
        throw error
    }
  }

  return (
    <div className="h-full bg-background -mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      {/* 桌面端：左右分栏布局 */}
      <div className="hidden lg:flex flex-row h-full">
        {/* 左侧：配置面板 */}
        <div className="w-80 border-r border-border bg-card flex-shrink-0">
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
          />
        </div>
        
        {/* 右侧：预览面板 + 提示词区域 */}
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
          <PromptSection
            template={selectedTemplate}
            params={params}
            aspectRatio={aspectRatio}
          />
        </div>
      </div>

      {/* 移动端：垂直堆叠布局 */}
      <div className="lg:hidden flex flex-col h-full">
        {/* 1. 配置面板（紧凑布局） */}
        <div className="border-b border-border bg-card">
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
          />
        </div>
        
        {/* 2. 预览面板 */}
        <div className="flex-1 min-h-[300px]">
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
        
        {/* 3. 提示词区域（底部） */}
        <PromptSection
          template={selectedTemplate}
          params={params}
          aspectRatio={aspectRatio}
        />
      </div>
    </div>
  )
}