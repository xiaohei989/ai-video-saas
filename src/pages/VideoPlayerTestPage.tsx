/**
 * 视频播放器测试页面
 * 专门用于测试手机端播放按钮显示
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useResponsiveDevice } from '@/utils/deviceDetection'
import { ReactVideoPlayer } from '@/components/video/ReactVideoPlayer'

export default function VideoPlayerTestPage() {
  const { isMobile, deviceType, width } = useResponsiveDevice()

  // 测试视频数据
  const testVideos = [
    {
      id: 'test-1',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      poster: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=450&fit=crop&q=80',
      title: '桌面端悬浮自动播放测试',
      description: '桌面端鼠标悬浮会自动播放，移动端显示中间播放按钮',
      autoPlayOnHover: !isMobile
    },
    {
      id: 'test-2', 
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      poster: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=450&fit=crop&q=80',
      title: '点击播放测试',
      description: '禁用悬浮播放，只能点击播放',
      autoPlayOnHover: false // 强制不自动播放
    },
    {
      id: 'test-3',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      poster: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=450&fit=crop&q=80',
      title: '长视频控制测试',
      description: '测试播放控件显示和隐藏逻辑',
      autoPlayOnHover: !isMobile
    }
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">视频播放器测试</h1>
        <p className="text-muted-foreground">测试手机端播放按钮显示效果</p>
      </div>

      {/* 当前设备状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            设备状态
            <Badge variant={isMobile ? 'destructive' : 'default'}>
              {deviceType.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-semibold">宽度:</span> {width}px
            </div>
            <div>
              <span className="font-semibold">设备类型:</span> {deviceType}
            </div>
            <div>
              <span className="font-semibold">移动端:</span> {isMobile ? '是' : '否'}
            </div>
            <div>
              <span className="font-semibold">预期行为:</span> {isMobile ? '点击播放' : '悬停播放'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 测试说明 */}
      <Card>
        <CardHeader>
          <CardTitle>测试要点</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-red-600 mb-2">移动端 (&lt; 768px)</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>✅ 始终显示中间播放按钮（大尺寸）</li>
                <li>❌ 不响应鼠标悬停事件</li>
                <li>✅ 点击播放/暂停按钮控制播放</li>
                <li>✅ 播放时显示底部控制栏</li>
                <li>✅ 暂停时隐藏控制栏</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-green-600 mb-2">桌面端 (≥ 768px)</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>✅ 悬浮300ms后自动播放（如开启）</li>
                <li>✅ 鼠标离开时暂停（悬浮播放）</li>
                <li>✅ 播放时只显示播放按钮（暂停时）</li>
                <li>✅ 播放时显示底部控制栏</li>
                <li>✅ 控制栏3秒后自动隐藏</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 视频播放器测试 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {testVideos.map((video, index) => (
          <Card key={video.id} className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">
                {video.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {video.description}
              </p>
              <div className="flex gap-2">
                <Badge variant={video.autoPlayOnHover ? 'default' : 'secondary'}>
                  {video.autoPlayOnHover ? '支持悬停播放' : '仅点击播放'}
                </Badge>
                {isMobile && (
                  <Badge variant="destructive">
                    移动端模式
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="aspect-video bg-muted relative">
                <ReactVideoPlayer
                  src={video.src}
                  poster={video.poster}
                  className="w-full h-full"
                  autoPlayOnHover={video.autoPlayOnHover}
                  showPlayButton={true}
                  muted={false}
                  objectFit="cover"
                  videoId={video.id}
                  videoTitle={video.title}
                  alt={video.title}
                />
              </div>
              
              {/* 测试结果显示 */}
              <div className="p-4 bg-muted/30">
                <h5 className="font-semibold mb-2">测试检查点:</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isMobile ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>手机端应显示播放按钮</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${!isMobile && video.autoPlayOnHover ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>桌面端悬停时显示控制</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${!video.autoPlayOnHover ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>禁用自动播放时始终显示按钮</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 调试信息 */}
      <Card>
        <CardHeader>
          <CardTitle>调试信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2 font-mono bg-muted p-4 rounded">
            <div>window.innerWidth: {typeof window !== 'undefined' ? window.innerWidth : 'N/A'}</div>
            <div>isMobile: {isMobile.toString()}</div>
            <div>deviceType: {deviceType}</div>
            <div>userAgent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}