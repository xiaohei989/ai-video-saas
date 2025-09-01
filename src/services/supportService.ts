import { supabase } from '@/lib/supabase'

export interface SupportTicket {
  id: string
  ticket_number: string
  subject: string
  category: string
  priority: string
  status: string
  created_at: string
  updated_at: string
  first_response_at?: string
  last_response_at?: string
  assigned_admin?: {
    username: string
    full_name: string
  }
}

export interface TicketMessage {
  id: string
  content: string
  message_type: string
  attachments: any[]
  is_internal: boolean
  is_system_message: boolean
  created_at: string
  sender: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
    role: string
  }
}

export interface TicketDetails extends SupportTicket {
  messages: TicketMessage[]
}

export interface CreateTicketRequest {
  subject: string
  category: string
  priority: string
  description: string
}

export interface TicketListResponse {
  tickets: SupportTicket[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

class SupportService {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-tickets`
  }

  private async makeRequest(data: any) {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      throw new Error('User not authenticated')
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('API Error:', result)
      throw new Error(result.error || `API request failed (${response.status})`)
    }

    return result.data
  }

  // 创建新ticket
  async createTicket(ticketData: CreateTicketRequest): Promise<SupportTicket> {
    return this.makeRequest({
      action: 'create',
      subject: ticketData.subject,
      category: this.mapCategoryToDb(ticketData.category), // 映射到数据库分类
      priority: ticketData.priority,
      description: ticketData.description
    })
  }

  // 获取用户的所有tickets
  async getUserTickets(page = 1, pageSize = 20): Promise<TicketListResponse> {
    return this.makeRequest({
      action: 'list',
      pagination: { page, pageSize }
    })
  }

  // 获取特定ticket的详情和消息
  async getTicketDetails(ticketId: string): Promise<TicketDetails> {
    console.log('Calling getTicketDetails API with ticketId:', ticketId)
    const result = await this.makeRequest({
      action: 'get_details',
      ticketId
    })
    
    // 合并ticket和messages到一个对象
    return {
      ...result.ticket,
      messages: result.messages || []
    }
  }

  // 回复ticket
  async replyToTicket(ticketId: string, content: string): Promise<void> {
    console.log('Calling replyToTicket API with:', { ticketId, content })
    return this.makeRequest({
      action: 'reply',
      ticketId,
      content
    })
  }

  // 获取ticket状态的显示文本
  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'open': '未处理',
      'in_progress': '处理中', 
      'waiting_user': '等待回复',
      'waiting_admin': '等待客服',
      'resolved': '已解决',
      'closed': '已关闭'
    }
    return statusMap[status] || status
  }

  // 获取优先级的显示文本
  getPriorityText(priority: string): string {
    const priorityMap: Record<string, string> = {
      'low': '低',
      'medium': '中',
      'high': '高',
      'urgent': '紧急'
    }
    return priorityMap[priority] || priority
  }

  // 获取分类的显示文本
  getCategoryText(category: string): string {
    const categoryMap: Record<string, string> = {
      'technical': '技术支持',
      'billing': '付费问题',
      'account': '账户问题',
      'feature_request': '功能建议',
      'bug_report': '问题报告',
      'other': '其他'
    }
    return categoryMap[category] || category
  }

  // 将前端分类映射到数据库分类
  mapCategoryToDb(frontendCategory: string): string {
    const categoryMap: Record<string, string> = {
      'product': 'bug_report',      // 产品问题 -> 问题报告
      'sales': 'other',             // 销售咨询 -> 其他
      'technical': 'technical',     // 技术支持 -> 技术支持
      'account': 'account',         // 账户问题 -> 账户问题
      'billing': 'billing',         // 付费问题 -> 付费问题
      'other': 'other'             // 其他 -> 其他
    }
    return categoryMap[frontendCategory] || 'other'
  }

  // 将数据库分类映射回前端显示
  mapCategoryFromDb(dbCategory: string): string {
    const categoryMap: Record<string, string> = {
      'bug_report': 'product',      // 问题报告 -> 产品问题
      'feature_request': 'product', // 功能建议 -> 产品问题
      'technical': 'technical',     // 技术支持 -> 技术支持
      'account': 'account',         // 账户问题 -> 账户问题
      'billing': 'billing',         // 付费问题 -> 付费问题
      'other': 'other'             // 其他 -> 其他
    }
    return categoryMap[dbCategory] || 'other'
  }

  // 获取状态对应的颜色
  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'open': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'in_progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      'waiting_user': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'waiting_admin': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'resolved': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'closed': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
    return colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  // 获取优先级对应的颜色
  getPriorityColor(priority: string): string {
    const colorMap: Record<string, string> = {
      'low': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      'medium': 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
      'high': 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
      'urgent': 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
    }
    return colorMap[priority] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}

export const supportService = new SupportService()
export default supportService