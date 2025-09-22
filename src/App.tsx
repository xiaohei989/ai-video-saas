import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './contexts/AuthContext'
import { VideoPlaybackProvider } from './contexts/VideoPlaybackContext'
import { Layout } from './components/layout/Layout'
import FullScreenLayout from './components/layout/FullScreenLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { Toaster } from '@/components/ui/sonner'
import EnvironmentIndicator from './components/stripe/EnvironmentIndicator'
import TemplateSync from './components/system/TemplateSync'
import CookieConsentBanner from './components/common/CookieConsentBanner'
import analyticsService from './services/analyticsService'
import { csrfService } from './services/csrfService'
import { securityMonitor } from './services/securityMonitorService'
import { validateSecurityConfig } from './config/security'
import redisCacheIntegrationService from './services/RedisCacheIntegrationService'
import RoutePreloader from './components/preload/RoutePreloader'

// 调试工具（开发环境）
if (process.env.NODE_ENV === 'development') {
  import('./utils/debugSupabase')
  // 模版热重载已禁用 - 解决页面卡住问题
  // import('./utils/templateHotReload').then(({ templateHotReload }) => {
  //   // 延迟启动热重载，确保应用完全初始化
  //   setTimeout(() => {
  //     templateHotReload.start()
  //   }, 3000)
  // })
}
import HomePage from './pages/HomePage'
import VideoCreator from './features/video-creator/components/VideoCreator'
import TemplatesPage from './pages/TemplatesPage'
import VideosPage from './pages/VideosPageNew'
import PricingPage from './pages/PricingPage'
import TestPage from './pages/TestPage'
import TestVeoApi from './pages/TestVeoApi'
import TitleEffectDemo from './pages/TitleEffectDemo'
import TestWatermark from './pages/TestWatermark'
import SimpleWatermarkTest from './pages/SimpleWatermarkTest'

// Auth pages
import SignInForm from './components/auth/SignInForm'
import SignUpForm from './components/auth/SignUpForm'
import ForgotPasswordForm from './components/auth/ForgotPasswordForm'
import ResetPasswordForm from './components/auth/ResetPasswordForm'
import AuthCallback from './pages/auth/AuthCallback'

// Profile pages
import UserCenterPage from './pages/profile/UserCenterPage'
import ProfileEditPage from './pages/profile/ProfileEditPage'
import PublicProfilePage from './pages/profile/PublicProfilePage'
import MyTemplatesPage from './pages/profile/MyTemplatesPage'
import AccountSettingsPage from './pages/profile/AccountSettingsPage'

// Legal pages
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage'
import TermsOfServicePage from './pages/legal/TermsOfServicePage'
import CookiePolicyPage from './pages/legal/CookiePolicyPage'

// Help Center
import HelpCenterPage from './pages/HelpCenterPage'

// Test pages
import TestApicoreApi from './pages/TestApicoreApi'
import TestAnalytics from './pages/TestAnalytics'
import TestAIContent from './pages/TestAIContent'
import VideoDetailPage from './pages/VideoDetailPage'
import VideoEmbedPage from './pages/VideoEmbedPage'
import SimpleAITest from './pages/SimpleAITest'

// Admin pages
import AdminRoute from './components/admin/AdminRoute'
import AdminApp from './components/admin/AdminApp'

// Translation pages
import TemplateTranslationPage from './features/translation/TemplateTranslationPage'

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
            <VideoPlaybackProvider>
              <RoutePreloader />
              <TemplateSync />
              <Routes>
              {/* Public routes */}
              <Route path="/" element={<FullScreenLayout><HomePage /></FullScreenLayout>} />
              <Route path="/templates" element={<Layout><TemplatesPage /></Layout>} />
              <Route path="/pricing" element={<Layout><PricingPage /></Layout>} />
              
              {/* Video detail page - public access for sharing */}
              <Route path="/video/:id" element={<Layout><VideoDetailPage /></Layout>} />
              
              {/* Video embed page - for Twitter Player Card */}
              <Route path="/embed/:id" element={<VideoEmbedPage />} />
              
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
              
              {/* Test pages (development only) */}
              <Route path="/test/apicore" element={<Layout><TestApicoreApi /></Layout>} />
              <Route path="/test/analytics" element={<Layout><TestAnalytics /></Layout>} />
              
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
              </Route>
              
              {/* Admin routes - Let React-Admin handle all admin routing */}
              <Route path="/admin/*" element={
                <AdminRoute>
                  <AdminApp />
                </AdminRoute>
              } />
              
              {/* Test routes */}
              <Route path="/test" element={<TestPage />} />
              <Route path="/test-veo" element={<Layout><TestVeoApi /></Layout>} />
              <Route path="/test-watermark" element={<Layout><TestWatermark /></Layout>} />
              <Route path="/test-watermark-simple" element={<Layout><SimpleWatermarkTest /></Layout>} />
              <Route path="/test-ai-content" element={<Layout><TestAIContent /></Layout>} />
              <Route path="/simple-ai-test" element={<SimpleAITest />} />
              <Route path="/title-effects" element={<TitleEffectDemo />} />
              </Routes>
              <Toaster />
              <EnvironmentIndicator />
              <CookieConsentBanner />
            </VideoPlaybackProvider>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App