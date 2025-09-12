import ReactGA from 'react-ga4'

export interface AnalyticsEvent {
  action: string
  category: string
  label?: string
  value?: number
  custom_parameters?: Record<string, any>
}

export interface UserProperties {
  user_id?: string
  subscription_tier?: string
  credits_balance_range?: string
  language?: string
  registration_method?: string
  api_provider_preference?: string
}

export interface VideoGenerationEvent {
  template_id: string
  template_category: string
  video_quality: 'fast' | 'high'
  aspect_ratio: '16:9' | '9:16'
  api_provider: 'qingyun' | 'apicore'
  credits_used: number
  generation_duration?: number
  success: boolean
  error_type?: string
}

export interface PurchaseEvent {
  transaction_id: string
  value: number
  currency: string
  items: Array<{
    item_id: string
    item_name: string
    item_category: string
    price: number
    quantity: number
  }>
}

class AnalyticsService {
  private isInitialized = false
  private measurementId: string | null = null
  private consentGiven = false

  constructor() {
    this.measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID
    this.loadConsentFromStorage()
  }

  private loadConsentFromStorage() {
    try {
      const consent = localStorage.getItem('ga_consent_given')
      this.consentGiven = consent === 'true'
    } catch {
      this.consentGiven = false
    }
  }

  private saveConsentToStorage(consent: boolean) {
    try {
      localStorage.setItem('ga_consent_given', consent.toString())
      this.consentGiven = consent
    } catch (error) {
      console.warn('无法保存Analytics同意状态:', error)
    }
  }

  /**
   * 初始化Google Analytics
   */
  initialize(measurementId?: string) {
    if (this.isInitialized) return

    // 仅在本地开发时跳过GA初始化，生产环境正常加载
    if (import.meta.env.DEV && window.location.hostname === 'localhost') {
      console.log('[Analytics] 本地开发环境，跳过Google Analytics初始化')
      this.isInitialized = true
      return
    }

    const id = measurementId || this.measurementId
    if (!id) {
      console.warn('Google Analytics Measurement ID未配置')
      return
    }

    try {
      ReactGA.initialize(id, {
        testMode: import.meta.env.NODE_ENV === 'development',
        gaOptions: {
          storage: 'none', // 默认不存储，等待用户同意
          anonymize_ip: true,
        }
      })

      // 如果用户已同意，启用存储
      if (this.consentGiven) {
        this.enableTracking()
      }

      this.isInitialized = true
    } catch (error) {
      console.error('Google Analytics初始化失败:', error)
    }
  }

  /**
   * 用户同意跟踪
   */
  grantConsent() {
    this.saveConsentToStorage(true)
    this.enableTracking()
    
    // 发送同意事件
    this.trackEvent({
      action: 'consent_granted',
      category: 'privacy'
    })
  }

  /**
   * 用户拒绝跟踪
   */
  denyConsent() {
    this.saveConsentToStorage(false)
    this.disableTracking()
  }

