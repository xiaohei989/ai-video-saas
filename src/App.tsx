import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
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
import analyticsService from './services/analyticsService'

// 调试工具（开发环境）
if (process.env.NODE_ENV === 'development') {
  import('./utils/debugSupabase')
  import('./utils/templateHotReload').then(({ templateHotReload }) => {
    // 延迟启动热重载，确保应用完全初始化
    setTimeout(() => {
      templateHotReload.start()
    }, 3000)
  })
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
import TestProtection from './pages/TestProtection'

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

// Admin pages
import AdminRoute from './components/admin/AdminRoute'
import AdminApp from './components/admin/AdminApp'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})

function App() {
  // 初始化Google Analytics
  React.useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID
    if (measurementId) {
      analyticsService.initialize(measurementId)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <TemplateSync />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<FullScreenLayout><HomePage /></FullScreenLayout>} />
              <Route path="/templates" element={<Layout><TemplatesPage /></Layout>} />
              <Route path="/pricing" element={<Layout><PricingPage /></Layout>} />
              
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
              <Route path="/test-protection" element={<Layout><TestProtection /></Layout>} />
              <Route path="/title-effects" element={<TitleEffectDemo />} />
            </Routes>
            <Toaster />
            <EnvironmentIndicator />
            <CookieConsentBanner />
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App