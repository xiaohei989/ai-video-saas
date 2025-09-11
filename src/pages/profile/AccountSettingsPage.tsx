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
import { useTranslation } from 'react-i18next'
// import { useNavigate } from 'react-router-dom' // unused
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
  CreditCard
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import SubscriptionStatus from '@/components/subscription/SubscriptionStatus'
import { SubscriptionService } from '@/services/subscriptionService'
import type { Subscription } from '@/types'


export default function AccountSettingsPage() {
  const { t, i18n } = useTranslation()
  const { user, updatePassword } = useAuth()
  const { theme, setTheme } = useTheme()
  
  // 账户设置状态
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // 偏好设置状态
  const [language, setLanguage] = useState(i18n.language)
  const [timezone, setTimezone] = useState('UTC')
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY')
  
  // 订阅状态
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  
  // 避免未使用变量警告
  void subscription
  
  // UI 状态
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'subscription'>('account')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (user) {
      setEmail(user.email || '')
    }
    // 从本地存储或数据库加载设置
    loadSettings()
  }, [user])

  const loadSettings = async () => {
    // TODO: 从数据库加载用户设置
    const savedLanguage = localStorage.getItem('language') || 'en'
    setLanguage(savedLanguage)
    
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' || 'system'
    setTheme(savedTheme)

    // 加载订阅信息
    if (user) {
      try {
        const subscriptionData = await SubscriptionService.getCurrentSubscription(user.id)
        setSubscription(subscriptionData)
      } catch (error) {
        console.error('加载订阅信息失败:', error)
      }
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
    try {
      setIsSaving(true)
      
      // 保存语言设置
      localStorage.setItem('language', language)
      i18n.changeLanguage(language)
      
      // 保存主题设置
      localStorage.setItem('theme', theme)
      
      // TODO: 保存其他设置到数据库
      
      setSuccessMessage(t('settings.preferencesSaved'))
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      setErrorMessage(t('settings.saveError'))
    } finally {
      setIsSaving(false)
    }
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
                    <Select value={language} onValueChange={setLanguage}>
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
                    <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}>
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
                    <Select value={timezone} onValueChange={setTimezone}>
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
                    <Select value={dateFormat} onValueChange={setDateFormat}>
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
                  
                  <Button onClick={handleSavePreferences} disabled={isSaving}>
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

        </div>
      </div>
    </div>
  )
}