  /**
   * 启用跟踪
   */
  private enableTracking() {
    if (!this.isInitialized) return

    try {
      // 启用GA4数据收集
      ReactGA.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied', // 我们不使用广告
        functionality_storage: 'granted',
        personalization_storage: 'granted'
      })
    } catch (error) {
      console.error('启用Analytics跟踪失败:', error)
    }
  }

  /**
   * 禁用跟踪
   */
  private disableTracking() {
    try {
      ReactGA.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        functionality_storage: 'denied',
        personalization_storage: 'denied'
      })
    } catch (error) {
      console.error('禁用Analytics跟踪失败:', error)
    }
  }

  /**
   * 检查是否有跟踪权限
   */
  hasConsent(): boolean {
    return this.consentGiven && this.isInitialized
  }

  /**
   * 设置用户属性
   */
  setUserProperties(properties: UserProperties) {
    if (!this.hasConsent()) return

    try {
      ReactGA.gtag('config', this.measurementId!, {
        user_id: properties.user_id,
        custom_map: {
          subscription_tier: properties.subscription_tier,
          credits_balance_range: properties.credits_balance_range,
          language: properties.language,
          registration_method: properties.registration_method,
          api_provider_preference: properties.api_provider_preference
        }
      })
    } catch (error) {
      console.error('设置用户属性失败:', error)
    }
  }

  /**
   * 跟踪页面浏览
   */
  trackPageView(path: string, title?: string, additionalData?: Record<string, any>) {
    if (!this.hasConsent()) return

    try {
      ReactGA.send({
        hitType: 'pageview',
        page: path,
        title: title,
        ...additionalData
      })
    } catch (error) {
      console.error('跟踪页面浏览失败:', error)
    }
  }

  /**
   * 跟踪自定义事件
   */
  trackEvent(event: AnalyticsEvent) {
    if (!this.hasConsent()) return

    try {
      ReactGA.event(event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        ...event.custom_parameters
      })
    } catch (error) {
      console.error('跟踪事件失败:', error)
    }
  }

  /**
   * 跟踪用户注册
   */
  trackSignUp(method: 'google' | 'apple' | 'email', userId: string) {
    this.trackEvent({
      action: 'sign_up',
      category: 'user_engagement',
      label: method,
      custom_parameters: {
        method,
        user_id: userId
      }
    })
  }

  /**
   * 跟踪用户登录
   */
  trackLogin(method: 'google' | 'apple' | 'email', userId: string) {
    this.trackEvent({
      action: 'login',
      category: 'user_engagement',
      label: method,
      custom_parameters: {
        method,
        user_id: userId
      }
    })
  }

  /**
   * 跟踪视频生成事件
   */
  trackVideoGeneration(data: VideoGenerationEvent) {
    // 生成开始事件
    this.trackEvent({
      action: 'video_generation_start',
      category: 'product_usage',
      label: data.template_id,
      value: data.credits_used,
      custom_parameters: {
        template_id: data.template_id,
        template_category: data.template_category,
        video_quality: data.video_quality,
        aspect_ratio: data.aspect_ratio,
        api_provider: data.api_provider,
        credits_used: data.credits_used
      }
    })

    // 如果已完成，跟踪完成事件
    if (data.success) {
      this.trackEvent({
        action: 'video_generation_complete',
        category: 'product_usage',
        label: data.template_id,
        value: data.generation_duration,
        custom_parameters: {
          template_id: data.template_id,
          template_category: data.template_category,
          video_quality: data.video_quality,
          aspect_ratio: data.aspect_ratio,
          api_provider: data.api_provider,
          credits_used: data.credits_used,
          generation_duration: data.generation_duration
        }
      })
    } else {
      // 生成失败事件
      this.trackEvent({
        action: 'video_generation_failed',
        category: 'product_usage',
        label: data.template_id,
        custom_parameters: {
          template_id: data.template_id,
          template_category: data.template_category,
          api_provider: data.api_provider,
          error_type: data.error_type
        }
      })
    }
  }

  /**
   * 跟踪购买事件
   */
  trackPurchase(purchaseData: PurchaseEvent) {
    if (!this.hasConsent()) return

    try {
      ReactGA.gtag('event', 'purchase', {
        transaction_id: purchaseData.transaction_id,
        value: purchaseData.value,
        currency: purchaseData.currency,
        items: purchaseData.items
      })
    } catch (error) {
      console.error('跟踪购买事件失败:', error)
    }
  }

  /**
   * 跟踪订阅开始试用
   */
  trackBeginCheckout(planId: string, value: number) {
    this.trackEvent({
      action: 'begin_checkout',
      category: 'ecommerce',
      label: planId,
      value: value,
      custom_parameters: {
        plan_id: planId,
        checkout_step: 1
      }
    })
  }

  /**
   * 跟踪模板互动
   */
  trackTemplateInteraction(action: 'view' | 'like' | 'use', templateId: string, category?: string) {
    this.trackEvent({
      action: `template_${action}`,
      category: 'product_usage',
      label: templateId,
      custom_parameters: {
        template_id: templateId,
        template_category: category,
        interaction_type: action
      }
    })
  }

  /**
   * 跟踪功能使用
   */
  trackFeatureUsage(feature: string, action: string, additionalData?: Record<string, any>) {
    this.trackEvent({
      action: `${feature}_${action}`,
      category: 'feature_usage',
      label: feature,
      custom_parameters: {
        feature_name: feature,
        action_type: action,
        ...additionalData
      }
    })
  }

  /**
   * 跟踪错误事件
   */
  trackError(errorType: string, errorMessage: string, context?: string) {
    this.trackEvent({
      action: 'error_occurred',
      category: 'errors',
      label: errorType,
      custom_parameters: {
        error_type: errorType,
        error_message: errorMessage.substring(0, 100), // 限制长度
        context: context
      }
    })
  }

  /**
   * 跟踪性能指标
   */
  trackTiming(name: string, duration: number, category = 'performance') {
    if (!this.hasConsent()) return

    try {
      ReactGA.gtag('event', 'timing_complete', {
        name: name,
        value: duration,
        event_category: category
      })
    } catch (error) {
      console.error('跟踪性能指标失败:', error)
    }
  }

  /**
   * 跟踪转化事件
   */
  trackConversion(conversionType: string, value?: number) {
    this.trackEvent({
      action: 'conversion',
      category: 'conversions',
      label: conversionType,
      value: value,
      custom_parameters: {
        conversion_type: conversionType
      }
    })
  }

  /**
   * 调试模式 - 仅在开发环境打印事件
   */
  debug() {
    if (import.meta.env.NODE_ENV === 'development') {
      console.log('Analytics Service Debug Info:', {
        initialized: this.isInitialized,
        measurementId: this.measurementId,
        consentGiven: this.consentGiven,
        hasConsent: this.hasConsent()
      })
    }
  }
}

// 导出单例实例
export const analyticsService = new AnalyticsService()
export default analyticsService