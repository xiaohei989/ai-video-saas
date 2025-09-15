import { supabase, secureSupabase } from '@/lib/supabase'
import i18n from '@/i18n/config'
import { validateEmailAsync } from './emailValidator'
import { getClientIPAddress } from '@/utils/deviceFingerprint'

export interface ReferralCode {
  code: string
  user_id: string
  created_at: string
  usage_count: number
  max_usage?: number
}

export interface Invitation {
  id: string
  inviter_id: string
  invitee_id?: string
  invitation_code: string
  status: 'pending' | 'accepted' | 'expired'
  reward_credits: number
  invitee_email?: string
  accepted_at?: string
  expires_at: string
  created_at: string
}

export interface ReferralStats {
  total_invitations: number
  successful_invitations: number
  pending_invitations: number
  total_rewards_earned: number
  success_rate: number
}

class ReferralService {
  private readonly DEFAULT_REWARD = 20
  private readonly INVITATION_EXPIRY_DAYS = 30

  /**
   * 生成邀请码
   */
  generateInvitationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * 获取用户的推荐码
   */
  async getUserReferralCode(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching referral code:', error)
        return null
      }

      return data.referral_code
    } catch (error) {
      console.error('Error in getUserReferralCode:', error)
      return null
    }
  }

  /**
   * 获取邀请链接（简化版本，使用referral_code）
   */
  async createInvitation(
    inviterId: string
  ): Promise<{ success: boolean; invitationCode?: string; error?: string }> {
    try {
      // 直接获取用户的referral_code
      const referralCode = await this.getUserReferralCode(inviterId)
      
      if (!referralCode) {
        return { success: false, error: '获取邀请码失败' }
      }

      return { success: true, invitationCode: referralCode }
    } catch (error) {
      console.error('Error in createInvitation:', error)
      return { success: false, error: '获取邀请码失败' }
    }
  }

  /**
   * 接受邀请码（统一版本，使用referral_code）
   */
  async acceptInvitation(
    referralCode: string, 
    inviteeId: string,
    inviteeEmail: string,
    deviceFingerprint?: any,
    ipAddress?: string
  ): Promise<{ success: boolean; reward?: number; error?: string }> {
    try {
      // 异步验证邮箱格式和临时邮箱检测
      const emailValidation = await validateEmailAsync(inviteeEmail)
      if (!emailValidation.isValid) {
        return { success: false, error: emailValidation.error }
      }

      // 如果没有提供IP地址，尝试获取
      if (!ipAddress) {
        try {
          ipAddress = await getClientIPAddress()
        } catch (error) {
          console.warn('Failed to get IP address for invitation:', error)
        }
      }

      // 使用统一的邀请码接受函数
      const { data: result, error: processError } = await supabase.rpc('accept_referral_code', {
        referral_code: referralCode,
        invitee_id: inviteeId,
        invitee_email: inviteeEmail,
        ip_addr: ipAddress || null,
        device_data: deviceFingerprint ? JSON.stringify(deviceFingerprint) : null
      })

      if (processError) {
        console.error('Error processing referral code:', processError)
        return { success: false, error: processError.message || '处理邀请码时发生错误' }
      }

      // 处理JSONB返回格式
      if (result) {
        if (!result.success) {
          return { success: false, error: result.error }
        }
        
        // 🔧 立即清理缓存并通知前端
        if (result.success) {
          console.log('[REFERRAL] 积分更新成功，开始清理缓存和通知前端')
          
          // 1. 立即清理Edge Function缓存
          this.clearUserCache([inviteeId, result.inviter_id], 'referral_reward').catch(err => {
            console.warn('[REFERRAL] 缓存清理失败，但不影响主流程:', err)
          })
          
          // 2. 触发全局积分变更事件（多个用户）
          const affectedUsers = [
            { userId: inviteeId, newCredits: result.invitee_credits_after },
            { userId: result.inviter_id, newCredits: result.inviter_credits_after }
          ]
          
          affectedUsers.forEach(user => {
            window.dispatchEvent(new CustomEvent('credits-changed', {
              detail: { 
                userId: user.userId,
                newCredits: user.newCredits,
                reason: 'referral_reward',
                timestamp: Date.now()
              }
            }))
          })
          
          console.log('[REFERRAL] 积分变更通知已发送给前端')
        }
        
        return { 
          success: true, 
          reward: result.reward_credits || 20,
          error: undefined
        }
      }

      return { success: false, error: '未知错误' }
    } catch (error) {
      console.error('Error in acceptInvitation:', error)
      return { success: false, error: '处理邀请码时发生错误' }
    }
  }

  /**
   * 检查用户邀请限制
   */
  async checkInvitationLimits(
    userId: string
  ): Promise<{
    canInvite: boolean;
    reason?: string;
    limits: {
      total: number;
      hourly: number;
      daily: number;
      monthly: number;
    };
  }> {
    try {
      const { data, error } = await supabase.rpc('check_invitation_rate_limit', {
        p_user_id: userId
      })

      if (error) {
        console.error('Error checking invitation limits:', error)
        return {
          canInvite: false,
          reason: '检查邀请限制失败',
          limits: { total: 0, hourly: 0, daily: 0, monthly: 0 }
        }
      }

      const result = data[0]
      return {
        canInvite: result.can_invite,
        reason: result.reason,
        limits: {
          total: result.total_count,
          hourly: result.hourly_count,
          daily: result.daily_count,
          monthly: result.monthly_count
        }
      }
    } catch (error) {
      console.error('Error in checkInvitationLimits:', error)
      return {
        canInvite: false,
        reason: '检查邀请限制失败',
        limits: { total: 0, hourly: 0, daily: 0, monthly: 0 }
      }
    }
  }

  /**
   * 获取用户邀请列表（简化版本，基于referral关系）
   */
  async getUserInvitations(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          email,
          avatar_url,
          created_at,
          credits,
          subscription_status,
          last_login_at
        `)
        .eq('referred_by', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching referred users:', error)
        return []
      }

      // 转换为兼容格式
      return (data || []).map(user => ({
        id: user.id,
        invitee_id: user.id,
        invitee: {
          username: user.username,
          email: user.email,
          avatar_url: user.avatar_url,
          credits: user.credits,
          subscription_status: user.subscription_status,
          last_login_at: user.last_login_at
        },
        status: 'accepted',
        reward_credits: 20,
        accepted_at: user.created_at,
        created_at: user.created_at
      }))
    } catch (error) {
      console.error('Error in getUserInvitations:', error)
      return []
    }
  }

  /**
   * 获取邀请统计（简化版本，基于referral关系）
   */
  async getReferralStats(userId: string): Promise<ReferralStats | null> {
    try {
      // 查询被该用户邀请的用户数量
      const { data: referredUsers, error } = await supabase
        .from('profiles')
        .select('id, created_at')
        .eq('referred_by', userId)

      if (error) {
        console.error('Error fetching referral stats:', error)
        return null
      }

      const totalInvitations = referredUsers?.length || 0
      const successfulInvitations = totalInvitations // 所有referral关系都是成功的
      const totalRewards = successfulInvitations * 20 // 每个邀请20积分

      return {
        total_invitations: totalInvitations,
        successful_invitations: successfulInvitations,
        pending_invitations: 0, // 新系统没有pending状态
        total_rewards_earned: totalRewards,
        success_rate: totalInvitations > 0 ? 100 : 0 // 所有邀请都成功
      }
    } catch (error) {
      console.error('Error in getReferralStats:', error)
      return null
    }
  }

  /**
   * 验证邀请码（统一版本，检查referral_code）
   */
  async validateInvitationCode(referralCode: string): Promise<{
    valid: boolean
    invitation?: any
    error?: string
  }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, email')
        .eq('referral_code', referralCode)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { valid: false, error: '邀请码不存在' }
        }
        return { valid: false, error: '验证邀请码失败' }
      }

      // 返回邀请人信息
      return { 
        valid: true, 
        invitation: {
          inviter_id: data.id,
          inviter: {
            username: data.username,
            avatar_url: data.avatar_url,
            email: data.email
          },
          reward_credits: 20,
          status: 'pending' // 兼容性
        }
      }
    } catch (error) {
      console.error('Error in validateInvitationCode:', error)
      return { valid: false, error: '验证邀请码失败' }
    }
  }

  /**
   * 获取推荐排行榜
   */
  async getReferralLeaderboard(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('get_referral_leaderboard', {
        p_limit: limit
      })

      if (error) {
        console.error('Error fetching referral leaderboard:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getReferralLeaderboard:', error)
      return []
    }
  }

  /**
   * 生成邀请链接
   */
  generateInviteLink(invitationCode: string, baseUrl: string = 'https://veo3video.me'): string {
    return `${baseUrl}/signup?invite=${invitationCode}`
  }

  /**
   * 生成分享文本
   */
  generateShareText(invitationCode: string): string {
    return i18n.t('referral.shareText', { invitationCode })
  }

  /**
   * 分享到社交平台
   */
  shareToSocial(platform: string, invitationCode: string, inviteLink: string): void {
    const shareText = encodeURIComponent(this.generateShareText(invitationCode))
    const shareUrl = encodeURIComponent(inviteLink)
    
    let url = ''
    
    switch (platform.toLowerCase()) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`
        break
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`
        break
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`
        break
      case 'whatsapp':
        url = `https://wa.me/?text=${shareText} ${shareUrl}`
        break
      case 'telegram':
        url = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`
        break
      case 'wechat':
        // 微信需要特殊处理，通常是显示二维码
        this.copyToClipboard(inviteLink)
        return
      default:
        this.copyToClipboard(inviteLink)
        return
    }
    
    window.open(url, '_blank', 'width=600,height=400')
  }

  /**
   * 复制到剪贴板
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }

  /**
   * 清理用户缓存
   */
  private async clearUserCache(userIds: string[], reason: string = 'manual'): Promise<boolean> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
      const clearCacheUrl = `${supabaseUrl}/functions/v1/clear-user-cache`
      
      const { data: session } = await supabase.auth.getSession()
      
      const response = await fetch(clearCacheUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token || ''}`
        },
        body: JSON.stringify({
          user_ids: userIds,
          reason: reason
        })
      })

      const result = await response.json()
      
      if (result.success) {
        console.log(`[REFERRAL] 缓存清理成功，清理了 ${result.cleared_keys?.length || 0} 个缓存键`)
        return true
      } else {
        console.warn('[REFERRAL] 缓存清理失败:', result.error)
        return false
      }
    } catch (error) {
      console.error('[REFERRAL] 清理缓存时发生错误:', error)
      return false
    }
  }

  /**
   * 格式化邀请状态文本
   */
  getInvitationStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '待接受',
      'accepted': '已接受',
      'expired': '已过期'
    }
    return statusMap[status] || status
  }

  /**
   * 获取邀请状态颜色类
   */
  getInvitationStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'pending': 'text-yellow-600 bg-yellow-100',
      'accepted': 'text-green-600 bg-green-100',
      'expired': 'text-gray-600 bg-gray-100'
    }
    return colorMap[status] || 'text-gray-600 bg-gray-100'
  }
}

// 导出单例实例
export const referralService = new ReferralService()
export default referralService