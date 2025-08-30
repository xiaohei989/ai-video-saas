/**
 * 水印功能测试页面
 * 模拟免费用户下载视频时添加水印的功能
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import WatermarkService from '@/services/watermarkService'

export default function TestWatermark() {
  const [isProcessing, setIsProcessing] = useState(false)
  
  // 测试用的视频URL（使用public目录下的测试视频）
  const testVideoUrl = '/templates/videos/art-coffee-machine.mp4'
  
  const handleTestWatermark = async () => {
    console.log('开始测试水印功能...')
    
    // 检查浏览器支持
    if (!WatermarkService.isSupported()) {
      toast.error('您的浏览器不支持水印功能，请使用最新版Chrome或Firefox')
      return
    }
    
    setIsProcessing(true)
    
    // 显示处理中的提示
    toast.info('正在为视频添加水印，请稍候...', { 
      id: 'watermark-test',
      duration: 0 // 不自动关闭
    })
    
    try {
      console.log('调用水印服务处理视频:', testVideoUrl)
      
      // 添加水印
      const watermarkedBlob = await WatermarkService.addWatermarkToVideo(testVideoUrl)
      
      console.log('水印处理完成，生成的blob大小:', watermarkedBlob.size)
      
      // 创建下载
      const filename = `test-video-watermarked-${Date.now()}.webm`
      WatermarkService.createDownloadUrl(watermarkedBlob, filename)
      
      // 关闭处理提示，显示成功消息
      toast.dismiss('watermark-test')
      toast.success('带水印视频已生成，开始下载！', {
        duration: 4000
      })
      
      console.log('水印测试成功完成')
      
    } catch (error) {
      console.error('水印处理失败:', error)
      toast.dismiss('watermark-test')
      toast.error(`水印处理失败: ${error instanceof Error ? error.message : '未知错误'}`, {
        duration: 5000
      })
    } finally {
      setIsProcessing(false)
    }
  }
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">水印功能测试</h1>
        <p className="text-muted-foreground">
          这个页面用于测试免费用户下载视频时添加水印的功能
        </p>
      </div>
      
      <div className="grid gap-6">
        {/* 功能说明 */}
        <Card>
          <CardHeader>
            <CardTitle>功能说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  付费用户
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  直接下载无水印原视频
                </p>
              </div>
              
              <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                  免费用户
                </h3>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  下载带"veo3video.me"水印的视频
                </p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h3 className="font-semibold mb-2">水印样式</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 位置：视频右下角</li>
                <li>• 文字：veo3video.me</li>
                <li>• 透明度：70%</li>
                <li>• 颜色：白色带黑色阴影</li>
                <li>• 字体：14px Arial</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        
        {/* 测试区域 */}
        <Card>
          <CardHeader>
            <CardTitle>测试水印功能</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>注意：</strong>此测试将模拟免费用户的体验，为测试视频添加水印并下载。
                处理可能需要几秒钟到几分钟，取决于视频大小。
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={handleTestWatermark}
                disabled={isProcessing}
                size="lg"
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    处理中...
                  </>
                ) : (
                  '开始测试水印功能'
                )}
              </Button>
            </div>
            
            {/* 浏览器兼容性提示 */}
            <div className="text-xs text-muted-foreground">
              <p>
                <strong>浏览器支持：</strong>
                需要支持 MediaRecorder API 和 Canvas captureStream 的现代浏览器
                （推荐使用最新版 Chrome 或 Firefox）
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* 技术详情 */}
        <Card>
          <CardHeader>
            <CardTitle>技术实现</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>实现原理：</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>使用 HTML5 Video 元素加载原视频</li>
                <li>创建 Canvas 画布，逐帧绘制视频内容</li>
                <li>在每一帧的右下角绘制水印文字</li>
                <li>使用 MediaRecorder API 录制处理后的视频流</li>
                <li>生成 WebM 格式的带水印视频文件</li>
                <li>自动触发浏览器下载</li>
              </ol>
              
              <p className="mt-4"><strong>优势：</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>纯前端实现，无需服务器资源</li>
                <li>实时处理，用户体验良好</li>
                <li>支持自定义水印样式</li>
                <li>包含完整的错误处理机制</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}