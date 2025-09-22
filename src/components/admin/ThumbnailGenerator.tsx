import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Play, Pause, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

interface Video {
  id: string
  title: string
  video_url: string
  thumbnail_url?: string
  status: 'pending' | 'processing' | 'completed'
  originalStatus: string
}

interface ThumbnailGeneratorProps {
  className?: string
}

export default function ThumbnailGenerator({ className }: ThumbnailGeneratorProps) {
  const [videos, setVideos] = useState<Video[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  
  // 使用ref来跟踪处理状态，避免React状态更新延迟问题
  const processingRef = React.useRef(false)

  // 添加日志
  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('zh-CN')
    const logEntry = `[${timestamp}] ${message}`
    setLogs(prev => [...prev, logEntry])
    console.log(`[${type.toUpperCase()}] ${message}`)
  }

  // 加载视频列表
  const loadVideos = async () => {
    try {
      setIsLoading(true)
      addLog('🔍 正在加载视频列表...', 'info')

      const { data, error } = await supabase
        .from('videos')
        .select('id, title, thumbnail_url, video_url, status')
        .eq('status', 'completed') // 只处理已完成的视频
        .order('created_at', { ascending: false })
        .limit(20) // 限制数量

      if (error) {
        throw error
      }

      const processedVideos = data.map(video => ({
        ...video,
        status: video.thumbnail_url ? 'completed' : 'pending',
        originalStatus: video.thumbnail_url ? 'completed' : 'pending'
      }))

      setVideos(processedVideos)
      addLog(`✅ 成功加载 ${processedVideos.length} 个视频`, 'success')

      const pendingVideos = processedVideos.filter(v => v.status === 'pending')
      if (pendingVideos.length > 0) {
        addLog(`🎯 发现 ${pendingVideos.length} 个待处理视频`, 'info')
      } else {
        addLog('ℹ️ 没有需要处理的视频', 'warning')
      }

    } catch (error: any) {
      addLog(`❌ 加载失败: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // 本地Canvas提取视频缩略图
  const extractVideoThumbnail = async (videoUrl: string, frameTime = 0.1): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (!context) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      
      // CORS设置
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.playsInline = true
      
      // 监听视频加载元数据
      video.addEventListener('loadedmetadata', () => {
        // 设置画布尺寸（优化为16:9比例，320x180）
        canvas.width = 320
        canvas.height = 180
        
        // 跳转到指定时间点
        video.currentTime = Math.min(frameTime, video.duration)
      })
      
      // 监听跳转完成
      video.addEventListener('seeked', async () => {
        try {
          // 计算视频在画布中的位置（保持宽高比）
          const videoAspect = video.videoWidth / video.videoHeight
          const canvasAspect = canvas.width / canvas.height
          
          let drawWidth, drawHeight, drawX, drawY
          
          if (videoAspect > canvasAspect) {
            // 视频更宽，以高度为准
            drawHeight = canvas.height
            drawWidth = drawHeight * videoAspect
            drawX = (canvas.width - drawWidth) / 2
            drawY = 0
          } else {
            // 视频更高，以宽度为准
            drawWidth = canvas.width
            drawHeight = drawWidth / videoAspect
            drawX = 0
            drawY = (canvas.height - drawHeight) / 2
          }
          
          // 填充背景色
          context.fillStyle = '#000000'
          context.fillRect(0, 0, canvas.width, canvas.height)
          
          // 绘制视频帧
          context.drawImage(video, drawX, drawY, drawWidth, drawHeight)
          
          // 转换为WebP格式（如果支持）或JPEG
          let dataUrl
          try {
            dataUrl = canvas.toDataURL('image/webp', 0.75)
            // 检查是否真的生成了WebP
            if (!dataUrl.startsWith('data:image/webp')) {
              throw new Error('WebP not supported')
            }
          } catch (webpError) {
            // 回退到JPEG
            dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          }
          
          // 清理资源
          video.remove()
          canvas.remove()
          
          resolve(dataUrl)
          
        } catch (error) {
          video.remove()
          canvas.remove()
          reject(error)
        }
      })
      
      // 错误处理
      video.addEventListener('error', (e) => {
        video.remove()
        canvas.remove()
        reject(new Error(`Failed to load video: ${e.type}`))
      })
      
      // 设置视频源并开始加载
      video.src = videoUrl
      video.load()
    })
  }

  // 上传缩略图到R2存储（通过Edge Function代理）
  const uploadThumbnailToR2 = async (thumbnailDataUrl: string, videoId: string): Promise<string> => {
    try {
      // 将Base64转换为Blob
      const response = await fetch(thumbnailDataUrl)
      const blob = await response.blob()
      
      // 将Blob转换为Base64
      const reader = new FileReader()
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // 移除data:image/webp;base64,前缀
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      
      // 通过统一的supabase客户端调用Edge Function
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-thumbnail', {
        body: {
          videoId,
          base64Data,
          contentType: blob.type,
          fileSize: blob.size,
          directUpload: true // 标记为直接上传模式
        }
      })
      
      if (uploadError) {
        console.error(`[ThumbnailGenerator] 上传失败: ${uploadError.message}`)
        throw new Error(`上传失败: ${uploadError.message}`)
      }
      
      return uploadData.data.publicUrl
      
    } catch (error: any) {
      console.error(`[ThumbnailGenerator] R2上传失败: ${error.message}`)
      throw new Error(`R2上传失败: ${error.message}`)
    }
  }

  // 生成单个缩略图
  const generateThumbnailForVideo = async (video: Video) => {
    try {
      // 更新状态为处理中
      setVideos(prev => prev.map(v => 
        v.id === video.id ? { ...v, status: 'processing' } : v
      ))

      addLog(`🎬 开始处理: ${video.title}`, 'info')

      // 使用本地Canvas生成缩略图
      const thumbnailDataUrl = await extractVideoThumbnail(video.video_url, 0.1)
      
      // 上传到R2存储
      const r2Url = await uploadThumbnailToR2(thumbnailDataUrl, video.id)
      
      // 更新数据库
      const { error: updateError } = await supabase
        .from('videos')
        .update({ 
          thumbnail_url: r2Url
        })
        .eq('id', video.id)

      if (updateError) {
        throw updateError
      }

      // 更新状态
      setVideos(prev => prev.map(v => 
        v.id === video.id ? { 
          ...v, 
          status: 'completed', 
          thumbnail_url: r2Url 
        } : v
      ))

      addLog(`✅ 完成: ${video.title}`, 'success')

    } catch (error: any) {
      // 失败时恢复为pending状态
      setVideos(prev => prev.map(v => 
        v.id === video.id ? { ...v, status: 'pending' } : v
      ))
      
      addLog(`❌ 失败: ${video.title} - ${error.message}`, 'error')
    }
  }

  // 批量生成缩略图
  const startBatchGeneration = async () => {
    if (processingRef.current) return

    setIsProcessing(true)
    processingRef.current = true
    setCurrentIndex(0)

    const pendingVideos = videos.filter(v => v.originalStatus === 'pending')
    
    addLog(`🚀 开始批量生成，共 ${pendingVideos.length} 个视频`, 'info')

    for (let i = 0; i < pendingVideos.length; i++) {
      if (!processingRef.current) {
        addLog('⏹️ 用户停止了处理', 'warning')
        break
      }

      setCurrentIndex(i + 1)
      await generateThumbnailForVideo(pendingVideos[i])

      // 添加延迟避免请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // 处理完成
    processingRef.current = false
    setIsProcessing(false)
    
    const completedCount = videos.filter(v => v.status === 'completed').length
    const totalPending = pendingVideos.length
    
    addLog(`🎉 批量处理完成！共处理: ${totalPending}个, 当前已完成: ${completedCount}个`, 'success')
  }

  // 停止处理
  const stopProcessing = () => {
    processingRef.current = false
    setIsProcessing(false)
    addLog('⏹️ 正在停止处理...', 'warning')
  }

  // 统计数据
  const stats = {
    total: videos.length,
    pending: videos.filter(v => v.status === 'pending').length,
    completed: videos.filter(v => v.status === 'completed').length,
    processing: videos.filter(v => v.status === 'processing').length
  }

  const pendingVideos = videos.filter(v => v.originalStatus === 'pending')
  const progress = pendingVideos.length > 0 ? (currentIndex / pendingVideos.length) * 100 : 0

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 标题 */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold mb-2">🎬 批量生成视频缩略图</h1>
        <p className="text-blue-100">为所有没有缩略图的视频生成静态缩略图</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-gray-600">总视频数</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-600">待处理</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-gray-600">已完成</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.processing}</div>
          <div className="text-sm text-gray-600">处理中</div>
        </div>
      </div>

      {/* 控制面板 */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={loadVideos}
            disabled={isLoading || isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            📥 加载视频列表
          </button>
          
          <button
            onClick={startBatchGeneration}
            disabled={isProcessing || !videos.length || stats.pending === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            <Play className="h-4 w-4" />
            🚀 开始批量生成
          </button>
          
          <button
            onClick={stopProcessing}
            disabled={!isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
          >
            <Pause className="h-4 w-4" />
            ⏹️ 停止处理
          </button>
        </div>

        {/* 进度条 */}
        {isProcessing && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-center text-sm text-gray-600">
              处理进度: {currentIndex}/{pendingVideos.length} ({Math.round(progress)}%)
            </div>
          </div>
        )}
      </div>

      {/* 视频列表 */}
      {videos.length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">视频列表</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {videos.map((video) => (
              <div key={video.id} className="flex items-center gap-4 p-3 border rounded-lg">
                {/* 缩略图预览 */}
                <div className="w-20 h-12 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                  {video.thumbnail_url ? (
                    <img 
                      src={video.thumbnail_url} 
                      alt="缩略图" 
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    '无缩略图'
                  )}
                </div>
                
                {/* 视频信息 */}
                <div className="flex-1">
                  <div className="font-medium text-sm">{video.title}</div>
                  <div className="text-xs text-gray-500 font-mono">{video.id}</div>
                </div>
                
                {/* 状态 */}
                <div className="flex items-center gap-2">
                  {video.status === 'pending' && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                      等待处理
                    </span>
                  )}
                  {video.status === 'processing' && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      生成中
                    </span>
                  )}
                  {video.status === 'completed' && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      已完成
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日志面板 */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">操作日志</h3>
        <div className="bg-white border rounded p-3 max-h-60 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500">📋 系统就绪，点击"加载视频列表"开始...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1 text-gray-700">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}