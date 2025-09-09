import React, { useState, useEffect, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  MessageCircle, 
  HelpCircle, 
  ChevronDown, 
  ChevronRight,
  Send,
  FileText,
  Clock,
  User,
  AlertCircle,
  Loader2,
  ExternalLink,
  X
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'
import { toast } from 'sonner'
import { AuthContext } from '@/contexts/AuthContext'
import supportService, { SupportTicket, TicketDetails } from '@/services/supportService'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import stripeService from '@/services/stripeService'
import { useSEO } from '@/hooks/useSEO'

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  helpful?: number
}

// 从i18n获取FAQ数据
const getFAQData = (t: any): FAQ[] => {
  const questions = t('helpCenter.faq.questions', { returnObjects: true }) as FAQ[]
  return Array.isArray(questions) ? questions : []
}

export default function HelpCenterPage() {
  const { t } = useTranslation()
  const { user } = useContext(AuthContext)
  const [searchQuery, setSearchQuery] = useState('')

  // SEO优化
  useSEO('help')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)
  
  // Ticket表单状态
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    category: '',
    priority: 'medium',
    description: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  
  // Tickets列表状态
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<TicketDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  
  // 查询用户订阅状态
  const { data: subscription } = useQuery({
    queryKey: ['user-subscription', user?.id],
    queryFn: () => user?.id ? stripeService.getUserSubscription(user.id) : null,
    enabled: !!user?.id
  })
  
  // 检查用户是否为付费用户
  const isPaidUser = subscription && subscription.plan && subscription.status === 'active'

  // 获取FAQ数据并过滤
  const faqData = getFAQData(t)
  const filteredFAQs = faqData.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // 表单验证
  const validateForm = () => {
    const errors: Record<string, string> = {}
    
    if (!ticketForm.subject.trim()) {
      errors.subject = t('helpCenter.support.validation.subjectRequired')
    } else if (ticketForm.subject.length < 5) {
      errors.subject = t('helpCenter.support.validation.subjectTooShort')
    }
    
    if (!ticketForm.category) {
      errors.category = t('helpCenter.support.validation.categoryRequired')
    }
    
    if (!ticketForm.description.trim()) {
      errors.description = t('helpCenter.support.validation.descriptionRequired')
    } else if (ticketForm.description.length < 10) {
      errors.description = t('helpCenter.support.validation.descriptionTooShort')
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // 加载用户tickets
  const loadUserTickets = async () => {
    if (!user) return
    
    setLoadingTickets(true)
    try {
      const result = await supportService.getUserTickets()
      setTickets(result.tickets)
    } catch (error) {
      console.error('Failed to load tickets:', error)
      toast.error(t('helpCenter.common.error'))
    } finally {
      setLoadingTickets(false)
    }
  }

  // 加载ticket详情
  const loadTicketDetails = async (ticketId: string) => {
    console.log('Loading ticket details for:', ticketId)
    setLoadingDetails(true)
    try {
      const details = await supportService.getTicketDetails(ticketId)
      console.log('Loaded ticket details:', details)
      setSelectedTicket(details)
    } catch (error) {
      console.error('Failed to load ticket details:', error)
      toast.error(t('helpCenter.common.error'))
    } finally {
      setLoadingDetails(false)
    }
  }

  // 提交ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast.error(t('helpCenter.common.loginRequired'))
      return
    }
    
    if (!validateForm()) return
    
    setIsSubmitting(true)
    
    try {
      await supportService.createTicket({
        subject: ticketForm.subject,
        category: ticketForm.category,
        priority: ticketForm.priority,
        description: ticketForm.description
      })
      
      // 重置表单
      setTicketForm({
        subject: '',
        category: '',
        priority: 'medium',
        description: ''
      })
      setFormErrors({})
      
      // 刷新tickets列表
      loadUserTickets()
      
      toast.success(t('helpCenter.support.form.submitSuccess'))
    } catch (error) {
      console.error('Submit ticket error:', error)
      toast.error(t('helpCenter.support.form.submitError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // 回复ticket
  const handleReplyTicket = async () => {
    if (!selectedTicket || !replyContent.trim()) {
      console.log('Reply validation failed:', { selectedTicket: !!selectedTicket, replyContent: replyContent.trim() })
      return
    }
    
    console.log('Attempting to reply to ticket:', selectedTicket.id, 'with content:', replyContent)
    
    setIsReplying(true)
    try {
      await supportService.replyToTicket(selectedTicket.id, replyContent)
      setReplyContent('')
      
      // 重新加载ticket详情
      await loadTicketDetails(selectedTicket.id)
      
      toast.success(t('helpCenter.tickets.reply.success'))
    } catch (error) {
      console.error('Reply error:', error)
      toast.error(t('helpCenter.tickets.reply.error'))
    } finally {
      setIsReplying(false)
    }
  }

  // 组件挂载时加载tickets
  useEffect(() => {
    if (user) {
      loadUserTickets()
    }
  }, [user])

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('helpCenter.title')}</h1>
        <p className="text-lg text-muted-foreground">{t('helpCenter.subtitle')}</p>
      </div>

      {/* 主要内容标签页 */}
      <Tabs defaultValue="faq" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="faq" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t('helpCenter.navigation.faq')}
          </TabsTrigger>
          <TabsTrigger value="support" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {t('helpCenter.navigation.support')}
          </TabsTrigger>
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('helpCenter.navigation.myTickets')}
          </TabsTrigger>
        </TabsList>

        {/* FAQ标签页 */}
        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('helpCenter.faq.title')}</CardTitle>
              <CardDescription>{t('helpCenter.faq.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 搜索和过滤 */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('helpCenter.faq.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <CustomSelect
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  options={[
                    { value: 'all', label: t('helpCenter.faq.categories.all') },
                    { value: 'product', label: t('helpCenter.faq.categories.product') },
                    { value: 'technical', label: t('helpCenter.faq.categories.technical') },
                    { value: 'account', label: t('helpCenter.faq.categories.account') },
                    { value: 'billing', label: t('helpCenter.faq.categories.billing') },
                    { value: 'other', label: t('helpCenter.faq.categories.other') }
                  ]}
                />
              </div>

              {/* FAQ列表 */}
              <div className="space-y-4">
                {filteredFAQs.length > 0 ? (
                  filteredFAQs.map((faq) => (
                    <Card key={faq.id} className="border">
                      <CardHeader 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                      >
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{faq.question}</CardTitle>
                          {expandedFAQ === faq.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </CardHeader>
                      {expandedFAQ === faq.id && (
                        <CardContent>
                          <p className="text-muted-foreground">{faq.answer}</p>
                        </CardContent>
                      )}
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('helpCenter.faq.noResults')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 技术支持标签页 */}
        <TabsContent value="support" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('helpCenter.support.title')}</CardTitle>
              <CardDescription>{t('helpCenter.support.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                // 未登录提示
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t('helpCenter.common.loginRequired')}</h3>
                  <p className="text-muted-foreground mb-4">{t('helpCenter.support.freeUserSupport.loginPromptSupport')}</p>
                  <Link to="/signin">
                    <Button>
                      <User className="mr-2 h-4 w-4" />
                      {t('helpCenter.common.login')}
                    </Button>
                  </Link>
                </div>
              ) : !isPaidUser ? (
                // 免费用户显示邮箱联系方式
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
                    <MessageCircle className="h-12 w-12 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{t('helpCenter.support.freeUserSupport.emailSupportTitle')}</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {t('helpCenter.support.freeUserSupport.emailSupportDescription')}
                  </p>
                  <div className="bg-muted/50 rounded-lg p-6 max-w-md mx-auto">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <MessageCircle className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">{t('helpCenter.support.freeUserSupport.contactEmail')}</span>
                    </div>
                    <div className="text-lg font-mono bg-white dark:bg-gray-800 rounded-md p-3 border">
                      support@veo3video.me
                    </div>
                    <Button 
                      className="w-full mt-4"
                      onClick={() => {
                        window.open('mailto:support@veo3video.me?subject=技术支持咨询&body=请详细描述您遇到的问题...')
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {t('helpCenter.support.freeUserSupport.sendEmail')}
                    </Button>
                  </div>
                  <div className="mt-6 text-sm text-muted-foreground">
                    {t('helpCenter.support.freeUserSupport.upgradePrompt')}
                    <Link to="/pricing" className="text-blue-600 hover:underline ml-1">
                      {t('helpCenter.support.freeUserSupport.upgradeLink')}
                    </Link>
                    {t('helpCenter.support.freeUserSupport.upgradeDescription')}
                  </div>
                </div>
              ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-6">
                {/* 标题 */}
                <div className="space-y-2">
                  <Label htmlFor="subject">{t('helpCenter.support.form.subject')} *</Label>
                  <Input
                    id="subject"
                    value={ticketForm.subject}
                    onChange={(e) => setTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder={t('helpCenter.support.form.subjectPlaceholder')}
                    className={formErrors.subject ? 'border-red-500' : ''}
                  />
                  {formErrors.subject && (
                    <p className="text-sm text-red-600">{formErrors.subject}</p>
                  )}
                </div>

                {/* 问题类型和优先级 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('helpCenter.support.form.category')} *</Label>
                    <CustomSelect
                      value={ticketForm.category}
                      onChange={(value) => setTicketForm(prev => ({ ...prev, category: value }))}
                      options={[
                        { value: '', label: t('helpCenter.support.form.pleaseSelect') },
                        { value: 'product', label: t('helpCenter.support.form.categories.product') },
                        { value: 'sales', label: t('helpCenter.support.form.categories.sales') },
                        { value: 'technical', label: t('helpCenter.support.form.categories.technical') },
                        { value: 'account', label: t('helpCenter.support.form.categories.account') },
                        { value: 'billing', label: t('helpCenter.support.form.categories.billing') },
                        { value: 'other', label: t('helpCenter.support.form.categories.other') }
                      ]}
                    />
                    {formErrors.category && (
                      <p className="text-sm text-red-600">{formErrors.category}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('helpCenter.support.form.priority')}</Label>
                    <CustomSelect
                      value={ticketForm.priority}
                      onChange={(value) => setTicketForm(prev => ({ ...prev, priority: value }))}
                      options={[
                        { value: 'low', label: t('helpCenter.support.form.priorities.low') },
                        { value: 'medium', label: t('helpCenter.support.form.priorities.medium') },
                        { value: 'high', label: t('helpCenter.support.form.priorities.high') },
                        { value: 'urgent', label: t('helpCenter.support.form.priorities.urgent') }
                      ]}
                    />
                  </div>
                </div>

                {/* 详细描述 */}
                <div className="space-y-2">
                  <Label htmlFor="description">{t('helpCenter.support.form.description')} *</Label>
                  <textarea
                    id="description"
                    value={ticketForm.description}
                    onChange={(e) => setTicketForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('helpCenter.support.form.descriptionPlaceholder')}
                    rows={6}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none ${
                      formErrors.description ? 'border-red-500' : 'border-input'
                    }`}
                  />
                  {formErrors.description && (
                    <p className="text-sm text-red-600">{formErrors.description}</p>
                  )}
                </div>

                {/* 提交按钮 */}
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      {t('helpCenter.support.form.submitting')}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {t('helpCenter.support.form.submit')}
                    </>
                  )}
                </Button>
              </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 我的工单标签页 */}
        <TabsContent value="tickets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('helpCenter.tickets.title')}</CardTitle>
              <CardDescription>{t('helpCenter.tickets.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                // 未登录提示
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t('helpCenter.common.loginRequired')}</h3>
                  <p className="text-muted-foreground mb-4">{t('helpCenter.common.pleaseLoginToViewTickets')}</p>
                  <Link to="/signin">
                    <Button>
                      <User className="mr-2 h-4 w-4" />
                      {t('helpCenter.common.login')}
                    </Button>
                  </Link>
                </div>
              ) : !isPaidUser ? (
                // 免费用户提示
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-6">
                    <MessageCircle className="h-12 w-12 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{t('helpCenter.support.freeUserSupport.ticketSystemTitle')}</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {t('helpCenter.support.freeUserSupport.ticketSystemDescription')}
                  </p>
                  <div className="bg-muted/50 rounded-lg p-6 max-w-md mx-auto mb-6">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <MessageCircle className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">{t('helpCenter.support.freeUserSupport.freeUserContactPrompt')}</span>
                    </div>
                    <div className="text-lg font-mono bg-white dark:bg-gray-800 rounded-md p-3 border">
                      support@veo3video.me
                    </div>
                    <Button 
                      className="w-full mt-4"
                      onClick={() => {
                        window.open('mailto:support@veo3video.me?subject=技术支持咨询&body=请详细描述您遇到的问题...')
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {t('helpCenter.support.freeUserSupport.sendEmail')}
                    </Button>
                  </div>
                  <Link to="/pricing">
                    <Button variant="outline">
                      {t('helpCenter.support.freeUserSupport.upgradeToPaid')}
                    </Button>
                  </Link>
                </div>
              ) : loadingTickets ? (
                // 加载状态
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">{t('helpCenter.common.loading')}</span>
                </div>
              ) : tickets.length === 0 ? (
                // 空状态 - 没有工单
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t('helpCenter.tickets.noTickets')}</h3>
                  <p className="text-muted-foreground mb-4">{t('helpCenter.tickets.noTicketsDescription')}</p>
                  <Button onClick={() => {
                    // 切换到support标签页
                    const supportTab = document.querySelector('[value="support"]') as HTMLElement
                    supportTab?.click()
                  }}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {t('helpCenter.tickets.createFirst')}
                  </Button>
                </div>
              ) : (
                // 工单列表
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{t('helpCenter.tickets.details.ticketNumber')}: {ticket.ticket_number}</span>
                              <span>•</span>
                              <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={supportService.getStatusColor(ticket.status)}>
                              {t(`helpCenter.tickets.status.${ticket.status}`)}
                            </Badge>
                            <Badge variant="outline" className={supportService.getPriorityColor(ticket.priority)}>
                              {t(`helpCenter.tickets.priority.${ticket.priority}`)}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">{t(`helpCenter.support.form.categories.${supportService.mapCategoryFromDb(ticket.category)}`)}</span>
                            {ticket.assigned_admin && (
                              <>
                                <span className="mx-2">•</span>
                                <span>{t('helpCenter.tickets.details.assignedTo')}: {ticket.assigned_admin.full_name || ticket.assigned_admin.username}</span>
                              </>
                            )}
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              console.log('View details button clicked for ticket:', ticket.id)
                              loadTicketDetails(ticket.id)
                            }}
                          >
                            {t('helpCenter.tickets.actions.view')}
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Ticket详情模态框/侧边栏 */}
          {selectedTicket && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedTicket.subject}</CardTitle>
                    <CardDescription>
                      {t('helpCenter.tickets.details.ticketNumber')}: {selectedTicket.ticket_number}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedTicket(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* 消息列表 */}
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {selectedTicket.messages?.map((message) => (
                        <div key={message.id} className="flex gap-3">
                          <div className="flex-shrink-0">
                            {message.sender?.avatar_url ? (
                              <img 
                                src={message.sender.avatar_url} 
                                alt={message.sender.username || ''} 
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">
                                {message.sender?.full_name || message.sender?.username || 'Unknown'}
                              </span>
                              {message.sender?.role === 'admin' && (
                                <Badge variant="secondary" className="text-xs">{t('helpCenter.common.customerService')}</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(message.created_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-sm bg-muted/50 rounded-lg p-3">
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* 回复区域 */}
                    {selectedTicket.status !== 'closed' && (
                      <div className="border-t pt-4">
                        <div className="space-y-3">
                          <Label htmlFor="reply">{t('helpCenter.tickets.actions.reply')}</Label>
                          <textarea
                            id="reply"
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder={t('helpCenter.tickets.reply.placeholder')}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                          />
                          <Button 
                            onClick={handleReplyTicket}
                            disabled={!replyContent.trim() || isReplying}
                            size="sm"
                          >
                            {isReplying ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                {t('helpCenter.common.sending')}
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-3 w-3" />
                                {t('helpCenter.tickets.reply.submit')}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}