import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  Menu, 
  X, 
  User, 
  Globe, 
  ChevronDown,
  LogIn,
  LogOut,
  Settings,
  Home,
  Video,
  DollarSign,
  TrendingUp,
  Gift
} from 'lucide-react'

// 圆形国旗组件（使用稳定的 flagcdn.com CDN）
const FlagImage = ({ country, className }: { country: string; className?: string }) => {
  // 国家代码映射（适配 flagcdn.com）
  const countryCodeMap: Record<string, string> = {
    US: 'us',
    CN: 'cn', 
    JP: 'jp',
    KR: 'kr',
    ES: 'es',
    DE: 'de',
    FR: 'fr',
    SA: 'sa'
  }
  
  const code = countryCodeMap[country]?.toLowerCase() || 'un'
  
  return (
    <img 
      src={`https://flagcdn.com/w80/${code}.png`}
      alt={`${country} flag`}
      width="20"
      height="15"
      className={`rounded-full object-cover ${className || ''}`}
      loading="lazy"
      style={{
        imageRendering: 'auto',
        filter: 'none'
      }}
      onError={(e) => {
        // 如果图片加载失败，显示占位符
        const target = e.target as HTMLImageElement
        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMTUiIHZpZXdCb3g9IjAgMCAyMCAxNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjE1IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04IDRMMTIgOEw4IDEyIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+'
        target.alt = 'Flag unavailable'
      }}
    />
  )
}
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import MembershipBadge from '@/components/subscription/MembershipBadge'
import { useTheme } from '@/hooks/useTheme'
import { Moon, Sun, Monitor } from 'lucide-react'
import { CreditDisplay } from './CreditDisplay'
import { languageDebugger } from '@/utils/languageDebugger'
import { useLanguageRouter } from '@/hooks/useLanguageRouter'

interface HeaderProps {
  className?: string
}

