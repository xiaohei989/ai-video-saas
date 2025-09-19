import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Share2, 
  Copy, 
  Gift,
  DollarSign,
  Users,
  CheckCircle2,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import referralService from '@/services/referralService'
import { useAuthContext } from '@/contexts/AuthContext'

interface VideoShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  video: {
    id: string
    title?: string
    description?: string
    video_url?: string
    template_id?: string
    metadata?: any
    thumbnail_url?: string
  }
}

export default function VideoShareModal({ open, onOpenChange, video }: VideoShareModalProps) {
  const { t } = useTranslation()
  const { user } = useAuthContext()
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})

  // 获取用户邀请码
  useEffect(() => {
    if (open && user?.id) {
      const fetchReferralCode = async () => {
        try {
          const code = await referralService.getUserReferralCode(user.id)
          setReferralCode(code)
        } catch (error) {
          console.error('Failed to get referral code:', error)
          toast.error(t('shareModal.getReferralCodeFailed'))
        }
      }
      
      fetchReferralCode()
    }
  }, [open, user?.id])

  // 生成邀请链接
  const inviteUrl = referralCode ? referralService.generateInviteLink(referralCode) : ''
  
  // 生成融合内容
  const fusionContent = referralCode ? 
    t('shareModal.shareContentText', { 
      videoUrl: video.video_url,
      inviteUrl: inviteUrl
    }) : ''

  // 复制到剪贴板
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates(prev => ({ ...prev, [type]: true }))
      toast.success(t('shareModal.copiedToClipboard'))
      
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [type]: false }))
      }, 2000)
    } catch (error) {
      toast.error('Failed to copy')
    }
  }

  // 分享到平台
  const shareToPlatform = (platform: string) => {
    const encodedText = encodeURIComponent(fusionContent)
    
    let shareUrl = ''
    
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?quote=${encodedText}`
        break
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedText}`
        break
      case 'instagram':
        copyToClipboard(fusionContent, 'instagram')
        toast.success(t('shareModal.instagramCopied'), {
          duration: 5000
        })
        return
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank')
      toast.success(t('shareModal.platformOpened', { platform }))
    }
  }

  if (!user) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-fit">
        <AlertDialogHeader>
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-blue-600" />
              {t('shareModal.title')}
            </AlertDialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <AlertDialogDescription>
            {t('shareModal.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* 分享内容复制 */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="p-2 bg-muted rounded-md text-xs sm:text-sm max-h-24 overflow-y-auto whitespace-pre-line border text-foreground leading-snug">
                  {fusionContent}
                </div>
                <Button
                  onClick={() => copyToClipboard(fusionContent, 'complete')}
                  variant="outline"
                  size="sm"
                  className="w-full h-9"
                >
                  {copiedStates.complete ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                      {t('shareModal.copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      {t('shareModal.copyShareContent')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 社交媒体分享按钮 */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => shareToPlatform('twitter')}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 h-9"
                >
                  <span className="text-blue-500">𝕏</span>
                  X (Twitter)
                </Button>
                <Button
                  onClick={() => shareToPlatform('facebook')}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 h-9"
                >
                  <span className="text-blue-700 dark:text-blue-400">👥</span>
                  Facebook
                </Button>
                <Button
                  onClick={() => shareToPlatform('whatsapp')}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-green-50 dark:hover:bg-green-950 h-9"
                >
                  <span className="text-green-600 dark:text-green-400">📱</span>
                  WhatsApp
                </Button>
                <Button
                  onClick={() => shareToPlatform('instagram')}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-950 h-9"
                >
                  <span className="text-purple-600 dark:text-purple-400">📸</span>
                  Instagram
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 积分奖励说明 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-4 w-4" />
                {t('shareModal.shareRewards')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span>{t('shareModal.showCreation')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{t('shareModal.inviteFriends')}</span>
                </div>
              </div>
              <div className="mt-2 p-2 bg-muted rounded text-xs">
                {t('shareModal.rewardNote')}
              </div>
            </CardContent>
          </Card>

        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}