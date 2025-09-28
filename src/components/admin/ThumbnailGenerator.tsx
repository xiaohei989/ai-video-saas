import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import supabaseVideoService from '@/services/supabaseVideoService'
import { Play, Pause, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

interface Video {
  id: string
  title: string
  video_url: string
  thumbnail_url?: string
  thumbnail_blur_url?: string | null
  created_at?: string
  status: 'pending' | 'processing' | 'completed'
  originalStatus: string
}

interface ThumbnailGeneratorProps {
  className?: string
  hideHeader?: boolean // 在RA嵌入时隐藏顶部大标题
}

export default function ThumbnailGenerator({ className, hideHeader = false }: ThumbnailGeneratorProps) {
  const [videos, setVideos] = useState<Video[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  // 过滤与选项
  const [filterType, setFilterType] = useState<'missing_high' | 'missing_blur' | 'all'>('missing_high')
  const [limit, setLimit] = useState<number>(20)
  const [frameTime, setFrameTime] = useState<string>('1.5')
  const [mode, setMode] = useState<'auto' | 'force'>('auto')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  
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

      let query = supabase
        .from('videos')
        .select('id, title, thumbnail_url, thumbnail_blur_url, video_url, status, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (filterType === 'missing_high') {
        query = query.or('thumbnail_url.is.null,thumbnail_url.like.data:image/svg+xml%')
      } else if (filterType === 'missing_blur') {
        query = query.or('thumbnail_blur_url.is.null,thumbnail_blur_url.like.data:image/svg+xml%')
      }

      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString())
      }
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23,59,59,999)
        query = query.lte('created_at', end.toISOString())
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      const processedVideos = (data || []).map(v => {
        let pending = false
        if (filterType === 'missing_high') {
          pending = !(v.thumbnail_url && !String(v.thumbnail_url).startsWith('data:image/svg+xml'))
        } else if (filterType === 'missing_blur') {
          pending = !(v.thumbnail_blur_url && !String(v.thumbnail_blur_url).startsWith('data:image/svg+xml'))
        } else {
          pending = !(v.thumbnail_url && !String(v.thumbnail_url).startsWith('data:image/svg+xml'))
        }
        return {
          id: v.id,
          title: v.title,
          video_url: v.video_url,
          thumbnail_url: v.thumbnail_url,
          thumbnail_blur_url: v.thumbnail_blur_url,
          created_at: v.created_at,
          status: pending ? 'pending' : 'completed',
          originalStatus: pending ? 'pending' : 'completed'
        } as Video
      })

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

  // 删除本地低质量缩略图生成与直传逻辑；统一走高质量服务

  // 生成单个缩略图（依据模式与过滤器）
  const generateThumbnailForVideo = async (video: Video) => {
    try {
      // 更新状态为处理中
      setVideos(prev => prev.map(v => 
        v.id === video.id ? { ...v, status: 'processing' } : v
      ))

      addLog(`🎬 开始处理: ${video.title}`, 'info')

      let success = false
      if (mode === 'force') {
        const t = Number(frameTime) || 1.5
        const res = await supabaseVideoService.regenerateThumbnail(video.id, { frameTime: t })
        success = !!res.success
      } else {
        if (filterType === 'missing_blur') {
          success = await generateBlurOnly(video)
        } else {
          success = await supabaseVideoService.autoGenerateThumbnailOnComplete({
            id: video.id,
            status: 'completed',
            video_url: video.video_url,
            thumbnail_url: video.thumbnail_url || null
          } as any)
        }
      }

      if (!success) {
        throw new Error('高质量缩略图生成失败')
      }

      // 刷新单条记录获取最新缩略图
      const { data: refreshed, error: refErr } = await supabase
        .from('videos')
        .select('id, title, thumbnail_url, thumbnail_blur_url, video_url, status')
        .eq('id', video.id)
        .single()

      if (refErr) {
        throw refErr
      }

      // 更新状态
      setVideos(prev => prev.map(v => 
        v.id === video.id ? { 
          ...v, 
          status: 'completed', 
          thumbnail_url: refreshed?.thumbnail_url || v.thumbnail_url,
          thumbnail_blur_url: refreshed?.thumbnail_blur_url ?? v.thumbnail_blur_url
        } : v
      ))

      addLog(`✅ 完成（高质量）: ${video.title}`, 'success')

    } catch (error: any) {
      // 失败时恢复为pending状态
      setVideos(prev => prev.map(v => 
        v.id === video.id ? { ...v, status: 'pending' } : v
      ))
      
      addLog(`❌ 失败: ${video.title} - ${error.message}`, 'error')
    }
  }

  // 仅补齐模糊图（服务端生成避免CORS）
  const generateBlurOnly = async (video: Video): Promise<boolean> => {
    try {
      // 已有模糊图则跳过
      if (video.thumbnail_blur_url && !String(video.thumbnail_blur_url).startsWith('data:image/svg+xml')) return true
      if (!video.video_url) return false
      const { extractAndUploadBlurOnly } = await import('@/utils/videoThumbnail')
      const blurUrl = await extractAndUploadBlurOnly(video.video_url, video.id)
      const { error: upErr } = await supabase
        .from('videos')
        .update({ thumbnail_blur_url: blurUrl, thumbnail_generated_at: new Date().toISOString() })
        .eq('id', video.id)
      if (upErr) return false
      return true
    } catch (e) {
      addLog(`模糊图生成失败：${(e as Error).message || e}`, 'error')
      return false
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
      {/* 标题（可隐藏） */}
      {!hideHeader && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
          <h1 className="text-2xl font-bold mb-2">🎬 批量生成视频缩略图</h1>
          <p className="text-blue-100">为所有没有缩略图的视频生成静态缩略图</p>
        </div>
      )}

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
      <div className="bg-white border rounded-lg p-6 space-y-3">
        {/* 过滤选项 */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-xs text-gray-500 mb-1">目标类型</div>
            <select className="border rounded px-2 py-1" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
              <option value="missing_high">缺少高清缩略图</option>
              <option value="missing_blur">缺少模糊缩略图</option>
              <option value="all">全部（用于强制重生）</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">数量上限</div>
            <input type="number" min={1} className="border rounded px-2 py-1 w-28" value={limit} onChange={e => setLimit(parseInt(e.target.value || '20', 10))} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">模式</div>
            <select className="border rounded px-2 py-1" value={mode} onChange={e => setMode(e.target.value as any)}>
              <option value="auto">自动补齐（高清+模糊）</option>
              <option value="force">强制重生（自定义截帧）</option>
            </select>
          </div>
          {mode === 'force' && (
            <div>
              <div className="text-xs text-gray-500 mb-1">截帧秒数</div>
              <input className="border rounded px-2 py-1 w-24" value={frameTime} onChange={e => setFrameTime(e.target.value)} />
            </div>
          )}
          <div>
            <div className="text-xs text-gray-500 mb-1">起始日期</div>
            <input type="date" className="border rounded px-2 py-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">结束日期</div>
            <input type="date" className="border rounded px-2 py-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
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