export function Header({ className = "" }: HeaderProps = {}) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const { user, profile, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const { currentLanguage, changeLanguage: changeLanguageRouter, navigateTo } = useLanguageRouter()
  
  // 移动端强制导航方案
  const [isNavigating, setIsNavigating] = useState(false)
  
  const handleMobileNavigation = useCallback((path: string, elementName: string, event?: React.MouseEvent) => {
    // 防止重复点击
    if (isNavigating) {
      console.log(`[Header] 正在导航中，忽略重复点击: ${elementName}`)
      return
    }
    
    // 检测是否为移动端
    const isMobile = typeof window !== 'undefined' && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768
    )
    
    console.log(`[Header] 导航处理: ${elementName} -> ${path}`, {
      current: location.pathname,
      target: path,
      isMobile,
      navigating: isNavigating,
      eventType: event?.type || 'unknown'
    })
    
    // 如果是当前页面，不需要导航
    if (location.pathname === path) {
      console.log(`[Header] 已在目标页面: ${path}`)
      return
    }
    
    
    // 强制导航
    setIsNavigating(true)
    console.log(`[Header] 🚀 强制导航: ${elementName} -> ${path}`)

    try {
      navigateTo(path)
      console.log(`[Header] ✅ 导航成功: ${path}`)
    } catch (error) {
      console.error(`[Header] ❌ 导航失败:`, error)
    } finally {
      // 清除导航状态
      setTimeout(() => {
        setIsNavigating(false)
      }, 500)
    }
  }, [navigateTo, location.pathname, isNavigating])
  
  // 导航状态调试
  useEffect(() => {
    console.log('[Header] 导航状态变化:', {
      pathname: location.pathname,
      isNavigating,
      timestamp: new Date().toISOString()
    })
  }, [location.pathname, isNavigating])
  
  // 导航背景框动态定位系统
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    opacity: 0,
    left: 0,
    width: 0,
    height: 0,
    top: 0
  })
  const isFirstLoadRef = useRef(true)
  
  // 获取当前激活的导航项索引
  const getActiveNavIndex = () => {
    const navPaths = ['/', '/templates', '/videos', '/pricing']
    return navPaths.findIndex(path => path === location.pathname)
  }

  // 更新背景框位置的函数
  const updateIndicatorPosition = (skipAnimation = false) => {
    try {
      const activeIndex = getActiveNavIndex()
      
      if (activeIndex >= 0 && navRefs.current[activeIndex]) {
        const activeElement = navRefs.current[activeIndex]
        
        if (activeElement && activeElement.offsetParent !== null) {
          const newLeft = activeElement.offsetLeft
          const newWidth = activeElement.offsetWidth
          const newHeight = activeElement.offsetHeight
          const newTop = activeElement.offsetTop
          
          // 检查计算结果是否有效
          if (newWidth > 0 && newHeight > 0) {
            const shouldSkipAnimation = skipAnimation || isFirstLoadRef.current
            
            setIndicatorStyle({
              left: newLeft,
              width: newWidth,
              height: newHeight,
              top: newTop,
              opacity: 1,
              transition: shouldSkipAnimation
                ? 'none' 
                : 'all 400ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            })
            
            if (isFirstLoadRef.current) {
              isFirstLoadRef.current = false
            }
          }
        } else {
          // 元素不可见，稍后重试
          setTimeout(() => updateIndicatorPosition(skipAnimation), 50)
        }
      } else {
        // 没有匹配的路径时隐藏背景框
        setIndicatorStyle(prev => ({ 
          ...prev, 
          opacity: 0,
          transition: skipAnimation ? 'none' : 'opacity 200ms ease-out'
        }))
      }
    } catch (error) {
      console.warn('Failed to update navigation indicator position:', error)
    }
  }

  // 组件挂载时初始化（无动画）
  useEffect(() => {
    if (isFirstLoadRef.current) {
      const timer = setTimeout(() => {
        updateIndicatorPosition(true) // 首次加载跳过动画
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [])

  // 路由变化和语言变化时更新位置
  useLayoutEffect(() => {
    // 如果是首次加载，由上面的useEffect处理
    if (!isFirstLoadRef.current) {
      updateIndicatorPosition(false) // 使用动画
    }
  }, [location.pathname, i18n.language])

  // 监听窗口大小变化，重新计算位置
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout
    
    const handleResize = () => {
      // 防抖：避免resize事件过于频繁
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        // resize时应该保持当前动画状态
        updateIndicatorPosition(!isFirstLoadRef.current)
      }, 150)
    }
    
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [])

  const changeLanguage = (lng: string) => {
    try {
      console.log('[Header] 用户主动切换语言:', {
        from: i18n.language,
        to: lng,
        timestamp: new Date().toISOString()
      })

      // 🚀 语言切换验证 - 确保切换的语言是有效的
      const supportedLanguages = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'ar']
      if (!supportedLanguages.includes(lng)) {
        console.warn('[Header] 无效的语言代码:', lng, '，使用默认中文')
        lng = 'zh'
      }

      // 特殊检查：如果用户选择阿拉伯语，记录此次选择
      if (lng === 'ar') {
        console.log('[Header] 用户明确选择阿拉伯语，记录偏好')
        localStorage.setItem('user_explicitly_chose_arabic', 'true')
      } else {
        // 如果选择其他语言，清除阿拉伯语选择标记
        localStorage.removeItem('user_explicitly_chose_arabic')
      }

      // 清理OAuth修复标记
      localStorage.removeItem('language_fixed_after_oauth')

      // 执行语言切换 - 使用新的语言路由系统
      const oldLanguage = i18n.language

      // 使用useLanguageRouter的changeLanguage方法，会自动更新URL
      changeLanguageRouter(lng)

      localStorage.setItem('preferred_language', lng)
      setLangDropdownOpen(false)

      // 🚀 记录语言切换
      languageDebugger.logLanguageChange(oldLanguage, lng, 'user_manual_selection')

      console.log('[Header] 语言切换完成:', lng, '，URL已更新')

    } catch (error) {
      console.error('[Header] 语言切换失败:', error)
      // 失败时确保关闭下拉菜单
      setLangDropdownOpen(false)
    }
  }

  const languages = [
    { code: 'en', name: 'English', shortName: 'EN', country: 'US' },
    { code: 'zh', name: '中文', shortName: '中文', country: 'CN' },
    { code: 'ja', name: '日本語', shortName: '日本語', country: 'JP' },
    { code: 'ko', name: '한국어', shortName: '한국어', country: 'KR' },
    { code: 'es', name: 'Español', shortName: 'ES', country: 'ES' },
    { code: 'de', name: 'Deutsch', shortName: 'DE', country: 'DE' },
    { code: 'fr', name: 'Français', shortName: 'FR', country: 'FR' },
    { code: 'ar', name: 'العربية', shortName: 'العربية', country: 'SA' },
  ]

  const currentLanguageObj = languages.find(lang => lang.code === currentLanguage) || languages[0]

  const handleSignOut = async () => {
    console.log('Sign out button clicked')
    
    if (isSigningOut) {
      console.log('Already signing out, please wait...')
      return
    }
    
    try {
      setIsSigningOut(true)
      setUserMenuOpen(false)
      setMobileMenuOpen(false)
      
      console.log('Calling signOut function...')
      await signOut()

      console.log('Sign out successful, navigating to home')
      navigateTo('/')
    } catch (error: any) {
      console.error('Sign out error:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className={`sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left side - Logo (Desktop only) */}
          <Link to="/" className="hidden md:flex items-center gap-3 group">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-8 w-8"
            />
            {/* Slogan - 仅在大屏幕且有足够空间时显示，使用手写字体 */}
            <div className="hidden xl:block min-w-0 flex-shrink-0">
              <div className="flex flex-col leading-tight whitespace-nowrap">
                <span className="text-sm text-gray-800 dark:text-gray-100 font-handwriting-bold">
                  Viral Videos
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400 font-handwriting italic">
                  Made Simple
                </span>
              </div>
            </div>
          </Link>

          {/* Center - Navigation */}
          {/* Desktop Navigation with dynamic background frame */}
          <nav className="hidden md:flex items-center gap-2 relative p-1 bg-accent/20 rounded-lg">
            {/* Dynamic background indicator */}
            <div 
              className="nav-indicator"
              style={indicatorStyle}
            />
            <Link 
              ref={el => { navRefs.current[0] = el }}
              to="/" 
              className={`relative z-10 text-sm font-medium px-3 py-2 rounded-md transition-all duration-300 flex items-center justify-center min-h-[32px] ${location.pathname === '/' ? 'text-accent-foreground' : 'hover:bg-accent/60'}`}
            >
              {t('nav.home')}
            </Link>
            <Link 
              ref={el => { navRefs.current[1] = el }}
              to="/templates" 
              className={`relative z-10 text-sm font-medium px-3 py-2 rounded-md transition-all duration-300 flex items-center justify-center min-h-[32px] ${location.pathname === '/templates' ? 'text-accent-foreground' : 'hover:bg-accent/60'}`}
            >
              {t('nav.templates')}
            </Link>
            <Link 
              ref={el => { navRefs.current[2] = el }}
              to="/videos" 
              className={`relative z-10 text-sm font-medium px-3 py-2 rounded-md transition-all duration-300 flex items-center justify-center min-h-[32px] ${location.pathname === '/videos' ? 'text-accent-foreground' : 'hover:bg-accent/60'}`}
            >
              {t('nav.videos')}
            </Link>
            <Link 
              ref={el => { navRefs.current[3] = el }}
              to="/pricing" 
              className={`relative z-10 text-sm font-medium px-3 py-2 rounded-md transition-all duration-300 flex items-center justify-center min-h-[32px] ${location.pathname === '/pricing' ? 'text-accent-foreground' : 'hover:bg-accent/60'}`}
            >
              {t('nav.pricing')}
            </Link>
          </nav>

          {/* Mobile Navigation with Icons and Text - 使用编程式导航 */}
          <nav className="md:hidden flex items-center justify-center flex-1 gap-1">
            <button 
              type="button"
              className={`mobile-nav-item ${location.pathname === '/' ? 'mobile-nav-active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleMobileNavigation('/', '首页', e)
              }}
              onMouseDown={(e) => {
                console.log('[Header] 🖱️ 鼠标按下: 首页')
              }}
            >
              <Home className="h-5 w-5" />
              <span className="text-xs font-medium">{t('nav.home')}</span>
            </button>
            <button 
              type="button"
              className={`mobile-nav-item ${location.pathname === '/templates' ? 'mobile-nav-active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleMobileNavigation('/templates', '模板', e)
              }}
              onMouseDown={(e) => {
                console.log('[Header] 🖱️ 鼠标按下: 模板')
              }}
            >
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs font-medium">{t('nav.templates')}</span>
            </button>
            <button 
              type="button"
              className={`mobile-nav-item ${location.pathname === '/videos' ? 'mobile-nav-active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleMobileNavigation('/videos', '视频', e)
              }}
              onMouseDown={(e) => {
                console.log('[Header] 🖱️ 鼠标按下: 视频')
              }}
            >
              <Video className="h-5 w-5" />
              <span className="text-xs font-medium">{t('nav.videos')}</span>
            </button>
            <button 
              type="button"
              className={`mobile-nav-item ${location.pathname === '/pricing' ? 'mobile-nav-active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleMobileNavigation('/pricing', '定价', e)
              }}
              onMouseDown={(e) => {
                console.log('[Header] 🖱️ 鼠标按下: 定价')
              }}
            >
              <DollarSign className="h-5 w-5" />
              <span className="text-xs font-medium">{t('nav.pricing')}</span>
            </button>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Language Dropdown (Desktop) */}
            <div className="hidden md:block relative" ref={dropdownRef}>
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-accent"
              >
                <FlagImage country={currentLanguageObj.country} className="h-5 w-5 rounded-full " />
                <span>{currentLanguageObj.shortName}</span>
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${langDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown Menu */}
              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-md shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={`w-full px-4 py-2 text-sm text-left hover:bg-accent transition-colors duration-200 first:rounded-t-md last:rounded-b-md flex items-center gap-3 ${
                        i18n.language === lang.code ? 'bg-accent' : ''
                      }`}
                    >
                      <FlagImage country={lang.country} className="h-5 w-5 rounded-full  flex-shrink-0" />
                      <span className="flex-1">{lang.name}</span>
                      {i18n.language === lang.code && (
                        <span className="text-primary">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 积分显示和升级按钮 - 移动端也显示但样式更紧凑 */}
            <CreditDisplay className="flex" />

            {/* User Menu / Auth Buttons */}
            {user ? (
              // 已登录 - 桌面端显示用户菜单
              <div className="relative hidden md:block" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent"
                >
                  {profile?.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt={profile.username || user.email || ''}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-md shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{profile?.full_name || profile?.username || t('user.guest')}</p>
                        <MembershipBadge userId={user.id} variant="compact" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors duration-200"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Home className="h-4 w-4" />
                        <span>{t('user.userCenter')}</span>
                      </Link>
                      <Link
                        to="/profile/settings"
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors duration-200"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        <span>{t('user.settings')}</span>
                      </Link>
                      <Link
                        to="/pricing?activeTab=referral"
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors duration-200"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Gift className="h-4 w-4" />
                        <span>{t('referral.inviteFriends')}</span>
                      </Link>
                      {/* 管理员入口 */}
                      {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors duration-200 bg-red-50 dark:bg-red-900/20"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings className="h-4 w-4 text-red-600" />
                          <span className="text-red-600 font-medium">{t('admin.dashboard')}</span>
                        </Link>
                      )}
                    </div>

                    {/* Theme Selector */}
                    <div className="border-t py-1">
                      <div className="px-4 py-2">
                        <p className="text-xs font-medium text-muted-foreground mb-2">{t('theme.theme')}</p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setTheme('light')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent transition-colors ${
                              theme === 'light' ? 'bg-accent' : ''
                            }`}
                          >
                            <Sun className="h-3 w-3" />
                            {t('theme.light')}
                          </button>
                          <button
                            onClick={() => setTheme('dark')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent transition-colors ${
                              theme === 'dark' ? 'bg-accent' : ''
                            }`}
                          >
                            <Moon className="h-3 w-3" />
                            {t('theme.dark')}
                          </button>
                          <button
                            onClick={() => setTheme('system')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent transition-colors ${
                              theme === 'system' ? 'bg-accent' : ''
                            }`}
                          >
                            <Monitor className="h-3 w-3" />
                            {t('theme.system')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Logout */}
                    <div className="border-t py-1">
                      <button
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors duration-200 w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{isSigningOut ? t('auth.signingOut') || '登出中...' : t('user.signOut')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // 未登录 - 桌面端显示按钮，移动端显示用户图标
              <>
                <div className="hidden md:flex items-center gap-2">
                  <Link to="/signin">
                    <Button variant="ghost" size="sm">
                      <LogIn className="mr-2 h-4 w-4" />
                      {t('auth.signIn')}
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button size="sm">
                      {t('auth.signUp')}
                    </Button>
                  </Link>
                </div>
              </>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden transition-all duration-300"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation with slide-in animation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t animate-in slide-in-from-top-2 duration-300">
            <nav className="flex flex-col gap-2">
              
              {/* User Menu (Mobile) */}
              {user ? (
                <div className="pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    {profile?.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt={profile.username || user.email || ''}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{profile?.full_name || profile?.username || t('user.guest')}</p>
                        <MembershipBadge userId={user.id} variant="compact" />
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Link
                      to="/profile"
                      className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-all duration-200"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="h-4 w-4" />
                      <span>{t('user.userCenter')}</span>
                    </Link>
                    <Link
                      to="/profile/settings"
                      className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-all duration-200"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      <span>{t('user.settings')}</span>
                    </Link>
                    <Link
                      to="/pricing?activeTab=referral"
                      className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-all duration-200"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Gift className="h-4 w-4" />
                      <span>{t('referral.inviteFriends')}</span>
                    </Link>
                    {/* 管理员入口 - 移动端 */}
                    {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-all duration-200 bg-red-50 dark:bg-red-900/20"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4 text-red-600" />
                        <span className="text-red-600 font-medium">{t('admin.dashboard')}</span>
                      </Link>
                    )}
                    
                    {/* Theme Selector (Mobile) */}
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-muted-foreground mb-2">{t('theme.theme')}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setTheme('light')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent transition-colors ${
                            theme === 'light' ? 'bg-accent' : ''
                          }`}
                        >
                          <Sun className="h-3 w-3" />
                          {t('theme.light')}
                        </button>
                        <button
                          onClick={() => setTheme('dark')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent transition-colors ${
                            theme === 'dark' ? 'bg-accent' : ''
                          }`}
                        >
                          <Moon className="h-3 w-3" />
                          {t('theme.dark')}
                        </button>
                        <button
                          onClick={() => setTheme('system')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent transition-colors ${
                            theme === 'system' ? 'bg-accent' : ''
                          }`}
                        >
                          <Monitor className="h-3 w-3" />
                          {t('theme.system')}
                        </button>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-all duration-200 text-left w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{isSigningOut ? t('auth.signingOut') || '登出中...' : t('user.signOut')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    to="/signin"
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{t('auth.signIn')}</span>
                  </Link>
                  <Link
                    to="/signup"
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md border hover:bg-accent transition-all duration-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>{t('auth.signUp')}</span>
                  </Link>
                </div>
              )}
              
              {/* Language Selector (Mobile) - Dropdown style */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span>Language</span>
                </div>
                <div className="flex flex-col gap-1">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        changeLanguage(lang.code)
                        setMobileMenuOpen(false)
                      }}
                      className={`px-3 py-2 text-sm rounded-md transition-all duration-200 text-left flex items-center gap-3 ${
                        i18n.language === lang.code
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <FlagImage country={lang.country} className="h-5 w-5 rounded-full  flex-shrink-0" />
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}