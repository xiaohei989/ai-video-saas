import { useMemo, useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguageRouter } from '@/hooks/useLanguageRouter'
import { Play, Loader2, Clock, Zap, Monitor, Smartphone, Lock, AlertCircle } from '@/components/icons'
import { Template } from '../data/templates'
import { localizeTemplate } from '../data/templates/index'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ReactVideoPlayer } from '@/components/video/ReactVideoPlayer'
import LikeCounterButton from '@/components/templates/LikeCounterButton'
import { transformCDNUrl } from '@/config/cdnConfig'
import CachedImage from '@/components/ui/CachedImage'
import { useTemplateLikes } from '@/hooks/useTemplateLikes'
import { useAuthContext } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import stripeService from '@/services/stripeService'
import type { VideoQuality } from '@/config/credits'


interface PreviewPanelProps {
  template: Template
  videoUrl: string | null
  isGenerating: boolean
  progress?: number
  status?: string
  startTime?: number | null
  quality: VideoQuality
  aspectRatio: '16:9' | '9:16'
  onQualityChange: (quality: VideoQuality) => void
  onAspectRatioChange: (aspectRatio: '16:9' | '9:16') => void
}

export default function PreviewPanel({
  template,
  videoUrl,
  isGenerating,
  progress = 0,
  status = '',
  startTime,
  quality,
  aspectRatio,
  onQualityChange,
  onAspectRatioChange
}: PreviewPanelProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuthContext()

  // 移动端检测（和TemplatesPage保持一致）
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 768
  }, [])

  // 本地化模板
  const localizedTemplate = localizeTemplate(template, i18n.language)
  const { navigateTo } = useLanguageRouter()
  // Force re-render every second to update time
  const [, setTick] = useState(0)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)

  // 🚀 视频加载错误状态和重试机制
  const [videoLoadError, setVideoLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 2

  // 🚀 处理视频加载错误
  const handleVideoError = useCallback((error: any) => {
    console.error('[PreviewPanel] 视频加载失败:', error)
    setVideoLoadError(true)
  }, [])

  // 🚀 重新加载视频
  const handleRetryLoad = useCallback(() => {
    console.log('[PreviewPanel] 重新加载视频, 尝试次数:', retryCount + 1)
    setVideoLoadError(false)
    setRetryCount(prev => prev + 1)
  }, [retryCount])

  // 🚀 当模板变化时重置错误状态
  useEffect(() => {
    setVideoLoadError(false)
    setRetryCount(0)
  }, [template.id])

  // 查询用户订阅状态
  const { data: subscription } = useQuery({
    queryKey: ['user-subscription', user?.id],
    queryFn: () => user?.id ? stripeService.getUserSubscription(user.id) : null,
    enabled: !!user?.id
  })

  // 检查用户是否为付费用户
  const isPaidUser = useMemo(() => {
    return subscription && subscription.plan && subscription.status === 'active'
  }, [subscription])

  // 使用批量点赞管理（和TemplatesPage相同的模式）
  const templateIds = useMemo(() => [template.id], [template.id])
  
  const {
    getLikeStatus,
    updateStatus
  } = useTemplateLikes({
    templateIds,
    enableAutoRefresh: false,
    silent: true
  })
  
  
  useEffect(() => {
    if (isGenerating && startTime) {
      const timer = setInterval(() => {
        setTick(tick => tick + 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isGenerating, startTime])
  
  // Calculate elapsed time
  const elapsedTime = useMemo(() => {
    if (!startTime || !isGenerating) return null
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [startTime, isGenerating, Date.now()]) // Re-render every second when generating

  // Estimate remaining time based on progress
  const estimatedTime = useMemo(() => {
    if (!startTime || !isGenerating || progress === 0) return null
    const elapsed = (Date.now() - startTime) / 1000
    const estimatedTotal = elapsed / (progress / 100)
    const remaining = Math.max(0, estimatedTotal - elapsed)
    const minutes = Math.floor(remaining / 60)
    const seconds = Math.floor(remaining % 60)
    if (minutes > 0) {
      return t('videoCreator.aboutMinutes', { minutes, seconds })
    }
    return t('videoCreator.aboutSeconds', { seconds })
  }, [startTime, isGenerating, progress, t])
  return (
    <div className="h-full overflow-y-auto flex justify-center">
      <div className="max-w-2xl w-full p-3 lg:p-4">
        
        {/* 控制栏 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4 p-3 bg-muted/30 border border-border rounded-lg">
          {/* 输出质量选择器 */}
          <div className="flex-1 w-full sm:w-auto min-w-0">
            <label className="text-sm font-medium mb-1 block">{t('videoCreator.outputQuality')}</label>
            <CustomSelect
              value={quality}
              onChange={(value) => onQualityChange(value as VideoQuality)}
              options={[
                { value: 'veo3', label: t('videoCreator.veo3Fast') },
                { value: 'veo3-pro', label: t('videoCreator.veo3High') },
                { value: 'veo3.1-fast', label: t('videoCreator.veo31Fast') },
                { value: 'veo3.1-pro', label: t('videoCreator.veo31High') }
              ]}
            />
          </div>

          {/* 宽高比选择器 */}
          <div className="flex flex-col items-start sm:items-center gap-2 w-full sm:w-auto">
            <label className="text-sm font-medium whitespace-nowrap">{t('videoCreator.aspectRatio')}</label>
            <Tabs value={aspectRatio} onValueChange={(value) => {
              // 检查9:16格式的权限
              if (value === '9:16' && !isPaidUser) {
                setShowUpgradeDialog(true)
                return
              }
              onAspectRatioChange(value as '16:9' | '9:16')
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="16:9" className="flex items-center space-x-2">
                  <Monitor className="w-4 h-4" />
                  <span>16:9</span>
                </TabsTrigger>
                <TabsTrigger
                  value="9:16"
                  className="flex items-center space-x-2 relative"
                  disabled={!isPaidUser}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>9:16</span>
                  {!isPaidUser && (
                    <Lock className="w-3 h-3 text-yellow-600" />
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {!isPaidUser && (
              <p className="text-xs text-yellow-600 text-center">
                {t('upgradeDialog.aspectRatioRestriction')}
              </p>
            )}
          </div>

        </div>
        
            <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center relative max-h-80">
              {/* 左上角点赞按钮 */}
              <div className="absolute top-3 left-3 z-10">
                {(() => {
                  const likeStatus = getLikeStatus(template.id)
                  const likeCount = likeStatus?.like_count ?? 0
                  const isLiked = likeStatus?.is_liked ?? false
                  
                  return (
                    <LikeCounterButton
                      templateId={template.id}
                      initialLikeCount={likeCount}
                      initialIsLiked={isLiked}
                      size="sm"
                      variant="default"
                      showIcon={true}
                      animated={true}
                      onLikeChange={(liked, count) => {
                        updateStatus(template.id, { is_liked: liked, like_count: count })
                      }}
                    />
                  )
                })()}
              </div>
              {isGenerating ? (
                <div className="flex flex-col items-center gap-4 text-foreground p-8">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-foreground" />
                    {progress > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-semibold text-foreground">{Math.round(progress)}%</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {status || t('videoCreator.generatingVideo')}
                    </p>
                    
                    {/* Progress Bar */}
                    <div className="w-48 mx-auto">
                      <Progress 
                        value={progress} 
                        className="h-2" 
                      />
                    </div>
                    
                    {/* Time Information */}
                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                      {elapsedTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{t('videoCreator.elapsedTime')}: {elapsedTime}</span>
                        </div>
                      )}
                      {estimatedTime && progress > 10 && (
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          <span>{t('videoCreator.remaining')}: {estimatedTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    {t('videoCreator.pleaseWait')}
                  </p>
                </div>
              ) : videoUrl || template.previewUrl ? (
                <div className="relative w-full h-full">
                  {/* 缓存的缩略图作为背景层 */}
                  {template.thumbnailUrl && (
                    <CachedImage
                      src={transformCDNUrl(template.thumbnailUrl)}
                      alt={localizedTemplate.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      cacheKey={`template_${template.id}`}
                      maxAge={24 * 60 * 60 * 1000} // 24小时缓存
                    />
                  )}

                  {/* 🚀 视频加载错误提示 */}
                  {videoLoadError && retryCount < MAX_RETRIES ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
                      <div className="bg-card/95 p-6 rounded-lg shadow-lg max-w-sm mx-4 text-center">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{t('videoCreator.videoLoadError') || '视频加载失败'}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {isMobile
                            ? (t('videoCreator.videoLoadErrorMobile') || '移动网络可能不稳定，请重试')
                            : (t('videoCreator.videoLoadErrorDesktop') || '网络连接可能有问题，请重试')
                          }
                        </p>
                        <Button
                          onClick={handleRetryLoad}
                          className="w-full"
                        >
                          {t('videoCreator.retry') || '重新加载'}
                        </Button>
                      </div>
                    </div>
                  ) : videoLoadError && retryCount >= MAX_RETRIES ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
                      <div className="bg-card/95 p-6 rounded-lg shadow-lg max-w-sm mx-4 text-center">
                        <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertCircle className="w-8 h-8 text-yellow-500" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{t('videoCreator.videoUnavailable') || '预览视频暂时无法加载'}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t('videoCreator.videoUnavailableDesc') || '不影响视频生成功能，您可以继续配置参数并生成视频'}
                        </p>
                        <Button
                          onClick={() => setVideoLoadError(false)}
                          variant="outline"
                          className="w-full"
                        >
                          {t('common.close') || '关闭'}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {/* 视频播放器在前景层 */}
                  <ReactVideoPlayer
                    key={`${template.id}-${retryCount}-${videoUrl || transformCDNUrl(template.previewUrl) || ''}`}
                    src={videoUrl || transformCDNUrl(template.previewUrl) || ''}
                    poster={transformCDNUrl(template.thumbnailUrl)}
                    className="relative z-10 w-full h-full"
                    objectFit="cover"
                    showPlayButton={true}
                    autoPlayOnHover={!isMobile} // 移动端禁用自动播放，和TemplatesPage保持一致
                    muted={false} // 默认有声音播放
                    alt={localizedTemplate.name}
                    videoId={template.id}
                    videoTitle={localizedTemplate.name}
                    onError={handleVideoError}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center">
                    <Play className="h-8 w-8" />
                  </div>
                  <p className="text-sm">{t('videoCreator.clickGenerate')}</p>
                </div>
              )}
            </div>
        
        {localizedTemplate.description && (
          <p className="mt-3 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
            {localizedTemplate.description}
          </p>
        )}
        
        {/* Tags Display */}
        {template.tags && template.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
            {template.tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 升级提示对话框 */}
      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-yellow-600" />
              {t('upgradeDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('upgradeDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('upgradeDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowUpgradeDialog(false)
                navigateTo('/pricing')
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {t('upgradeDialog.upgrade')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
