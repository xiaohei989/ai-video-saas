import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight, Volume2, VolumeX } from 'lucide-react'
import BackgroundVideo from '@/components/video/BackgroundVideo'
import AnimatedHeroTitle from '@/components/ui/AnimatedHeroTitle'
import { defaultBackgroundVideoConfig } from '@/config/backgroundVideos'

export default function HomePage() {
  const { t } = useTranslation()
  const [isMuted, setIsMuted] = useState(true)
  const videoRef = useRef<any>(null)

  // 静音切换处理
  const handleMuteToggle = () => {
    console.log('切换静音状态:', !isMuted)
    setIsMuted(!isMuted)
  }

  return (
    <div className="relative min-h-screen">
      {/* Background Video - 使用模板视频随机播放 */}
      <BackgroundVideo
        ref={videoRef}
        videos={defaultBackgroundVideoConfig.videos.map(v => v.src)}
        fallbackImage="/logo.png"
        className="fixed inset-0 z-0"
        autoPlay={defaultBackgroundVideoConfig.settings.autoPlay}
        loop={defaultBackgroundVideoConfig.settings.loop}
        muted={isMuted}
        enablePlaylist={defaultBackgroundVideoConfig.settings.enablePlaylist}
        playlistInterval={defaultBackgroundVideoConfig.settings.playlistInterval}
        shufflePlaylist={defaultBackgroundVideoConfig.settings.shufflePlaylist}
        overlayOpacity={defaultBackgroundVideoConfig.settings.overlayOpacity}
        overlayColor={defaultBackgroundVideoConfig.settings.overlayColor}
        enableGradient={defaultBackgroundVideoConfig.settings.enableGradient}
        gradientDirection={defaultBackgroundVideoConfig.settings.gradientDirection}
        showControls={false}
        allowUserControl={true}
        enableMobileOptimization={true}
      />

      {/* Main Content */}
      <div className="relative z-10 space-y-12 py-8">
        {/* Hero Section with animations */}
        <section className="text-center space-y-8 animate-in fade-in duration-700">
          <AnimatedHeroTitle
            text={t('app.title')}
            effectType="flowing"
            size="xl"
            className="mb-8"
            enableHover={true}
            enableBreathing={false}
            animationSpeed="normal"
            glowIntensity="medium"
          />
          <p className="text-3xl text-white/90 max-w-2xl mx-auto drop-shadow-md font-handwriting italic">
            {t('app.tagline')}
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/create">
              <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm">
                {t('template.selectTemplate')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm">
                {t('nav.pricing')}
              </Button>
            </Link>
          </div>
        </section>

      </div>

      {/* 静音切换按钮 - 右下角固定位置 */}
      <button
        onClick={handleMuteToggle}
        className="fixed bottom-6 right-6 z-20 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label={isMuted ? "取消静音" : "静音"}
      >
        {isMuted ? (
          <VolumeX className="h-6 w-6" />
        ) : (
          <Volume2 className="h-6 w-6" />
        )}
      </button>
    </div>
  )
}