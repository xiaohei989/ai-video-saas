import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { formatFullDate, formatPreciseDateTime } from '@/utils/dateFormat'
import { 
  Users, 
  Share2, 
  Copy, 
  Loader2,
} from 'lucide-react'

// 社交媒体图标组件
const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.484 3.488"/>
  </svg>
)

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAuthContext } from '@/contexts/AuthContext'
import referralService from '@/services/referralService'
import { toast } from 'sonner'

interface ReferralDashboardProps {
  className?: string
}

export function ReferralDashboard({ className = '' }: ReferralDashboardProps) {
  const { user } = useAuthContext()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // 获取推荐码
  const { data: referralCode } = useQuery({
    queryKey: ['referral-code', user?.id],
    queryFn: () => user?.id ? referralService.getUserReferralCode(user.id) : null,
    enabled: !!user?.id
  })

  // 获取邀请列表
  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations', user?.id],
    queryFn: () => user?.id ? referralService.getUserInvitations(user.id) : [],
    enabled: !!user?.id
  })

  // 获取邀请统计
  const { data: stats = null } = useQuery({
    queryKey: ['referral-stats', user?.id],
    queryFn: () => user?.id ? referralService.getReferralStats(user.id) : null,
    enabled: !!user?.id
  })

  console.log('Referral stats:', stats) // 使用stats变量避免未使用警告


  const { t } = useTranslation()

  const handleCopyCode = async (code: string) => {
    const success = await referralService.copyToClipboard(code)
    if (success) {
      setCopiedCode(code)
      toast.success(t('referral.codeCopied'))
      setTimeout(() => setCopiedCode(null), 2000)
    } else {
      toast.error(t('referral.copyFailed'))
    }
  }

  const handleCopyInviteLink = async () => {
    if (!referralCode) return
    
    const inviteLink = referralService.generateInviteLink(referralCode)
    const success = await referralService.copyToClipboard(inviteLink)
    
    if (success) {
      toast.success(t('referral.linkCopied'))
    } else {
      toast.error(t('referral.copyFailed'))
    }
  }

  const handleShareToSocial = (platform: string) => {
    if (!referralCode) return
    
    const inviteLink = referralService.generateInviteLink(referralCode)
    referralService.shareToSocial(platform, referralCode, inviteLink)
  }


  if (!referralCode) {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>{t('referral.loadingInfo')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const inviteLink = referralService.generateInviteLink(referralCode)

  return (
    <div className={`space-y-6 ${className}`}>

      {/* 邀请工具 */}
      <div className="grid gap-6">
        {/* 推荐码分享 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Share2 className="w-5 h-5" />
              <span>{t('referral.shareReferralCode')}</span>
            </CardTitle>
            <CardDescription>
              {t('referral.shareDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                value={referralCode}
                readOnly
                className="font-mono text-center text-lg"
              />
              <Button
                onClick={() => handleCopyCode(referralCode)}
                variant="outline"
                size="sm"
              >
                {copiedCode === referralCode ? (
                  t('referral.copied')
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>

            <div className="flex space-x-2">
              <Input
                value={inviteLink}
                readOnly
                className="text-sm"
              />
              <Button
                onClick={handleCopyInviteLink}
                variant="outline"
                size="sm"
              >
                {t('referral.copyLink')}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => handleShareToSocial('twitter')}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <TwitterIcon className="h-4 w-4" />
                Twitter
              </Button>
              <Button
                onClick={() => handleShareToSocial('facebook')}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <FacebookIcon className="h-4 w-4" />
                Facebook
              </Button>
              <Button
                onClick={() => handleShareToSocial('whatsapp')}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <WhatsAppIcon className="h-4 w-4" />
                WhatsApp
              </Button>
            </div>

            <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg">
              <p className="font-medium mb-1">{t('referral.rewardExplanation')}</p>
              <ul className="space-y-1 text-xs">
                <li>• {t('referral.userReward')}</li>
                <li>• {t('referral.friendReward')}</li>
              </ul>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* 邀请记录 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('referral.invitationHistory')}</CardTitle>
          <CardDescription>
            {t('referral.invitationDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('referral.noInvitations')}</p>
              <p className="text-sm">{t('referral.startInviting')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invitations.slice(0, 5).map((invitation: any) => (
                <div
                  key={invitation.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {invitation.invitee?.avatar_url ? (
                            <img
                              src={invitation.invitee.avatar_url}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <Users className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="font-medium text-gray-900 truncate">
                              {invitation.invitee?.username || invitation.invitee?.email?.split('@')[0] || '未知用户'}
                            </p>
                            <Badge
                              className={`text-xs ${referralService.getInvitationStatusColor(invitation.status)}`}
                            >
                              {t(`referral.status.${invitation.status}`, invitation.status) || invitation.status}
                            </Badge>
                          </div>
                          
                          {/* 详细账户信息 */}
                          <div className="space-y-1 text-sm text-gray-600">
                            {invitation.invitee?.email && (
                              <p className="flex items-center space-x-1 truncate">
                                <span className="text-gray-400">📧</span>
                                <span className="truncate">{invitation.invitee.email}</span>
                              </p>
                            )}
                            
                            {/* 注册时间（精确到小时分钟） */}
                            <p className="flex items-center space-x-1">
                              <span className="text-gray-400">⏰</span>
                              <span>注册于 {formatPreciseDateTime(invitation.created_at)}</span>
                            </p>
                            
                            {/* 订阅状态 */}
                            {invitation.invitee?.subscription_status && (
                              <p className="flex items-center space-x-1">
                                <span className="text-gray-400">💳</span>
                                <span>订阅: {invitation.invitee.subscription_status === 'active' ? '已激活' : '未订阅'}</span>
                              </p>
                            )}
                            
                            {/* 账户创建来源 */}
                            <p className="flex items-center space-x-1">
                              <span className="text-gray-400">🎁</span>
                              <span>通过邀请注册</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-2 ml-3">
                      {invitation.status === 'accepted' && (
                        <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-2 py-1 rounded-md">
                          <span className="text-xs">奖励</span>
                          <span className="font-medium">+{invitation.reward_credits}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {invitations.length > 5 && (
                <Button variant="outline" className="w-full">
                  {t('referral.viewAll', { count: invitations.length })}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ReferralDashboard