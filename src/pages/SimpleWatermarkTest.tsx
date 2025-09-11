/**
 * 简单的水印测试页面
 */

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import WatermarkService from '@/services/watermarkService'

export default function SimpleWatermarkTest() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLog(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(`[WatermarkTest] ${message}`)
  }
  
  const handleTest = async () => {
    setIsProcessing(true)
    setLog([])
    
    try {
      addLog('🎬 开始测试水印功能...')
      
      // 检查浏览器支持
      if (!WatermarkService.isSupported()) {
        addLog('❌ 浏览器不支持水印功能')
        return
      }
      addLog('✅ 浏览器支持检查通过')
      
      // 检查支持的最佳格式
      const bestFormat = WatermarkService.getBestVideoFormat()
      addLog(`📹 最佳输出格式: ${bestFormat.format} (.${bestFormat.extension})`)
      addLog(`🔧 使用编码: ${bestFormat.mimeType}`)
      
      // 测试视频URL
      const testVideoUrl = '/templates/videos/art-coffee-machine.mp4'
      addLog(`📁 使用测试视频: ${testVideoUrl}`)
      
      // 开始处理
      addLog('⚙️ 开始添加水印...')
      const startTime = Date.now()
      
      const watermarkedBlob = await WatermarkService.addWatermarkToVideo(testVideoUrl)
      
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(1)
      addLog(`✅ 水印处理完成！耗时: ${processingTime}秒`)
      addLog(`📊 生成的视频大小: ${(watermarkedBlob.size / 1024 / 1024).toFixed(2)} MB`)
      addLog(`📄 视频格式: ${watermarkedBlob.type}`)
      addLog(`🎵 音频状态: ${watermarkedBlob.type.includes('audio') ? '包含音频' : '需要验证音频'}`)
      
      // 下载文件
      const filename = `test-watermark-${Date.now()}.${bestFormat.extension}`
      WatermarkService.createDownloadUrl(watermarkedBlob, filename)
      addLog(`🎉 开始下载: ${filename}`)
      addLog(`🔊 请播放下载的视频检查是否有声音`)
      
    } catch (error) {
      addLog(`❌ 错误: ${error instanceof Error ? error.message : String(error)}`)
      console.error('Water mark test error:', error)
    } finally {
      setIsProcessing(false)
    }
  }
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">水印功能测试</h1>
      
      {/* 原始视频预览 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">原始测试视频</h2>
        <video 
          ref={videoRef}
          src="/templates/videos/art-coffee-machine.mp4"
          controls
          className="w-full max-w-md rounded-lg"
          style={{ maxHeight: '300px' }}
        />
      </div>
      
      {/* 测试按钮 */}
      <div className="mb-6">
        <Button 
          onClick={handleTest}
          disabled={isProcessing}
          size="lg"
          className="w-full sm:w-auto"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              处理中...
            </>
          ) : (
            '🎬 添加水印并下载'
          )}
        </Button>
      </div>
      
      {/* 日志输出 */}
      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
        <h3 className="text-white font-bold mb-2">处理日志:</h3>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {log.length === 0 ? (
            <div className="text-gray-500">点击按钮开始测试...</div>
          ) : (
            log.map((entry, index) => (
              <div key={index} className="break-all">
                {entry}
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* 说明 */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          测试说明
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• 此测试将在视频右下角添加 "veo3video.me" 水印</li>
          <li>• 优先输出 MP4 格式（如果浏览器支持H264编码）</li>
          <li>• 处理时间取决于视频长度和设备性能</li>
          <li>• 建议在现代浏览器中测试（Chrome/Firefox 最新版）</li>
        </ul>
      </div>
    </div>
  )
}