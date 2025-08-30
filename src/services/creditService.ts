import { supabase } from '@/lib/supabase'

export interface CreditTransaction {
  id: string
  user_id: string
  type: 'purchase' | 'reward' | 'consume' | 'refund'
  amount: number
  balance_before: number
  balance_after: number
  description: string
  reference_id?: string
  reference_type?: string
  created_at: string
}

export interface UserCredits {
  credits: number
  total_credits_earned: number
  total_credits_spent: number
}

class CreditService {
  /**
   * 获取用户积分余额
   */
  async getUserCredits(userId: string): Promise<UserCredits | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits, total_credits_earned, total_credits_spent')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user credits:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getUserCredits:', error)
      return null
    }
  }

  /**
   * 获取用户积分交易历史
   */
  async getCreditTransactions(
    userId: string, 
    limit: number = 50,
    offset: number = 0
  ): Promise<CreditTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('Error fetching credit transactions:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getCreditTransactions:', error)
      return []
    }
  }

  /**
   * 消费积分（通过Edge Function）
   */
  async consumeCredits(
    userId: string, 
    amount: number, 
    description: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      // 统一通过Edge Function调用
      return await this.consumeCreditsViaEdgeFunction(userId, amount, description, referenceId, referenceType)
    } catch (error) {
      console.error('Error in consumeCredits:', error)
      return { success: false, error: '积分消费失败' }
    }
  }

  /**
   * 通过Edge Function消费积分
   */
  private async consumeCreditsViaEdgeFunction(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/consume-credits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          amount,
          description,
          referenceId,
          referenceType
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[CREDIT SERVICE] Edge Function HTTP error:', response.status, errorData)
        return { success: false, error: errorData.error || 'Edge Function调用失败' }
      }

      const result = await response.json()
      
      if (!result.success) {
        return { success: false, error: result.error || 'Edge Function执行失败' }
      }

      return { success: true, newBalance: result.newBalance }
    } catch (error) {
      console.error('[CREDIT SERVICE] Error calling Edge Function:', error)
      return { success: false, error: '网络请求失败' }
    }
  }

  /**
   * 添加积分（购买、奖励等，通过Edge Function）
   */
  async addCredits(
    userId: string,
    amount: number,
    type: 'purchase' | 'reward' | 'refund',
    description: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      // 统一通过Edge Function调用
      return await this.addCreditsViaEdgeFunction(userId, amount, type, description, referenceId, referenceType)
    } catch (error) {
      console.error('Error in addCredits:', error)
      return { success: false, error: '积分添加失败' }
    }
  }

  /**
   * 通过Edge Function添加积分
   */
  private async addCreditsViaEdgeFunction(
    userId: string,
    amount: number,
    type: 'purchase' | 'reward' | 'refund',
    description: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/add-credits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          amount,
          type,
          description,
          referenceId,
          referenceType
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[CREDIT SERVICE] Edge Function HTTP error:', response.status, errorData)
        return { success: false, error: errorData.error || 'Edge Function调用失败' }
      }

      const result = await response.json()
      
      if (!result.success) {
        return { success: false, error: result.error || 'Edge Function执行失败' }
      }

      return { success: true, newBalance: result.newBalance }
    } catch (error) {
      console.error('[CREDIT SERVICE] Error calling Edge Function:', error)
      return { success: false, error: '网络请求失败' }
    }
  }

  /**
   * 检查用户是否有足够积分
   */
  async hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    try {
      const credits = await this.getUserCredits(userId)
      return credits ? credits.credits >= amount : false
    } catch (error) {
      console.error('Error checking credits:', error)
      return false
    }
  }

  /**
   * 获取积分消费统计
   */
  async getCreditStats(userId: string): Promise<{
    totalEarned: number
    totalSpent: number
    currentBalance: number
    thisMonthSpent: number
  } | null> {
    try {
      // 获取基础统计
      const credits = await this.getUserCredits(userId)
      if (!credits) return null

      // 获取本月消费
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: monthlyTransactions, error } = await supabase
        .from('credit_transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('type', 'consume')
        .gte('created_at', startOfMonth.toISOString())

      if (error) {
        console.error('Error fetching monthly transactions:', error)
      }

      const thisMonthSpent = monthlyTransactions?.reduce(
        (sum, transaction) => sum + Math.abs(transaction.amount), 
        0
      ) || 0

      return {
        totalEarned: credits.total_credits_earned,
        totalSpent: credits.total_credits_spent,
        currentBalance: credits.credits,
        thisMonthSpent
      }
    } catch (error) {
      console.error('Error in getCreditStats:', error)
      return null
    }
  }

  /**
   * 格式化积分数量显示
   */
  formatCredits(amount: number): string {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}k`
    }
    return amount.toString()
  }

  /**
   * 获取积分交易类型的显示文本
   */
  getTransactionTypeText(type: string): string {
    const typeMap: Record<string, string> = {
      'purchase': '购买积分',
      'reward': '奖励获得',
      'consume': '消费扣除',
      'refund': '退款返还'
    }
    return typeMap[type] || type
  }

  /**
   * 获取积分交易类型的颜色类
   */
  getTransactionTypeColor(type: string): string {
    const colorMap: Record<string, string> = {
      'purchase': 'text-green-600',
      'reward': 'text-blue-600', 
      'consume': 'text-red-600',
      'refund': 'text-green-600'
    }
    return colorMap[type] || 'text-gray-600'
  }
}

// 导出单例实例
export const creditService = new CreditService()
export default creditService