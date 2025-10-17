import React, { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './contexts/AuthContext'
import { Layout } from './components/layout/Layout'
import FullScreenLayout from './components/layout/FullScreenLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { Toaster } from '@/components/ui/sonner'
import EnvironmentIndicator from './components/stripe/EnvironmentIndicator'
import TemplateSync from './components/system/TemplateSync'
import CookieConsentBanner from './components/common/CookieConsentBanner'
import LoadingSpinner from './components/common/LoadingSpinner'
import analyticsService from './services/analyticsService'
import { csrfService } from './services/csrfService'
import { securityMonitor } from './services/securityMonitorService'
import { validateSecurityConfig } from './config/security'
import redisCacheIntegrationService from './services/RedisCacheIntegrationService'
import RoutePreloader from './components/preload/RoutePreloader'
import { LanguageRouteWrapper, RootRedirect } from './components/routing/LanguageRouteWrapper'
import { SEOHead } from './components/seo/SEOHead'
import { StructuredData } from './components/seo/StructuredData'

// 调试工具（开发环境）
if (process.env.NODE_ENV === 'development') {
  import('./utils/debugSupabase')
}

// 🚀 路由懒加载 - 主要页面
const HomePage = lazy(() => import('./pages/HomePage'))
const VideoCreator = lazy(() => import('./features/video-creator/components/VideoCreator'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const VideosPage = lazy(() => import('./pages/VideosPageNew'))
const PricingPage = lazy(() => import('./pages/PricingPage'))

// 🚀 路由懒加载 - 认证页面
const SignInForm = lazy(() => import('./components/auth/SignInForm'))
const SignUpForm = lazy(() => import('./components/auth/SignUpForm'))
const ForgotPasswordForm = lazy(() => import('./components/auth/ForgotPasswordForm'))
const ResetPasswordForm = lazy(() => import('./components/auth/ResetPasswordForm'))
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'))

// 🚀 路由懒加载 - 个人中心页面
const UserCenterPage = lazy(() => import('./pages/profile/UserCenterPage'))
const ProfileEditPage = lazy(() => import('./pages/profile/ProfileEditPage'))
const PublicProfilePage = lazy(() => import('./pages/profile/PublicProfilePage'))
const MyTemplatesPage = lazy(() => import('./pages/profile/MyTemplatesPage'))
const AccountSettingsPage = lazy(() => import('./pages/profile/AccountSettingsPage'))

// 🚀 路由懒加载 - 法律页面
const PrivacyPolicyPage = lazy(() => import('./pages/legal/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/legal/TermsOfServicePage'))
const CookiePolicyPage = lazy(() => import('./pages/legal/CookiePolicyPage'))

// 🚀 路由懒加载 - 帮助中心
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'))

// 🚀 路由懒加载 - 视频相关
const VideoDetailPage = lazy(() => import('./pages/VideoDetailPage'))
const VideoEmbedPage = lazy(() => import('./pages/VideoEmbedPage'))

// 🚀 路由懒加载 - SEO Guide
const TemplateGuidePage = lazy(() => import('./pages/TemplateGuidePage'))

// 🚀 路由懒加载 - 管理后台 (独立chunk)
const AdminRoute = lazy(() => import('./components/admin/AdminRoute'))
const AdminApp = lazy(() => import('./components/admin/AdminApp'))
const ThumbnailTestPage = lazy(() => import('./pages/ThumbnailTestPage'))
const ForceThumbnailPage = lazy(() => import('./pages/admin/ForceThumbnailPage'))
const BatchBlurThumbnailsPage = lazy(() => import('./pages/admin/BatchBlurThumbnailsPage'))

// 🚀 路由懒加载 - 翻译工具
const TemplateTranslationPage = lazy(() => import('./features/translation/TemplateTranslationPage'))

// 🚀 路由懒加载 - 测试页面 (仅开发环境)
const TestPage = lazy(() => import('./pages/TestPage'))
const TestVeoApi = lazy(() => import('./pages/TestVeoApi'))
const TestWuyinApi = lazy(() => import('./pages/TestWuyinApi'))
const TestWatermark = lazy(() => import('./pages/TestWatermark'))
const SimpleWatermarkTest = lazy(() => import('./pages/SimpleWatermarkTest'))
const TestApicoreApi = lazy(() => import('./pages/TestApicoreApi'))
const TestAnalytics = lazy(() => import('./pages/TestAnalytics'))
const TestAIContent = lazy(() => import('./pages/TestAIContent'))
const SimpleAITest = lazy(() => import('./pages/SimpleAITest'))
const TitleEffectDemo = lazy(() => import('./pages/TitleEffectDemo'))
const DeviceTestPage = lazy(() => import('./pages/DeviceTestPage'))
const VideoPlayerTestPage = lazy(() => import('./pages/VideoPlayerTestPage'))
const VideoPlayerLoadingTestPage = lazy(() => import('./pages/VideoPlayerLoadingTestPage'))
const VideoPlayerControlsTestPage = lazy(() => import('./pages/VideoPlayerControlsTestPage'))
const CacheManagementPage = lazy(() => import('./pages/CacheManagementPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})

function App() {
  // 初始化Google Analytics、安全服务和缓存服务
  React.useEffect(() => {
    const initializeServices = async () => {
      // 初始化Google Analytics
      const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID
      if (measurementId) {
        analyticsService.initialize(measurementId)
      }
      
      // 验证安全配置
      const isSecurityConfigValid = validateSecurityConfig()
      if (!isSecurityConfigValid && process.env.NODE_ENV === 'production') {
        console.error('Security configuration validation failed')
      }
      
      // 初始化CSRF保护
      csrfService.generateToken()
      
      // 初始化多级缓存服务
      try {
        await redisCacheIntegrationService.initialize()
        // 多级缓存服务初始化完成
      } catch (error) {
        console.error('[App] 缓存服务初始化失败:', error)
      }
    }
    
    initializeServices()
    
    // 设置安全头 - 临时注释以修复APICore CORS问题
    // const cspString = generateCSPString()
    // if (typeof document !== 'undefined') {
    //   const metaCSP = document.createElement('meta')
    //   metaCSP.httpEquiv = 'Content-Security-Policy'
    //   metaCSP.content = cspString
    //   document.head.appendChild(metaCSP)
    // }
    
    // 记录应用启动
    securityMonitor.logSecurityEvent({
      type: 'suspicious_pattern' as any,
      level: 'low' as any,
      details: { action: 'app_start' },
      blocked: false,
      action: 'app_initialization'
    })
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <AuthProvider>
              <RoutePreloader />
              <TemplateSync />
              <SEOHead />
              <StructuredData type="website" />
              <StructuredData type="softwareApplication" />
              <Suspense fallback={<LoadingSpinner fullScreen message="加载中..." />}>
              <Routes>
              {/* Root redirect to language-prefixed path */}
              <Route path="/" element={<RootRedirect />} />

              {/* Language-prefixed routes */}
              <Route path="/:lang/*" element={<LanguageRouteWrapper><LanguagePrefixedRoutes /></LanguageRouteWrapper>} />
              </Routes>
              </Suspense>
              <Toaster />
              <EnvironmentIndicator />
              <CookieConsentBanner />
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

// 页面追踪组件
function PageViewTracker() {
  const location = useLocation()

  useEffect(() => {
    // 追踪页面浏览
    analyticsService.trackPageView(location.pathname, document.title)
  }, [location])

  return null
}

// 语言前缀路由组件
function LanguagePrefixedRoutes() {
  return (
    <>
      <PageViewTracker />
      <Routes>
      {/* Public routes */}
      <Route path="/" element={<FullScreenLayout><HomePage /></FullScreenLayout>} />
      <Route path="/templates" element={<Layout><TemplatesPage /></Layout>} />
      <Route path="/pricing" element={<Layout><PricingPage /></Layout>} />
              
      {/* Video detail page - public access for sharing */}
      <Route path="/video/:id" element={<Layout><VideoDetailPage /></Layout>} />

      {/* Video embed page - for Twitter Player Card */}
      <Route path="/embed/:id" element={<VideoEmbedPage />} />

      {/* Template Guide page - SEO optimized user guides */}
      <Route path="/guide/:slug" element={<Layout><TemplateGuidePage /></Layout>} />

      {/* Auth routes */}
      <Route path="/signin" element={<Layout><SignInForm /></Layout>} />
      <Route path="/signup" element={<Layout><SignUpForm /></Layout>} />
      <Route path="/forgot-password" element={<Layout><ForgotPasswordForm /></Layout>} />
      <Route path="/reset-password" element={<Layout><ResetPasswordForm /></Layout>} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Public profile route */}
      <Route path="/profile/:username" element={<Layout><PublicProfilePage /></Layout>} />

      {/* Legal pages */}
      <Route path="/privacy" element={<Layout><PrivacyPolicyPage /></Layout>} />
      <Route path="/terms" element={<Layout><TermsOfServicePage /></Layout>} />
      <Route path="/cookies" element={<Layout><CookiePolicyPage /></Layout>} />

      {/* Help Center */}
      <Route path="/help" element={<Layout><HelpCenterPage /></Layout>} />

      {/* 🚀 测试页面 (仅开发环境加载) */}
      {import.meta.env.DEV && (
        <>
          <Route path="/test/apicore" element={<Layout><TestApicoreApi /></Layout>} />
          <Route path="/test/analytics" element={<Layout><TestAnalytics /></Layout>} />
          <Route path="/test/device" element={<Layout><DeviceTestPage /></Layout>} />
          <Route path="/test/video-player" element={<Layout><VideoPlayerTestPage /></Layout>} />
          <Route path="/test/video-loading" element={<Layout><VideoPlayerLoadingTestPage /></Layout>} />
          <Route path="/video-player-test" element={<Layout><VideoPlayerControlsTestPage /></Layout>} />
          <Route path="/cache-management" element={<Layout><CacheManagementPage /></Layout>} />
          <Route path="/test/thumbnails" element={<Layout><ThumbnailTestPage /></Layout>} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/test-veo" element={<Layout><TestVeoApi /></Layout>} />
          <Route path="/test-wuyin" element={<Layout><TestWuyinApi /></Layout>} />
          <Route path="/test-watermark" element={<Layout><TestWatermark /></Layout>} />
          <Route path="/test-watermark-simple" element={<Layout><SimpleWatermarkTest /></Layout>} />
          <Route path="/test-ai-content" element={<Layout><TestAIContent /></Layout>} />
          <Route path="/simple-ai-test" element={<SimpleAITest />} />
          <Route path="/title-effects" element={<TitleEffectDemo />} />
        </>
      )}

      {/* Translation tool (temporarily unprotected for testing) */}
      <Route path="/translation" element={<Layout showFooter={false}><TemplateTranslationPage /></Layout>} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/create" element={<Layout showFooter={false}><VideoCreator /></Layout>} />
        <Route path="/videos" element={<Layout><VideosPage /></Layout>} />
        <Route path="/profile" element={<Layout><UserCenterPage /></Layout>} />
        <Route path="/profile/edit" element={<Layout><ProfileEditPage /></Layout>} />
        <Route path="/profile/templates" element={<Layout><MyTemplatesPage /></Layout>} />
        <Route path="/profile/settings" element={<Layout><AccountSettingsPage /></Layout>} />
        {/* 仅登录用户可用的管理工具（保护路由） */}
        <Route path="/admin/force-thumbnail" element={<Layout><ForceThumbnailPage /></Layout>} />
        <Route path="/admin/batch-blur-thumbnails" element={<Layout><BatchBlurThumbnailsPage /></Layout>} />
      </Route>

      {/* 🚀 管理后台路由 - 独立chunk,懒加载 */}
      <Route path="/admin/*" element={
        <AdminRoute>
          <AdminApp />
        </AdminRoute>
      } />
      </Routes>
    </>
  )
}

export default App
