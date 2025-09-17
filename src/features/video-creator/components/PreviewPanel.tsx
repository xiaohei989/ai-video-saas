import { useMemo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Loader2, Clock, Zap, Monitor, Smartphone, Lock } from 'lucide-react'
import { Template } from '../data/templates'
import { Progress } from '@/components/ui/progress'
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
import SimpleVideoPlayer from '@/components/video/SimpleVideoPlayer'
import LikeCounterButton from '@/components/templates/LikeCounterButton'
import { useTemplateLikes } from '@/hooks/useTemplateLikes'
import { useAuthContext } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import stripeService from '@/services/stripeService'
import { useNavigate } from 'react-router-dom'

interface PreviewPanelProps {
  template: Template
  videoUrl: string | null
  isGenerating: boolean
  progress?: number
  status?: string
  startTime?: number | null
  quality: 'fast' | 'high'
  aspectRatio: '16:9' | '9:16'
  onQualityChange: (quality: 'fast' | 'high') => void
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
  const { t } = useTranslation()
  const { user } = useAuthContext()
  const navigate = useNavigate()
  // Force re-render every second to update time
  const [, setTick] = useState(0)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  
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
    enableAutoRefresh: false
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
              onChange={(value) => onQualityChange(value as 'fast' | 'high')}
              options={[
                { value: 'fast', label: t('videoCreator.fastGeneration') },
                { value: 'high', label: t('videoCreator.highQuality') }
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
                <SimpleVideoPlayer
                  key={`${template.id}-${videoUrl || template.previewUrl || ''}`}
                  src={videoUrl || template.previewUrl || ''}
                  poster={template.thumbnailUrl}
                  className="w-full h-full"
                  showPlayButton={true}
                  autoPlayOnHover={false}
                  objectFit="cover"
                  alt={template.name}
                  videoId={template.id}
                  videoTitle={template.name}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center">
                    <Play className="h-8 w-8" />
                  </div>
                  <p className="text-sm">{t('videoCreator.clickGenerate')}</p>
                </div>
              )}
            </div>
        
        {template.description && (
          <p className="mt-3 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
            {template.description}
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
                navigate('/pricing')
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