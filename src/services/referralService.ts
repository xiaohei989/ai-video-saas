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
   * 创建邀请（增强版，包含速率限制检查）
   */
  async createInvitation(
    inviterId: string, 
    inviteeEmail?: string,
    rewardCredits: number = this.DEFAULT_REWARD
  ): Promise<{ success: boolean; invitationCode?: string; error?: string }> {
    try {
      // 检查邀请速率限制
      const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc('check_invitation_rate_limit', {
        p_user_id: inviterId
      })

      if (rateLimitError) {
        console.error('Error checking invitation rate limit:', rateLimitError)
        return { success: false, error: '检查邀请限制失败' }
      }

      if (rateLimitCheck && rateLimitCheck.length > 0) {
        const limitResult = rateLimitCheck[0]
        if (!limitResult.can_invite) {
          return { success: false, error: limitResult.reason }
        }
      }

      // 验证邀请者邮箱（如果提供）
      if (inviteeEmail) {
        const emailValidation = await validateEmailAsync(inviteeEmail)
        if (!emailValidation.isValid) {
          return { success: false, error: emailValidation.error }
        }
      }

      const invitationCode = this.generateInvitationCode()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + this.INVITATION_EXPIRY_DAYS)

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          inviter_id: inviterId,
          invitation_code: invitationCode,
          invitee_email: inviteeEmail,
          reward_credits: rewardCredits,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating invitation:', error)
        return { success: false, error: error.message }
      }

      // 更新邀请速率限制记录
      try {
        const currentIP = await getClientIPAddress()
        await supabase
          .from('invitation_rate_limits')
          .upsert({
            user_id: inviterId,
            ip_address: currentIP,
            invitations_created: 1,
            last_invitation_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,created_at',
            ignoreDuplicates: false
          })
      } catch (rateLimitUpdateError) {
        console.warn('Failed to update invitation rate limit:', rateLimitUpdateError)
      }

      return { success: true, invitationCode }
    } catch (error) {
      console.error('Error in createInvitation:', error)
      return { success: false, error: '创建邀请失败' }
    }
  }

  /**
   * 接受邀请（增强版，包含防刷检测）
   */
  async acceptInvitation(
    invitationCode: string, 
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

      // 使用增强版的邀请接受函数（新版本，避免函数名冲突）
      const { data: result, error: processError } = await supabase.rpc('accept_invitation_secure', {
        invitation_code: invitationCode,
        invitee_id: inviteeId,
        invitee_email: inviteeEmail,
        ip_addr: ipAddress || null,
        device_data: deviceFingerprint ? JSON.stringify(deviceFingerprint) : null
      })

      if (processError) {
        console.error('Error processing invitation:', processError)
        
        // 根据错误信息返回更友好的错误提示
        const errorMsg = processError.message || ''
        
        if (errorMsg.includes('临时邮箱') || errorMsg.includes('Temporary email')) {
          return { success: false, error: '不允许使用临时邮箱地址' }
        } else if (errorMsg.includes('maximum invitation limit') || errorMsg.includes('邀请限制')) {
          return { success: false, error: '邀请者已达到最大邀请限制' }
        } else if (errorMsg.includes('Too many registrations') || errorMsg.includes('注册次数过多')) {
          return { success: false, error: '该IP地址24小时内注册次数过多' }
        } else if (errorMsg.includes('Cannot use own invitation') || errorMsg.includes('不能使用自己')) {
          return { success: false, error: '不能使用自己的邀请码' }
        } else if (errorMsg.includes('already has a referrer') || errorMsg.includes('已经使用过')) {
          return { success: false, error: '您已经使用过邀请码了' }
        } else if (errorMsg.includes('Invalid or expired') || errorMsg.includes('无效或已过期')) {
          return { success: false, error: '邀请码无效或已过期' }
        } else if (errorMsg.includes('设备') || errorMsg.includes('device')) {
          return { success: false, error: '该设备注册次数过多，请稍后再试' }
        } else {
          return { success: false, error: '处理邀请失败：' + errorMsg }
        }
      }

      // 处理新的JSONB返回格式
      if (result) {
        return { 
          success: result.success, 
          reward: result.reward_credits || 20,
          error: result.success ? undefined : result.error
        }
      }

      return { success: true, reward: 20 }
    } catch (error) {
      console.error('Error in acceptInvitation:', error)
      return { success: false, error: '接受邀请失败' }
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
   * 获取用户邀请列表
   */
  async getUserInvitations(userId: string): Promise<Invitation[]> {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select(`
          *,
          invitee:profiles!invitations_invitee_id_fkey(username, email, avatar_url)
        `)
        .eq('inviter_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching invitations:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getUserInvitations:', error)
      return []
    }
  }

  /**
   * 获取邀请统计
   */
  async getReferralStats(userId: string): Promise<ReferralStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_referral_stats', {
        p_user_id: userId
      })

      if (error) {
        console.error('Error fetching referral stats:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getReferralStats:', error)
      return null
    }
  }

  /**
   * 验证邀请码
   */
  async validateInvitationCode(invitationCode: string): Promise<{
    valid: boolean
    invitation?: Invitation
    error?: string
  }> {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select(`
          *,
          inviter:profiles!invitations_inviter_id_fkey(username, avatar_url)
        `)
        .eq('invitation_code', invitationCode)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { valid: false, error: '邀请码不存在' }
        }
        return { valid: false, error: '验证邀请码失败' }
      }

      // 检查邀请状态
      if (data.status !== 'pending') {
        return { valid: false, error: '邀请码已被使用' }
      }

      // 检查是否过期
      if (new Date(data.expires_at) < new Date()) {
        return { valid: false, error: '邀请码已过期' }
      }

      return { valid: true, invitation: data }
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