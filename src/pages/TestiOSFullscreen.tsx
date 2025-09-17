/**
 * iOS全屏播放测试页面
 * 用于验证和调试iOS Safari全屏功能
 */

import React, { useState } from 'react'
import VideoPlayer from '@/components/video/VideoPlayer'
import SimpleVideoPlayer from '@/components/video/SimpleVideoPlayer'
import { detectDeviceCapabilities, getFullscreenState, supportsFullscreen } from '@/utils/fullscreenHelper'
import { Button } from '@/components/ui/button'

export default function TestiOSFullscreen() {
  const [deviceInfo] = useState(detectDeviceCapabilities())
  const [fullscreenState, setFullscreenState] = useState(getFullscreenState())
  
  // 测试视频URL（确保跨域兼容）
  const testVideoSrc = "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"
  const testPoster = "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.jpg"

  // 刷新全屏状态
  const refreshState = () => {
    setFullscreenState(getFullscreenState())
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">iOS 全屏播放测试</h1>
          <p className="text-muted-foreground">
            测试和调试iOS Safari视频全屏功能
          </p>
        </div>

        {/* 设备信息面板 */}
        <div className="bg-card rounded-lg p-6 border">
          <h2 className="text-xl font-semibold mb-4">设备和浏览器信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium">设备类型</div>
              <div className={deviceInfo.isiOS ? 'text-green-600' : 'text-orange-600'}>
                iOS 设备: {deviceInfo.isiOS ? '是' : '否'}
              </div>
              <div className={deviceInfo.isiOSChrome ? 'text-blue-600' : 'text-gray-500'}>
                iOS Chrome: {deviceInfo.isiOSChrome ? '是' : '否'}
              </div>
              <div className={deviceInfo.isiOSSafari ? 'text-purple-600' : 'text-gray-500'}>
                iOS Safari: {deviceInfo.isiOSSafari ? '是' : '否'}
              </div>
              <div className={deviceInfo.isMobile ? 'text-green-600' : 'text-gray-500'}>
                移动设备: {deviceInfo.isMobile ? '是' : '否'}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium">全屏API支持</div>
              <div className={deviceInfo.supportsWebkitFullscreen ? 'text-green-600' : 'text-red-600'}>
                Webkit 全屏: {deviceInfo.supportsWebkitFullscreen ? '支持' : '不支持'}
              </div>
              <div className={deviceInfo.supportsStandardFullscreen ? 'text-green-600' : 'text-red-600'}>
                标准全屏: {deviceInfo.supportsStandardFullscreen ? '支持' : '不支持'}
              </div>
              <div className={supportsFullscreen() ? 'text-green-600' : 'text-red-600'}>
                整体支持: {supportsFullscreen() ? '支持' : '不支持'}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium">当前全屏状态</div>
              <div className={fullscreenState.isFullscreen ? 'text-green-600' : 'text-gray-500'}>
                全屏状态: {fullscreenState.isFullscreen ? '已全屏' : '非全屏'}
              </div>
              <div className="text-blue-600">
                使用方法: {fullscreenState.method}
              </div>
              <div className="text-purple-600">
                全屏元素: {fullscreenState.element ? '有' : '无'}
              </div>
              <Button size="sm" onClick={refreshState} className="mt-2">
                刷新状态
              </Button>
            </div>
          </div>
        </div>

        {/* 用户代理信息 */}
        <div className="bg-card rounded-lg p-6 border">
          <h2 className="text-xl font-semibold mb-4">User Agent 信息</h2>
          <div className="bg-muted p-4 rounded text-sm font-mono break-all">
            {navigator.userAgent}
          </div>
        </div>

        {/* 测试说明 */}
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
          <h2 className="text-xl font-semibold mb-4 text-blue-800 dark:text-blue-200">测试说明</h2>
          <div className="space-y-2 text-blue-700 dark:text-blue-300">
            {deviceInfo.isiOS ? (
              <>
                <p>✅ <strong>iOS设备检测成功</strong></p>
                <p>📱 请尝试以下操作来测试全屏功能：</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>点击视频播放按钮开始播放</li>
                  <li>点击右下角的全屏按钮（Maximize图标）</li>
                  <li>观察是否进入iOS原生全屏播放界面</li>
                  <li>在全屏界面中通过手势或原生控制条退出全屏</li>
                </ul>
                <p>🔍 <strong>预期行为</strong>：点击全屏按钮后，视频应该进入iOS原生的全屏播放模式</p>
              </>
            ) : (
              <>
                <p>ℹ️ <strong>非iOS设备</strong></p>
                <p>🖥️ 在此设备上将使用标准的Fullscreen API：</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>点击全屏按钮将使整个视频容器进入全屏</li>
                  <li>按 ESC 键或再次点击全屏按钮退出</li>
                </ul>
              </>
            )}
          </div>
        </div>

        {/* VideoPlayer 测试 */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">VideoPlayer 组件测试</h2>
          <div className="bg-card rounded-lg p-6 border">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                完整功能的视频播放器，包含进度条、音量控制、下载和分享功能
              </div>
              <div className="aspect-video max-w-2xl">
                <VideoPlayer
                  src={testVideoSrc}
                  poster={testPoster}
                  showPlayButton={true}
                  showVolumeControl={true}
                  autoPlayOnHover={false}
                  videoId="test-video-player"
                  videoTitle="测试视频 - VideoPlayer"
                  className="w-full h-full rounded-lg overflow-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SimpleVideoPlayer 测试 */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">SimpleVideoPlayer 组件测试</h2>
          <div className="bg-card rounded-lg p-6 border">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                简化版视频播放器，专注于性能和基本播放功能
              </div>
              <div className="aspect-video max-w-2xl">
                <SimpleVideoPlayer
                  src={testVideoSrc}
                  poster={testPoster}
                  showPlayButton={true}
                  autoPlayOnHover={false}
                  videoId="test-simple-player"
                  videoTitle="测试视频 - SimpleVideoPlayer"
                  className="w-full h-full rounded-lg overflow-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 调试信息 */}
        <div className="bg-card rounded-lg p-6 border">
          <h2 className="text-xl font-semibold mb-4">调试信息</h2>
          <div className="space-y-4 text-sm">
            <div>
              <div className="font-medium mb-2">浏览器全屏API检测</div>
              <div className="bg-muted p-4 rounded font-mono">
                <div>document.fullscreenElement: {typeof document.fullscreenElement}</div>
                <div>document.exitFullscreen: {typeof document.exitFullscreen}</div>
                <div>Element.requestFullscreen: {typeof document.createElement('div').requestFullscreen}</div>
                {deviceInfo.isiOS && (
                  <>
                    <div className="mt-2 text-blue-600">iOS 专用 API:</div>
                    <div>webkitEnterFullscreen: {typeof document.createElement('video').webkitEnterFullscreen}</div>
                    <div>webkitExitFullscreen: {typeof document.createElement('video').webkitExitFullscreen}</div>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <div className="font-medium mb-2">视频元素属性</div>
              <div className="bg-muted p-4 rounded font-mono">
                <div>playsInline: 已启用</div>
                <div>controls: 已禁用（使用自定义控制栏）</div>
                <div>preload: metadata</div>
                <div>crossOrigin: anonymous</div>
              </div>
            </div>
          </div>
        </div>

        {/* 故障排除 */}
        <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
          <h2 className="text-xl font-semibold mb-4 text-yellow-800 dark:text-yellow-200">故障排除</h2>
          <div className="space-y-3 text-yellow-700 dark:text-yellow-300">
            <div>
              <strong>iOS Safari 全屏不工作？</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>确保视频已经开始播放</li>
                <li>确保通过用户手势触发全屏（不能自动触发）</li>
                <li>检查是否有JavaScript错误</li>
                <li>尝试重新加载页面</li>
              </ul>
            </div>
            <div>
              <strong>其他浏览器全屏问题？</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>检查浏览器是否支持Fullscreen API</li>
                <li>确保页面是HTTPS或localhost</li>
                <li>检查是否有其他元素已经在全屏状态</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}