/**
 * 设备检测测试页面
 * 用于验证分辨率判断是否正常工作
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useResponsiveDevice, detectDeviceHybrid, supportsHover, isTouchDevice } from '@/utils/deviceDetection'
import { detectDeviceCapabilities } from '@/utils/fullscreenHelper'

export default function DeviceTestPage() {
  const responsiveDevice = useResponsiveDevice()
  const [hybridInfo, setHybridInfo] = useState(detectDeviceHybrid())
  const [oldDetection, setOldDetection] = useState(detectDeviceCapabilities())
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
      setHybridInfo(detectDeviceHybrid())
      setOldDetection(detectDeviceCapabilities())
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const getDeviceTypeColor = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return 'bg-red-500'
      case 'tablet': return 'bg-yellow-500'
      case 'desktop': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">设备检测测试页面</h1>
        <p className="text-muted-foreground">调整浏览器窗口大小来测试响应式设备检测</p>
      </div>

      {/* 当前窗口尺寸 */}
      <Card>
        <CardHeader>
          <CardTitle>当前窗口尺寸</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-mono">
            {windowSize.width} × {windowSize.height}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            调整浏览器窗口大小查看实时变化
          </div>
        </CardContent>
      </Card>

      {/* 响应式设备检测 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            新的响应式检测
            <Badge className={getDeviceTypeColor(responsiveDevice.deviceType)}>
              {responsiveDevice.deviceType.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${responsiveDevice.isMobile ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>移动端: {responsiveDevice.isMobile ? '是' : '否'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${responsiveDevice.isTablet ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>平板: {responsiveDevice.isTablet ? '是' : '否'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${responsiveDevice.isDesktop ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>桌面端: {responsiveDevice.isDesktop ? '是' : '否'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${responsiveDevice.hasTouch ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>触摸支持: {responsiveDevice.hasTouch ? '是' : '否'}</span>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <div>分辨率断点: &lt;768px (移动端) | 768-1024px (平板) | ≥1024px (桌面端)</div>
          </div>
        </CardContent>
      </Card>

      {/* 混合检测对比 */}
      <Card>
        <CardHeader>
          <CardTitle>混合检测结果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">真实移动设备</h4>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${hybridInfo.isRealMobile ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>{hybridInfo.isRealMobile ? '是' : '否'}</span>
              </div>
              <div className="text-xs text-muted-foreground">基于User Agent检测</div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">模拟移动设备</h4>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${hybridInfo.isSimulatedMobile ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>{hybridInfo.isSimulatedMobile ? '是' : '否'}</span>
              </div>
              <div className="text-xs text-muted-foreground">分辨率小但非真实移动设备</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 旧的检测方法对比 */}
      <Card>
        <CardHeader>
          <CardTitle>原有User Agent检测</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${oldDetection.isMobile ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>移动端: {oldDetection.isMobile ? '是' : '否'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${oldDetection.isiOS ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>iOS: {oldDetection.isiOS ? '是' : '否'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${oldDetection.isiOSSafari ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>iOS Safari: {oldDetection.isiOSSafari ? '是' : '否'}</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <div>User Agent: {navigator.userAgent}</div>
          </div>
        </CardContent>
      </Card>

      {/* 交互能力检测 */}
      <Card>
        <CardHeader>
          <CardTitle>交互能力检测</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${supportsHover() ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>支持悬停: {supportsHover() ? '是' : '否'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isTouchDevice() ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>触摸设备: {isTouchDevice() ? '是' : '否'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 测试说明 */}
      <Card>
        <CardHeader>
          <CardTitle>测试指南</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <p><strong>桌面端模拟测试:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>将浏览器窗口调整到 <code>&lt;768px</code> 宽度，应该显示为移动端</li>
              <li>将窗口调整到 <code>768-1023px</code> 宽度，应该显示为平板（如果有触摸支持）</li>
              <li>将窗口调整到 <code>≥1024px</code> 宽度，应该显示为桌面端</li>
            </ul>
            
            <p><strong>视频播放行为:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>移动端: 不支持鼠标悬停播放，必须点击播放按钮</li>
              <li>桌面端: 支持鼠标悬停自动播放</li>
              <li>不支持悬停的设备: 即使分辨率大也不会自动播放</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 刷新按钮 */}
      <div className="text-center">
        <Button 
          onClick={() => {
            setHybridInfo(detectDeviceHybrid())
            setOldDetection(detectDeviceCapabilities())
          }}
        >
          刷新检测结果
        </Button>
      </div>
    </div>
  )
}