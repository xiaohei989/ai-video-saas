/**
 * 视频播放器加载动画测试页面
 * 测试移动端和桌面端的加载状态显示
 */

import React, { useState } from 'react'
import { ReactVideoPlayer } from '@/components/video/ReactVideoPlayer'
import { Button } from '@/components/ui/button'
import { RefreshCw, Smartphone, Monitor } from 'lucide-react'
import { CDN_CONFIG } from '@/config/cdnConfig'

export default function VideoPlayerLoadingTestPage() {
  const [testVideoUrl, setTestVideoUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [forceDesktop, setForceDesktop] = useState(false)
  const [forceMobile, setForceMobile] = useState(false)

  // 测试视频URLs
  const testVideos = [
    {
      name: '测试视频1 (快速加载)',
      url: `https://${CDN_CONFIG.r2.domain}/videos/test-video-1.mp4`,
      thumbnail: `https://${CDN_CONFIG.r2.domain}/thumbnails/test-1.jpg`
    },
    {
      name: '测试视频2 (慢速加载)',
      url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      thumbnail: 'https://sample-videos.com/zip/10/jpg/SampleJPGImage_1280x720_1mb.jpg'
    },
    {
      name: '测试视频3 (大文件)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg'
    }
  ]

  const handleVideoSelect = (video: any) => {
    setTestVideoUrl(video.url)
    setThumbnailUrl(video.thumbnail)
  }

  const handleRefresh = () => {
    // 强制刷新视频播放器
    const currentUrl = testVideoUrl
    const currentThumbnail = thumbnailUrl
    setTestVideoUrl('')
    setThumbnailUrl('')
    setTimeout(() => {
      setTestVideoUrl(currentUrl)
      setThumbnailUrl(currentThumbnail)
    }, 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            视频播放器加载动画测试
          </h1>
          <p className="text-gray-600">
            测试移动端和桌面端的统一加载动画效果
          </p>
        </div>

        {/* 控制面板 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex flex-wrap gap-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 w-full">
              测试控制
            </h3>
            
            {/* 设备模式切换 */}
            <div className="flex gap-2">
              <Button
                variant={forceMobile ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setForceMobile(!forceMobile)
                  setForceDesktop(false)
                }}
                className="flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                强制移动端
              </Button>
              <Button
                variant={forceDesktop ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setForceDesktop(!forceDesktop)
                  setForceMobile(false)
                }}
                className="flex items-center gap-2"
              >
                <Monitor className="w-4 h-4" />
                强制桌面端
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                刷新播放器
              </Button>
            </div>
          </div>

          {/* 测试视频选择 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testVideos.map((video, index) => (
              <Button
                key={index}
                variant={testVideoUrl === video.url ? "default" : "outline"}
                onClick={() => handleVideoSelect(video)}
                className="h-auto p-4 text-left justify-start"
              >
                <div>
                  <div className="font-medium">{video.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {video.url.substring(0, 40)}...
                  </div>
                </div>
              </Button>
            ))}
          </div>

          {/* 自定义URL输入 */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                自定义视频URL
              </label>
              <input
                type="url"
                value={testVideoUrl}
                onChange={(e) => setTestVideoUrl(e.target.value)}
                placeholder="输入视频URL..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                缩略图URL
              </label>
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="输入缩略图URL..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 视频播放器测试区域 */}
        {testVideoUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 移动端样式播放器 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                移动端效果
              </h3>
              <div 
                className="aspect-video bg-gray-100 rounded-lg overflow-hidden"
                style={{ 
                  maxWidth: forceMobile ? '375px' : '100%',
                  margin: forceMobile ? '0 auto' : '0'
                }}
              >
                <ReactVideoPlayer
                  key={`mobile-${testVideoUrl}-${Date.now()}`}
                  videoUrl={testVideoUrl}
                  thumbnailUrl={thumbnailUrl}
                  autoplay={false}
                  muted={true}
                  controls={false}
                  className="w-full h-full"
                  onPlay={() => console.log('移动端播放器: 开始播放')}
                  onPause={() => console.log('移动端播放器: 暂停播放')}
                  onReady={() => console.log('移动端播放器: 准备完成')}
                  onError={(error) => console.error('移动端播放器错误:', error)}
                />
              </div>
            </div>

            {/* 桌面端样式播放器 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                桌面端效果
              </h3>
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <ReactVideoPlayer
                  key={`desktop-${testVideoUrl}-${Date.now()}`}
                  videoUrl={testVideoUrl}
                  thumbnailUrl={thumbnailUrl}
                  autoplay={false}
                  muted={true}
                  controls={false}
                  autoPlayOnHover={true}
                  className="w-full h-full"
                  onPlay={() => console.log('桌面端播放器: 开始播放')}
                  onPause={() => console.log('桌面端播放器: 暂停播放')}
                  onReady={() => console.log('桌面端播放器: 准备完成')}
                  onError={(error) => console.error('桌面端播放器错误:', error)}
                />
              </div>
            </div>
          </div>
        )}

        {!testVideoUrl && (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-gray-400 mb-4">
              <Monitor className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg">请选择或输入测试视频URL</p>
              <p className="text-sm">选择上方的测试视频或输入自定义URL开始测试</p>
            </div>
          </div>
        )}

        {/* 测试说明 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-blue-900 mb-3">
            测试说明
          </h4>
          <div className="text-blue-800 space-y-2 text-sm">
            <div>• <strong>加载动画:</strong> 视频加载时会显示旋转的Loader图标</div>
            <div>• <strong>播放按钮:</strong> 视频准备好后显示播放按钮</div>
            <div>• <strong>移动端:</strong> 较大的播放按钮和触摸优化</div>
            <div>• <strong>桌面端:</strong> 较小的播放按钮和悬停效果</div>
            <div>• <strong>错误处理:</strong> 加载失败时会显示播放按钮供重试</div>
            <div>• <strong>响应式:</strong> 根据设备类型自动调整UI</div>
          </div>
        </div>
      </div>
    </div>
  )
}