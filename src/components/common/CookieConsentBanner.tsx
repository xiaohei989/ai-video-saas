import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { X, Cookie, Settings } from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import analyticsService from '@/services/analyticsService'

interface CookieConsentBannerProps {
  className?: string
}

export default function CookieConsentBanner({ className }: CookieConsentBannerProps) {
  const { t } = useTranslation()
  const [showBanner, setShowBanner] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // 检查用户是否已经做出选择
    const consentStatus = localStorage.getItem('ga_consent_given')
    if (consentStatus === null) {
      // 延迟显示横幅，避免打扰用户体验
      const timer = setTimeout(() => {
        setShowBanner(true)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    analyticsService.grantConsent()
    setShowBanner(false)
    
    // 发送接受事件（在同意后立即发送）
    setTimeout(() => {
      analyticsService.trackEvent({
        action: 'cookie_consent_accepted',
        category: 'privacy'
      })
    }, 100)
  }

  const handleDecline = () => {
    analyticsService.denyConsent()
    setShowBanner(false)
  }

  const handleShowDetails = () => {
    setShowDetails(!showDetails)
  }

  if (!showBanner) return null

  return (
    <div className={`fixed bottom-4 left-4 right-4 z-50 ${className}`}>
      <Card className="p-4 bg-background/95 backdrop-blur-sm border shadow-lg">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
          
          <div className="flex-1 space-y-3">
            <div className="text-sm">
              <p className="font-medium text-foreground mb-2">
                {t('privacy.cookieConsent.title', '我们使用Cookie来改善您的体验')}
              </p>
              <p className="text-muted-foreground">
                {t('privacy.cookieConsent.description', 
                  '我们使用Google Analytics来了解您如何使用我们的网站，以便改进我们的服务。这些数据是匿名的，不会用于广告。'
                )}
              </p>
            </div>

            {showDetails && (
              <Alert className="text-xs">
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>{t('privacy.cookieConsent.essential', '必要Cookie')}</strong></p>
                    <p className="text-muted-foreground">
                      {t('privacy.cookieConsent.essentialDesc', '用于网站基本功能，包括登录状态和主题设置。')}
                    </p>
                    
                    <p><strong>{t('privacy.cookieConsent.analytics', '分析Cookie')}</strong></p>
                    <p className="text-muted-foreground">
                      {t('privacy.cookieConsent.analyticsDesc', 'Google Analytics用于了解网站使用情况，帮助我们改进产品。')}
                    </p>
                    
                    <p className="text-xs text-muted-foreground">
                      {t('privacy.cookieConsent.dataInfo', '数据完全匿名化，不包含个人身份信息。您可以随时在隐私设置中更改此选择。')}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleAccept}
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                {t('privacy.cookieConsent.accept', '接受所有')}
              </Button>
              
              <Button
                onClick={handleDecline}
                variant="outline"
                size="sm"
              >
                {t('privacy.cookieConsent.decline', '仅必要Cookie')}
              </Button>
              
              <Button
                onClick={handleShowDetails}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                {showDetails 
                  ? t('privacy.cookieConsent.hideDetails', '隐藏详情')
                  : t('privacy.cookieConsent.showDetails', '了解详情')
                }
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('privacy.cookieConsent.policyLink', '查看我们的')}{' '}
              <a 
                href="/privacy" 
                className="underline hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('privacy.cookieConsent.privacyPolicy', '隐私政策')}
              </a>
              {' '}{t('privacy.cookieConsent.and', '和')}{' '}
              <a 
                href="/cookies" 
                className="underline hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('privacy.cookieConsent.cookiePolicy', 'Cookie政策')}
              </a>
            </p>
          </div>

          <button
            onClick={() => setShowBanner(false)}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label={t('common.close', '关闭')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Card>
    </div>
  )
}