import { useCallback, useContext, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import analyticsService, { 
  AnalyticsEvent, 
  VideoGenerationEvent, 
  PurchaseEvent,
  UserProperties 
} from '@/services/analyticsService'
import { AuthContext } from '@/contexts/AuthContext'

export const useAnalytics = () => {
  const authContext = useContext(AuthContext)
  const user = authContext?.user
  const profile = authContext?.profile
  const location = useLocation()

  // 自动跟踪页面浏览
  useEffect(() => {
    analyticsService.trackPageView(location.pathname, document.title, {
      user_authenticated: !!user,
      user_tier: 'free' // TODO: 需要从订阅服务获取
    })
  }, [location.pathname, user])

  // 设置用户属性
  useEffect(() => {
    if (user && analyticsService.hasConsent()) {
      const getCreditsBalanceRange = (credits: number): string => {
        if (credits === 0) return 'zero'
        if (credits < 50) return 'low'
        if (credits < 200) return 'medium' 
        if (credits < 500) return 'high'
        return 'very_high'
      }

      const userProperties: UserProperties = {
        user_id: user.id,
        subscription_tier: 'free', // TODO: 需要从订阅服务获取
        credits_balance_range: getCreditsBalanceRange(profile?.credits || 0),
        language: profile?.language || 'en',
        registration_method: 'email' // TODO: 需要从用户配置获取
      }

      analyticsService.setUserProperties(userProperties)
    }
  }, [user, profile])

  // 通用事件跟踪
  const trackEvent = useCallback((event: AnalyticsEvent) => {
    analyticsService.trackEvent(event)
  }, [])

  // 用户认证事件
  const trackSignUp = useCallback((method: 'google' | 'apple' | 'email') => {
    if (user) {
      analyticsService.trackSignUp(method, user.id)
    }
  }, [user])

  const trackLogin = useCallback((method: 'google' | 'apple' | 'email') => {
    if (user) {
      analyticsService.trackLogin(method, user.id)
    }
  }, [user])

  // 视频生成事件
  const trackVideoGeneration = useCallback((data: VideoGenerationEvent) => {
    analyticsService.trackVideoGeneration(data)
  }, [])

  // 模板互动事件
  const trackTemplateView = useCallback((templateId: string, category?: string) => {
    analyticsService.trackTemplateInteraction('view', templateId, category)
  }, [])

  const trackTemplateLike = useCallback((templateId: string, category?: string) => {
    analyticsService.trackTemplateInteraction('like', templateId, category)
  }, [])

  const trackTemplateUse = useCallback((templateId: string, category?: string) => {
    analyticsService.trackTemplateInteraction('use', templateId, category)
  }, [])

  // 购买和订阅事件
  const trackPurchase = useCallback((purchaseData: PurchaseEvent) => {
    analyticsService.trackPurchase(purchaseData)
  }, [])

  const trackSubscriptionStart = useCallback((planId: string, value: number) => {
    analyticsService.trackBeginCheckout(planId, value)
  }, [])

  const trackSubscriptionSuccess = useCallback((planId: string, value: number, transactionId: string) => {
    // 跟踪购买完成
    analyticsService.trackPurchase({
      transaction_id: transactionId,
      value: value,
      currency: 'USD',
      items: [{
        item_id: planId,
        item_name: `${planId.toUpperCase()} Subscription`,
        item_category: 'subscription',
        price: value,
        quantity: 1
      }]
    })

    // 跟踪转化
    analyticsService.trackConversion('subscription_purchase', value)
  }, [])

  // 积分相关事件
  const trackCreditsPurchase = useCallback((credits: number, amount: number, transactionId: string) => {
    analyticsService.trackPurchase({
      transaction_id: transactionId,
      value: amount,
      currency: 'USD',
      items: [{
        item_id: `credits_${credits}`,
        item_name: `${credits} Credits`,
        item_category: 'credits',
        price: amount,
        quantity: 1
      }]
    })
  }, [])

  const trackCreditsConsume = useCallback((credits: number, templateId: string, purpose: string) => {
    trackEvent({
      action: 'credits_consumed',
      category: 'product_usage',
      label: purpose,
      value: credits,
      custom_parameters: {
        credits_amount: credits,
        template_id: templateId,
        consumption_purpose: purpose
      }
    })
  }, [trackEvent])

  // 功能使用事件
  const trackFeatureUsage = useCallback((feature: string, action: string, additionalData?: Record<string, any>) => {
    analyticsService.trackFeatureUsage(feature, action, additionalData)
  }, [])

  // 视频下载和分享
  const trackVideoDownload = useCallback((videoId: string, templateId: string) => {
    trackEvent({
      action: 'video_download',
      category: 'product_usage',
      label: templateId,
      custom_parameters: {
        video_id: videoId,
        template_id: templateId
      }
    })
  }, [trackEvent])

  const trackVideoShare = useCallback((videoId: string, platform: string) => {
    trackEvent({
      action: 'video_share',
      category: 'social',
      label: platform,
      custom_parameters: {
        video_id: videoId,
        share_platform: platform
      }
    })
  }, [trackEvent])

  // 搜索和筛选
  const trackSearch = useCallback((query: string, resultCount: number) => {
    trackEvent({
      action: 'search',
      category: 'product_usage',
      label: query,
      value: resultCount,
      custom_parameters: {
        search_term: query,
        result_count: resultCount
      }
    })
  }, [trackEvent])

  const trackFilter = useCallback((filterType: string, filterValue: string) => {
    trackEvent({
      action: 'filter_applied',
      category: 'product_usage',
      label: filterType,
      custom_parameters: {
        filter_type: filterType,
        filter_value: filterValue
      }
    })
  }, [trackEvent])

  // 错误跟踪
  const trackError = useCallback((errorType: string, errorMessage: string, context?: string) => {
    analyticsService.trackError(errorType, errorMessage, context)
  }, [])

  // 性能跟踪
  const trackTiming = useCallback((name: string, duration: number, category = 'performance') => {
    analyticsService.trackTiming(name, duration, category)
  }, [])

  // 语言和主题切换
  const trackLanguageChange = useCallback((newLanguage: string, oldLanguage?: string) => {
    trackFeatureUsage('language', 'change', {
      new_language: newLanguage,
      old_language: oldLanguage
    })
  }, [trackFeatureUsage])

  const trackThemeChange = useCallback((newTheme: 'light' | 'dark') => {
    trackFeatureUsage('theme', 'change', {
      new_theme: newTheme
    })
  }, [trackFeatureUsage])

  return {
    // 基础跟踪
    trackEvent,
    trackPageView: (path: string, title?: string) => analyticsService.trackPageView(path, title),
    
    // 用户认证
    trackSignUp,
    trackLogin,
    
    // 产品使用
    trackVideoGeneration,
    trackTemplateView,
    trackTemplateLike, 
    trackTemplateUse,
    trackVideoDownload,
    trackVideoShare,
    
    // 电商跟踪
    trackPurchase,
    trackSubscriptionStart,
    trackSubscriptionSuccess,
    trackCreditsPurchase,
    trackCreditsConsume,
    
    // 搜索和筛选
    trackSearch,
    trackFilter,
    
    // 功能使用
    trackFeatureUsage,
    trackLanguageChange,
    trackThemeChange,
    
    // 系统监控
    trackError,
    trackTiming,
    
    // 工具方法
    hasConsent: () => analyticsService.hasConsent(),
    debug: () => analyticsService.debug()
  }
}