import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from 'react-i18next'
import { 
  Settings,
  Globe,
  Moon,
  Sun,
  Monitor,
  Check,
  X,
  Loader2,
  Lock,
  CreditCard,
  Bell
} from '@/components/icons'
import { useTheme } from '@/hooks/useTheme'
import SubscriptionStatus from '@/components/subscription/SubscriptionStatus'
import { SubscriptionService } from '@/services/subscriptionService'
import { userSettingsService, UserSettings } from '@/services/userSettingsService'
import type { Subscription } from '@/types'


export default function AccountSettingsPage() {
  const { t, i18n } = useTranslation()
  const { user, updatePassword, settings, updateSettings, refreshSettings } = useAuth()
  const { theme, setTheme } = useTheme()
  
  // 账户设置状态
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // 用户设置状态（从 AuthContext 获取）
  const [localSettings, setLocalSettings] = useState<UserSettings | null>(settings)
  
  // 订阅状态
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  
  // UI 状态
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'subscription' | 'notifications'>('account')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)

  // 同步设置状态
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings])

  useEffect(() => {
    if (user) {
      setEmail(user.email || '')
      // 加载用户设置
      loadSettings()
    }
  }, [user])

  const loadSettings = async () => {
    if (!user) return
    
    setSettingsLoading(true)
    try {
      // 从 AuthContext 中刷新设置
      await refreshSettings()
      
      // 加载订阅信息
      const subscriptionData = await SubscriptionService.getCurrentSubscription(user.id)
      setSubscription(subscriptionData)
      
    } catch (error) {
      console.error('加载设置失败:', error)
      setErrorMessage('加载设置失败，请刷新页面重试')
    } finally {
      setSettingsLoading(false)
    }
  }

  // const handleSubscriptionChange = () => {
  //   // 刷新订阅数据
  //   if (user) {
  //     loadSettings()
  //   }
  // } // unused

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setErrorMessage(t('settings.passwordMismatch'))
      return
    }

    if (newPassword.length < 6) {
      setErrorMessage(t('settings.passwordTooShort'))
      return
    }

    try {
      setIsSaving(true)
      setErrorMessage('')
      
      await updatePassword(newPassword)
      
      setSuccessMessage(t('settings.passwordChanged'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    if (!localSettings) return
    
    try {
      setIsSaving(true)
      setErrorMessage('')
      
      // 更新设置到数据库
      await updateSettings({
        theme: localSettings.theme,
        timezone: localSettings.timezone,
        date_format: localSettings.date_format,
        language: localSettings.language,
        notification_preferences: localSettings.notification_preferences
      })
      
      // 应用主题变更
      setTheme(localSettings.theme)
      
      // 应用语言变更
      i18n.changeLanguage(localSettings.language)
      
      setSuccessMessage(t('settings.preferencesSaved'))
      setTimeout(() => setSuccessMessage(''), 3000)
      
    } catch (error) {
      console.error('保存设置失败:', error)
      setErrorMessage(t('settings.saveError'))
      setTimeout(() => setErrorMessage(''), 5000)
    } finally {
      setIsSaving(false)
    }
  }
  
  // 更新本地设置状态的帮助函数
  const updateLocalSetting = <K extends keyof UserSettings>(
    key: K, 
    value: UserSettings[K]
  ) => {
    if (!localSettings) return
    
    setLocalSettings({
      ...localSettings,
      [key]: value
    })
  }
  
  const updateNotificationPreference = (
    key: string, 
    value: boolean
  ) => {
    if (!localSettings) return
    
    setLocalSettings({
      ...localSettings,
      notification_preferences: {
        ...localSettings.notification_preferences,
        [key]: value
      }
    })
  }


  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('settings.accountSettings')}</h1>
        <p className="text-muted-foreground">
          {t('settings.accountSettingsDescription')}
        </p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg flex items-center">
          <Check className="mr-2 h-4 w-4" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg flex items-center">
          <X className="mr-2 h-4 w-4" />
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 侧边栏导航 */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'account' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              }`}
            >
              <Settings className="h-4 w-4" />
              {t('settings.account')}
            </button>
            
            <button
              onClick={() => setActiveTab('preferences')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'preferences' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              }`}
            >
              <Globe className="h-4 w-4" />
              {t('settings.preferences')}
            </button>

            <button
              onClick={() => setActiveTab('subscription')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'subscription' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              {t('settings.subscription')}
            </button>
            
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'notifications' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              }`}
            >
              <Bell className="h-4 w-4" />
              {t('settings.notifications')}
            </button>
          </nav>
        </div>

        {/* 内容区域 */}
        <div className="lg:col-span-3">
          {activeTab === 'account' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.accountInfo')}</CardTitle>
                  <CardDescription>
                    {t('settings.accountInfoDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('settings.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('settings.emailCannotChange')}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="userId">{t('settings.userId')}</Label>
                    <Input
                      id="userId"
                      value={user?.id || ''}
                      disabled
                      className="bg-muted font-mono text-xs"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.changePassword')}</CardTitle>
                  <CardDescription>
                    {t('settings.changePasswordDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">{t('settings.currentPassword')}</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">{t('settings.newPassword')}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('settings.confirmPassword')}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleChangePassword}
                    disabled={isSaving || !newPassword || !confirmPassword}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('common.saving')}
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        {t('settings.updatePassword')}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.generalPreferences')}</CardTitle>
                  <CardDescription>
                    {t('settings.generalPreferencesDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">{t('settings.language')}</Label>
                    <Select 
                      value={localSettings?.language || 'en'} 
                      onValueChange={(value) => updateLocalSetting('language', value)}
                      disabled={settingsLoading}
                    >
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh">中文</SelectItem>
                        <SelectItem value="ja">日本語</SelectItem>
                        <SelectItem value="ko">한국어</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="theme">{t('settings.theme')}</Label>
                    <Select 
                      value={localSettings?.theme || 'system'} 
                      onValueChange={(value: 'light' | 'dark' | 'system') => updateLocalSetting('theme', value)}
                      disabled={settingsLoading}
                    >
                      <SelectTrigger id="theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">
                          <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4" />
                            {t('settings.lightTheme')}
                          </div>
                        </SelectItem>
                        <SelectItem value="dark">
                          <div className="flex items-center gap-2">
                            <Moon className="h-4 w-4" />
                            {t('settings.darkTheme')}
                          </div>
                        </SelectItem>
                        <SelectItem value="system">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4" />
                            {t('settings.systemTheme')}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="timezone">{t('settings.timezone')}</Label>
                    <Select 
                      value={localSettings?.timezone || 'UTC'} 
                      onValueChange={(value) => updateLocalSetting('timezone', value)}
                      disabled={settingsLoading}
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                        <SelectItem value="Europe/Paris">Paris</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                        <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">{t('settings.dateFormat')}</Label>
                    <Select 
                      value={localSettings?.date_format || 'MM/DD/YYYY'} 
                      onValueChange={(value: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD') => updateLocalSetting('date_format', value)}
                      disabled={settingsLoading}
                    >
                      <SelectTrigger id="dateFormat">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    onClick={handleSavePreferences} 
                    disabled={isSaving || settingsLoading || !localSettings}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('common.saving')}
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {t('common.save')}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}


          {activeTab === 'subscription' && (
            <div className="space-y-6">
              <SubscriptionStatus 
                showManageButton={true}
                className="w-full"
              />
            </div>
          )}
          
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.notificationPreferences')}</CardTitle>
                  <CardDescription>
                    {t('settings.notificationPreferencesDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {settingsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="ml-2">{t('common.loading')}</span>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="email-notifications">
                              {t('settings.emailNotifications')}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {t('settings.emailNotificationsDescription')}
                            </p>
                          </div>
                          <Switch
                            id="email-notifications"
                            checked={localSettings?.notification_preferences?.email_notifications ?? true}
                            onCheckedChange={(checked) => updateNotificationPreference('email_notifications', checked)}
                            disabled={settingsLoading}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="push-notifications">
                              {t('settings.pushNotifications')}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {t('settings.pushNotificationsDescription')}
                            </p>
                          </div>
                          <Switch
                            id="push-notifications"
                            checked={localSettings?.notification_preferences?.push_notifications ?? true}
                            onCheckedChange={(checked) => updateNotificationPreference('push_notifications', checked)}
                            disabled={settingsLoading}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="video-completion">
                              {t('settings.videoCompletionNotifications')}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {t('settings.videoCompletionNotificationsDescription')}
                            </p>
                          </div>
                          <Switch
                            id="video-completion"
                            checked={localSettings?.notification_preferences?.video_completion ?? true}
                            onCheckedChange={(checked) => updateNotificationPreference('video_completion', checked)}
                            disabled={settingsLoading}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="template-likes">
                              {t('settings.templateLikeNotifications')}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {t('settings.templateLikeNotificationsDescription')}
                            </p>
                          </div>
                          <Switch
                            id="template-likes"
                            checked={localSettings?.notification_preferences?.template_likes ?? true}
                            onCheckedChange={(checked) => updateNotificationPreference('template_likes', checked)}
                            disabled={settingsLoading}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="referral-rewards">
                              {t('settings.referralRewardNotifications')}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {t('settings.referralRewardNotificationsDescription')}
                            </p>
                          </div>
                          <Switch
                            id="referral-rewards"
                            checked={localSettings?.notification_preferences?.referral_rewards ?? true}
                            onCheckedChange={(checked) => updateNotificationPreference('referral_rewards', checked)}
                            disabled={settingsLoading}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="marketing-emails">
                              {t('settings.marketingEmails')}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {t('settings.marketingEmailsDescription')}
                            </p>
                          </div>
                          <Switch
                            id="marketing-emails"
                            checked={localSettings?.notification_preferences?.marketing_emails ?? false}
                            onCheckedChange={(checked) => updateNotificationPreference('marketing_emails', checked)}
                            disabled={settingsLoading}
                          />
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleSavePreferences} 
                        disabled={isSaving || settingsLoading || !localSettings}
                        className="w-full"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('common.saving')}
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            {t('settings.saveNotificationPreferences')}
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}