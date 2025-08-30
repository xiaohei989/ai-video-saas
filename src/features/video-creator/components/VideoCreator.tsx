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

export default function VideoCreator() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const templateIdFromUrl = searchParams.get('template')
  const paramsFromUrl = searchParams.get('params')
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  
  // Find template from URL parameter or default to first template
  const initialTemplate = templateIdFromUrl 
    ? templates.find(t => t.id === templateIdFromUrl) || templates[0]
    : templates[0]
  
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate)
  const [params, setParams] = useState<Record<string, any>>(() => {
    // 首先尝试从URL参数恢复之前的配置
    if (paramsFromUrl) {
      try {
        const urlParams = JSON.parse(decodeURIComponent(paramsFromUrl))
        console.log('=== 从URL恢复参数配置 ===')
        console.log('Template:', initialTemplate.name)
        console.log('恢复的参数:', urlParams)
        console.log('=========================')
        return urlParams
      } catch (error) {
        console.error('解析URL参数失败:', error)
      }
    }
    
    // 如果没有URL参数或解析失败，使用随机参数
    console.log('=== 使用随机参数 ===')
    const randomParams = generateRandomParams(initialTemplate)
    console.log('Template:', initialTemplate.name)
    console.log('随机参数:', getParamsDescription(randomParams, initialTemplate))
    console.log('==================')
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
      const templateFromUrl = templates.find(t => t.id === templateIdFromUrl)
      if (templateFromUrl && templateFromUrl.id !== selectedTemplate.id) {
        setSelectedTemplate(templateFromUrl)
        
        // 只有在没有URL参数时才生成随机参数，避免覆盖恢复的参数
        if (!paramsFromUrl) {
          const randomParams = generateRandomParams(templateFromUrl)
          setParams(randomParams)
          
          console.log('=== Template Selected from URL ===') 
          console.log('Template ID:', templateIdFromUrl)
          console.log('Template Name:', templateFromUrl.name)
          console.log('Random Params:', getParamsDescription(randomParams, templateFromUrl))
          console.log('===================================')
        } else {
          console.log('=== Template Selected from URL (保持恢复的参数) ===') 
          console.log('Template ID:', templateIdFromUrl)
          console.log('Template Name:', templateFromUrl.name)
          console.log('参数已从URL恢复，保持不变')
          console.log('=======================================')
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
      newSearchParams.set('template', templateId)
      navigate({ search: newSearchParams.toString() }, { replace: true })
      
      // Log the random combination for debugging
      console.log('=== Random Template Parameters Generated ===')
      console.log('Template:', template.name)
      console.log('Random Params:', getParamsDescription(randomParams, template))
      console.log('============================================')
    }
  }

  const handleParamChange = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  const handleGenerate = async () => {
    // Check if user is authenticated
    if (!user) {
      toast.error(t('videoCreator.loginRequired'))
      return
    }

    // 检查用户是否可以提交新任务
    try {
      const submitStatus = await videoQueueService.canUserSubmit(user.id)
      
      if (!submitStatus.canSubmit) {
        toast.error(submitStatus.reason || t('videoCreator.cannotSubmit'), {
          action: submitStatus.tier !== 'premium' ? {
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

    // Generate the prompt with current parameters
    let prompt = selectedTemplate.promptTemplate
    
    // Replace placeholders
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

    // Calculate credits based on quality using global config only
    const requiredCredits = getVideoCreditCost(quality === 'fast' ? 'standard' : 'high')

    console.log('=== Video Generation Request ===')
    console.log('User ID:', user.id)
    console.log('Template:', selectedTemplate.name)
    console.log('Quality Mode:', quality)
    console.log('Aspect Ratio:', aspectRatio)
    console.log('Credits Required:', requiredCredits)
    console.log('Parameters:', params)
    console.log('Generated Prompt:', prompt)
    console.log('Model:', quality === 'fast' ? 'veo-3.0-fast' : 'veo-3.0')
    console.log('================================')

    // Extract image data from parameters if present
    let imageData = null
    Object.entries(selectedTemplate.params).forEach(([key, param]) => {
      if (param.type === 'image' && params[key]) {
        imageData = params[key]
        console.log('Found image parameter:', key, 'with data')
      }
    })
    
    // Special handling for art-coffee-machine template
    if (selectedTemplate.id === 'art-coffee-machine' && 
        params.artwork === 'a custom artwork image' && 
        params.custom_artwork) {
      imageData = params.custom_artwork
      console.log('Using custom artwork for art-coffee-machine template')
    }

    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationStatus(t('videoCreator.submittingTask'))
    setStartTime(Date.now())
    
    try {
      // 使用队列服务提交任务
      const result = await videoQueueService.submitJob({
        userId: user.id,
        videoData: {
          templateId: selectedTemplate.id,
          title: selectedTemplate.name,
          description: selectedTemplate.description,
          prompt: prompt,
          parameters: params,
          creditsUsed: requiredCredits,
          isPublic: false
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
        setIsGenerating(false) // 队列状态下不显示生成中
      } else {
        setGenerationStatus(t('videoCreator.generationStarted'))
        setQueueStatus({ isQueued: false })
      }
      
      // 立即跳转到我的视频页面
      navigate('/videos')
      
      // 队列系统已经处理了所有视频生成流程
      console.log('Task submitted successfully, redirecting to videos page')
      
    } catch (error) {
      console.error('Failed to submit video generation job:', error)
      setIsGenerating(false)
      setGenerationProgress(0)
      setGenerationStatus('')
      setStartTime(null)
      setQueueStatus({ isQueued: false })
      
      toast.error(t('videoCreator.submitFailed'))
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
          onTemplateChange={handleTemplateChange}
          onParamChange={handleParamChange}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
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