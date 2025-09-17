import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select' // unused
import { Badge } from '@/components/ui/badge'
import { useAnalytics } from '@/hooks/useAnalytics'
import analyticsService from '@/services/analyticsService'
import { CheckCircle, XCircle, Play, ShoppingCart, Heart, Share2, Download } from 'lucide-react'
import { toast } from 'sonner'

export default function TestAnalytics() {
  const { t } = useTranslation()
  const analytics = useAnalytics()
  const [customEvent, setCustomEvent] = useState({
    action: '',
    category: '',
    label: '',
    value: ''
  })

  const testEvents = [
    {
      name: t('analytics.testPage.presetEvents.templateView'),
      icon: <Play className="h-4 w-4" />,
      action: () => analytics.trackTemplateView('test-template-1', 'ASMR'),
      description: t('analytics.testPage.presetEvents.templateViewDesc')
    },
    {
      name: t('analytics.testPage.presetEvents.templateLike'), 
      icon: <Heart className="h-4 w-4" />,
      action: () => analytics.trackTemplateLike('test-template-1', 'ASMR'),
      description: t('analytics.testPage.presetEvents.templateLikeDesc')
    },
    {
      name: t('analytics.testPage.presetEvents.videoGenerationStart'),
      icon: <Play className="h-4 w-4" />,
      action: () => analytics.trackVideoGeneration({
        template_id: 'test-template-1',
        template_category: 'ASMR',
        video_quality: 'fast',
        aspect_ratio: '16:9',
        api_provider: 'qingyun',
        credits_used: 20,
        success: false
      }),
      description: t('analytics.testPage.presetEvents.videoGenerationStartDesc')
    },
    {
      name: t('analytics.testPage.presetEvents.videoGenerationComplete'),
      icon: <CheckCircle className="h-4 w-4" />,
      action: () => analytics.trackVideoGeneration({
        template_id: 'test-template-1',
        template_category: 'ASMR',
        video_quality: 'fast',
        aspect_ratio: '16:9',
        api_provider: 'qingyun',
        credits_used: 20,
        success: true,
        generation_duration: 120 // 2分钟
      }),
      description: t('analytics.testPage.presetEvents.videoGenerationCompleteDesc')
    },
    {
      name: t('analytics.testPage.presetEvents.videoDownload'),
      icon: <Download className="h-4 w-4" />,
      action: () => analytics.trackVideoDownload('test-video-1', 'test-template-1'),
      description: t('analytics.testPage.presetEvents.videoDownloadDesc')
    },
    {
      name: t('analytics.testPage.presetEvents.videoShare'),
      icon: <Share2 className="h-4 w-4" />,
      action: () => analytics.trackVideoShare('test-video-1', 'wechat'),
      description: t('analytics.testPage.presetEvents.videoShareDesc')
    },
    {
      name: t('analytics.testPage.presetEvents.subscriptionStart'),
      icon: <ShoppingCart className="h-4 w-4" />,
      action: () => analytics.trackSubscriptionStart('basic', 9.99),
      description: t('analytics.testPage.presetEvents.subscriptionStartDesc')
    },
    {
      name: t('analytics.testPage.presetEvents.creditsPurchase'),
      icon: <ShoppingCart className="h-4 w-4" />,
      action: () => analytics.trackCreditsPurchase(500, 19.99, 'test-transaction-123'),
      description: t('analytics.testPage.presetEvents.creditsPurchaseDesc')
    },
    {
      name: t('analytics.testPage.presetEvents.themeChange'),
      icon: <CheckCircle className="h-4 w-4" />,
      action: () => analytics.trackThemeChange('dark'),
      description: t('analytics.testPage.presetEvents.themeChangeDesc')
    },
    {
      name: t('analytics.testPage.presetEvents.errorTracking'),
      icon: <XCircle className="h-4 w-4" />,
      action: () => analytics.trackError('video_generation_error', 'API timeout error', 'VideoCreator'),
      description: t('analytics.testPage.presetEvents.errorTrackingDesc')
    }
  ]

  const handleCustomEvent = () => {
    if (!customEvent.action || !customEvent.category) {
      toast.error(t('analytics.testPage.customEvents.fillRequired'))
      return
    }

    analytics.trackEvent({
      action: customEvent.action,
      category: customEvent.category,
      label: customEvent.label || undefined,
      value: customEvent.value ? parseInt(customEvent.value) : undefined
    })
    
    // 清空表单
    setCustomEvent({ action: '', category: '', label: '', value: '' })
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{t('analytics.testPage.title')}</h1>
        <p className="text-muted-foreground">{t('analytics.testPage.subtitle')}</p>
      </div>

      {/* Analytics状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t('analytics.testPage.status.title')}
            {analyticsService.hasConsent() ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                {t('analytics.testPage.status.enabled')}
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                <XCircle className="h-3 w-3 mr-1" />
                {t('analytics.testPage.status.waitingConsent')}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {t('analytics.testPage.status.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>{t('analytics.testPage.status.measurementId')}:</strong> {import.meta.env.VITE_GA_MEASUREMENT_ID || t('analytics.testPage.status.notConfigured')}
            </div>
            <div>
              <strong>{t('analytics.testPage.status.debugMode')}:</strong> {import.meta.env.VITE_GA_DEBUG_MODE || 'false'}
            </div>
            <div>
              <strong>{t('analytics.testPage.status.userConsent')}:</strong> {analyticsService.hasConsent() ? t('common.yes') : t('common.no')}
            </div>
            <div>
              <strong>{t('analytics.testPage.status.environment')}:</strong> {import.meta.env.NODE_ENV}
            </div>
          </div>
          
          <div className="mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => analyticsService.debug()}
            >
              {t('analytics.testPage.status.printDebugInfo')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 预设事件测试 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.testPage.presetEvents.title')}</CardTitle>
          <CardDescription>
            {t('analytics.testPage.presetEvents.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testEvents.map((event, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {event.icon}
                  <h3 className="font-medium">{event.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {event.description}
                </p>
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={event.action}
                  disabled={!analyticsService.hasConsent()}
                >
                  {t('analytics.testPage.presetEvents.sendEvent')}
                </Button>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 自定义事件测试 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.testPage.customEvents.title')}</CardTitle>
          <CardDescription>
            {t('analytics.testPage.customEvents.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="action">{t('analytics.testPage.customEvents.actionLabel')} *</Label>
              <Input
                id="action"
                value={customEvent.action}
                onChange={(e) => setCustomEvent({...customEvent, action: e.target.value})}
                placeholder={t('analytics.testPage.customEvents.actionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{t('analytics.testPage.customEvents.categoryLabel')} *</Label>
              <Input
                id="category"
                value={customEvent.category}
                onChange={(e) => setCustomEvent({...customEvent, category: e.target.value})}
                placeholder={t('analytics.testPage.customEvents.categoryPlaceholder')}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="label">{t('analytics.testPage.customEvents.labelLabel')}</Label>
              <Input
                id="label"
                value={customEvent.label}
                onChange={(e) => setCustomEvent({...customEvent, label: e.target.value})}
                placeholder={t('analytics.testPage.customEvents.labelPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">{t('analytics.testPage.customEvents.valueLabel')}</Label>
              <Input
                id="value"
                type="number"
                value={customEvent.value}
                onChange={(e) => setCustomEvent({...customEvent, value: e.target.value})}
                placeholder={t('analytics.testPage.customEvents.valuePlaceholder')}
              />
            </div>
          </div>
          
          <Button 
            onClick={handleCustomEvent}
            disabled={!analyticsService.hasConsent()}
            className="w-full"
          >
            {t('analytics.testPage.customEvents.sendCustomEvent')}
          </Button>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.testPage.instructions.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong>{t('analytics.testPage.instructions.step1.title')}</strong>
            <p className="text-muted-foreground">
              {t('analytics.testPage.instructions.step1.description')}
            </p>
          </div>
          <div>
            <strong>{t('analytics.testPage.instructions.step2.title')}</strong>
            <p className="text-muted-foreground">
              {t('analytics.testPage.instructions.step2.description')}
            </p>
          </div>
          <div>
            <strong>{t('analytics.testPage.instructions.step3.title')}</strong>
            <p className="text-muted-foreground">
              {t('analytics.testPage.instructions.step3.description')}
            </p>
          </div>
          <div>
            <strong>{t('analytics.testPage.instructions.step4.title')}</strong>
            <p className="text-muted-foreground">
              {t('analytics.testPage.instructions.step4.description')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}