/**
 * 语言切换调试工具
 * 专门用于诊断和监控苹果OAuth登录后语言异常切换的问题
 */

import i18n from '@/i18n/config'

interface LanguageDebugInfo {
  timestamp: string
  currentLanguage: string
  action: string
  details: any
  stackTrace?: string[]
}

class LanguageDebugger {
  private logs: LanguageDebugInfo[] = []
  private maxLogs = 50

  constructor() {
    // 初始化时记录当前状态
    this.log('init', 'Language debugger initialized', {
      currentLanguage: i18n.language,
      localStorage: this.getLocalStorageState(),
      browser: this.getBrowserInfo()
    })

    // 监听页面卸载前的状态
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.log('beforeunload', 'Page unloading', {
          currentLanguage: i18n.language,
          localStorage: this.getLocalStorageState()
        })
      })
    }
  }

  /**
   * 记录语言相关事件
   */
  log(action: string, message: string, details: any = {}) {
    const logEntry: LanguageDebugInfo = {
      timestamp: new Date().toISOString(),
      currentLanguage: i18n.language,
      action,
      details: {
        message,
        ...details,
        url: typeof window !== 'undefined' ? window.location.href : 'unknown'
      },
      stackTrace: new Error().stack?.split('\n').slice(2, 6) || ['unknown']
    }

    this.logs.push(logEntry)
    
    // 保持日志数量在限制内
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // 输出到控制台
    const prefix = action === 'error' ? '[🚨 LangDebug]' : 
                   action === 'warning' ? '[⚠️ LangDebug]' : 
                   '[🔍 LangDebug]'
    
    console.log(`${prefix} ${message}`, logEntry.details)

    // 特别关注阿拉伯语相关事件
    if (logEntry.currentLanguage === 'ar' || details.language === 'ar') {
      console.warn('[🚨 LangDebug] ARABIC LANGUAGE EVENT DETECTED:', logEntry)
    }
  }

  /**
   * 记录OAuth开始前的状态
   */
  logOAuthStart(provider: 'apple' | 'google') {
    this.log('oauth_start', `OAuth started for ${provider}`, {
      provider,
      preOAuthLanguage: i18n.language,
      localStorage: this.getLocalStorageState(),
      browser: this.getBrowserInfo()
    })
  }

  /**
   * 记录OAuth回调处理
   */
  logOAuthCallback(provider: string, success: boolean) {
    this.log('oauth_callback', `OAuth callback for ${provider}`, {
      provider,
      success,
      postOAuthLanguage: i18n.language,
      localStorage: this.getLocalStorageState()
    })
  }

  /**
   * 记录语言切换事件
   */
  logLanguageChange(fromLang: string, toLang: string, trigger: string) {
    this.log('language_change', `Language changed: ${fromLang} -> ${toLang}`, {
      fromLanguage: fromLang,
      toLanguage: toLang,
      trigger,
      isArabicInvolved: fromLang === 'ar' || toLang === 'ar',
      localStorage: this.getLocalStorageState()
    })
  }

  /**
   * 记录异常检测
   */
  logAnomalyDetected(anomaly: string, details: any) {
    this.log('anomaly', `Language anomaly detected: ${anomaly}`, details)
  }

  /**
   * 获取localStorage相关状态
   */
  private getLocalStorageState() {
    if (typeof localStorage === 'undefined') return {}
    
    return {
      preferred_language: localStorage.getItem('preferred_language'),
      pre_oauth_language: localStorage.getItem('pre_oauth_language'),
      user_explicitly_chose_arabic: localStorage.getItem('user_explicitly_chose_arabic'),
      oauth_provider: localStorage.getItem('oauth_provider'),
      language_fixed_after_oauth: localStorage.getItem('language_fixed_after_oauth')
    }
  }

  /**
   * 获取浏览器信息
   */
  private getBrowserInfo() {
    if (typeof navigator === 'undefined') return {}
    
    return {
      language: navigator.language,
      languages: navigator.languages,
      userAgent: navigator.userAgent.substring(0, 100),
      platform: navigator.platform
    }
  }

  /**
   * 导出所有日志
   */
  exportLogs(): LanguageDebugInfo[] {
    return [...this.logs]
  }

  /**
   * 生成诊断报告
   */
  generateDiagnosticReport(): string {
    const report = {
      summary: {
        totalLogs: this.logs.length,
        currentLanguage: i18n.language,
        timestamp: new Date().toISOString(),
        localStorage: this.getLocalStorageState(),
        browser: this.getBrowserInfo()
      },
      recentLogs: this.logs.slice(-10),
      arabicEvents: this.logs.filter(log => 
        log.currentLanguage === 'ar' || 
        log.details.language === 'ar' ||
        log.details.toLanguage === 'ar'
      ),
      oauthEvents: this.logs.filter(log => 
        log.action.includes('oauth')
      ),
      anomalies: this.logs.filter(log => 
        log.action === 'anomaly'
      )
    }

    return JSON.stringify(report, null, 2)
  }

  /**
   * 清除日志
   */
  clearLogs() {
    this.logs = []
    this.log('clear', 'Debug logs cleared')
  }
}

// 创建全局实例
export const languageDebugger = new LanguageDebugger()

// 在开发环境下将调试器暴露到全局
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).languageDebugger = languageDebugger
  console.log('[LangDebug] Language debugger attached to window.languageDebugger')
}

export default languageDebugger