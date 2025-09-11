/**
 * 视频下载保护机制测试页面
 */

import { useState, useContext } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import LazyVideoPlayer from '@/components/video/LazyVideoPlayer'
import ProtectedDownloadService from '@/services/protectedDownloadService'
import { AuthContext } from '@/contexts/AuthContext'
import { Shield, Download, AlertTriangle, CheckCircle } from 'lucide-react'

export default function TestProtection() {
  const authContext = useContext(AuthContext)
  const user = authContext?.user
  const [testResults, setTestResults] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  
  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
    console.log(`[ProtectionTest] ${message}`)
  }
  
  // 测试视频信息
  const testVideo = {
    id: 'test-video-123',
    title: 'Coffee Machine Art',
    url: '/templates/videos/art-coffee-machine.mp4'
  }

  const handleTestDownload = async () => {
    if (!user) {
      addResult('❌ 用户未登录，无法测试')
      return
    }

    setIsProcessing(true)
    setTestResults([])
    
    try {
      addResult('🧪 开始测试受保护下载...')
      
      // 检查用户下载权限
      const hasPermission = await ProtectedDownloadService.hasDownloadPermission(user.id)
      const downloadType = await ProtectedDownloadService.getDownloadType(user.id)
      
      addResult(`👤 当前用户ID: ${user.id}`)
      addResult(`🔑 下载权限: ${hasPermission ? '付费用户' : '免费用户'}`)
      addResult(`📁 下载类型: ${downloadType === 'original' ? '原视频' : '带水印'}`)
      
      // 执行下载测试
      await ProtectedDownloadService.downloadVideo(
        user.id,
        testVideo.id,
        testVideo.url,
        testVideo.title,
        {
          onComplete: () => {
            addResult('✅ 下载完成！')
          },
          onError: (error) => {
            addResult(`❌ 下载失败: ${error}`)
          }
        }
      )
      
    } catch (error) {
      addResult(`❌ 测试失败: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const testVideoPlayerDownload = () => {
    if (!user) {
      addResult('❌ 用户未登录，无法测试视频播放器下载')
      return
    }
    addResult('ℹ️ 请点击视频播放器右下角的下载按钮测试集成功能')
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-500" />
          视频下载保护机制测试
        </h1>
        <p className="text-muted-foreground">
          测试完整的防水印绕过机制，包括统一下载服务和播放器保护
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：测试视频 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>测试视频播放器</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video mb-4">
                <LazyVideoPlayer
                  src={testVideo.url}
                  className="w-full h-full rounded-lg"
                  objectFit="cover"
                  showPlayButton={true}
                  showVolumeControl={true}
                  autoPlayOnHover={false}
                  userId={user?.id}
                  videoId={testVideo.id}
                  videoTitle={testVideo.title}
                  enableDownloadProtection={true}
                  enableLazyLoad={true}
                  enableThumbnailCache={true}
                />
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary">✅ 右键菜单已禁用</Badge>
                <Badge variant="secondary">✅ 浏览器下载按钮已隐藏</Badge>
                <Badge variant="secondary">✅ 画中画已禁用</Badge>
                <Badge variant="secondary">✅ 统一下载服务</Badge>
              </div>
              
              <Button 
                onClick={testVideoPlayerDownload}
                variant="outline"
                className="w-full"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                测试播放器下载保护
              </Button>
            </CardContent>
          </Card>

          {/* 用户状态 */}
          <Card>
            <CardHeader>
              <CardTitle>当前用户状态</CardTitle>
            </CardHeader>
            <CardContent>
              {user ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>用户ID:</span>
                    <code className="text-sm">{user.id}</code>
                  </div>
                  <div className="flex justify-between">
                    <span>邮箱:</span>
                    <span>{user.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>登录状态:</span>
                    <Badge variant="default">已登录</Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                  <p>请先登录以测试下载保护功能</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：测试控制和日志 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>保护机制测试</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleTestDownload}
                disabled={isProcessing || !user}
                size="lg"
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    测试中...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    测试统一下载服务
                  </>
                )}
              </Button>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Badge variant="outline">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  订阅检查
                </Badge>
                <Badge variant="outline">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  水印应用
                </Badge>
                <Badge variant="outline">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  格式检测
                </Badge>
                <Badge variant="outline">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  错误处理
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* 测试日志 */}
          <Card>
            <CardHeader>
              <CardTitle>测试日志</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                {testResults.length === 0 ? (
                  <div className="text-gray-500">点击测试按钮开始...</div>
                ) : (
                  testResults.map((result, index) => (
                    <div key={index} className="break-all">
                      {result}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* 安全说明 */}
          <Card>
            <CardHeader>
              <CardTitle>保护机制说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded">
                <p className="font-semibold text-green-800 dark:text-green-200">✅ 已实现的保护:</p>
                <ul className="list-disc list-inside text-green-700 dark:text-green-300 mt-1 space-y-1">
                  <li>统一下载服务管理</li>
                  <li>视频播放器集成保护</li>
                  <li>禁用浏览器下载控件</li>
                  <li>禁用右键菜单</li>
                  <li>自动订阅状态检查</li>
                </ul>
              </div>
              
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded">
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">⚠️ 注意事项:</p>
                <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                  前端保护无法100%防止技术用户绕过，完整的保护需要服务端DRM和签名URL。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}