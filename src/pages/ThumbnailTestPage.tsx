/**
 * 缩略图测试页面
 * 用于验证动态缩略图生成和上传功能
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import SimpleVideoPlayer from '@/components/video/SimpleVideoPlayer'
import { useThumbnailUpload } from '@/hooks/useThumbnailUpload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface TestVideo {
  id: string
  title: string
  video_url: string
  thumbnail_url?: string | null
}

export default function ThumbnailTestPage() {
  const [videos, setVideos] = useState<TestVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [processingVideos, setProcessingVideos] = useState<Set<string>>(new Set())
  const [uploadResults, setUploadResults] = useState<Record<string, { success: boolean; url?: string; error?: string }>>({})

  const { generateAndUploadThumbnail, isProcessing, getCachedThumbnail } = useThumbnailUpload()

  // 加载测试视频数据
  useEffect(() => {
    loadTestVideos()
  }, [])

  const loadTestVideos = async () => {
    setLoading(true)
    try {
      // 查询最近的视频，优先选择没有缩略图的
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, video_url, thumbnail_url')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(8)

      if (error) {
        console.error('加载视频失败:', error)
        return
      }

      setVideos(data || [])
    } catch (error) {
      console.error('加载视频失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 手动触发缩略图生成
  const handleGenerateThumbnail = async (video: TestVideo) => {
    setProcessingVideos(prev => new Set(prev).add(video.id))

    try {
      const result = await generateAndUploadThumbnail({
        videoId: video.id,
        videoUrl: video.video_url,
        frameTime: 0.1,
        onSuccess: (thumbnailUrl) => {
          console.log(`缩略图上传成功: ${video.id} -> ${thumbnailUrl}`)
          setUploadResults(prev => ({
            ...prev,
            [video.id]: { success: true, url: thumbnailUrl }
          }))
          
          // 更新视频列表中的缩略图URL
          setVideos(prev => prev.map(v => 
            v.id === video.id ? { ...v, thumbnail_url: thumbnailUrl } : v
          ))
        },
        onError: (error) => {
          console.error(`缩略图生成失败: ${video.id}`, error)
          setUploadResults(prev => ({
            ...prev,
            [video.id]: { success: false, error: error.message }
          }))
        }
      })

      if (result) {
        console.log(`缩略图生成完成: ${video.id} -> ${result}`)
      }
    } catch (error) {
      console.error(`缩略图生成异常: ${video.id}`, error)
      setUploadResults(prev => ({
        ...prev,
        [video.id]: { success: false, error: (error as Error).message }
      }))
    } finally {
      setProcessingVideos(prev => {
        const newSet = new Set(prev)
        newSet.delete(video.id)
        return newSet
      })
    }
  }

  // 批量生成所有缺失的缩略图
  const handleBatchGenerate = async () => {
    const videosWithoutThumbnails = videos.filter(v => !v.thumbnail_url)
    
    for (const video of videosWithoutThumbnails) {
      if (!processingVideos.has(video.id) && !isProcessing(video.id)) {
        await handleGenerateThumbnail(video)
      }
    }
  }

  const getVideoStatus = (video: TestVideo) => {
    const cached = getCachedThumbnail(video.id)
    const uploadResult = uploadResults[video.id]
    const isCurrentlyProcessing = processingVideos.has(video.id) || isProcessing(video.id)

    if (isCurrentlyProcessing) {
      return { type: 'processing', label: '生成中...', icon: Loader2 }
    }
    
    if (uploadResult?.success || cached) {
      return { type: 'success', label: '已生成', icon: CheckCircle }
    }
    
    if (uploadResult?.error) {
      return { type: 'error', label: '失败', icon: AlertCircle }
    }
    
    if (video.thumbnail_url) {
      return { type: 'exists', label: '已有缩略图', icon: CheckCircle }
    }
    
    return { type: 'missing', label: '缺少缩略图', icon: Upload }
  }

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">加载测试数据...</span>
          </div>
        </div>
      </Layout>
    )
  }

  const videosWithoutThumbnails = videos.filter(v => !v.thumbnail_url).length
  const processingCount = processingVideos.size

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">缩略图测试页面</h1>
            <p className="text-muted-foreground mt-2">
              测试动态缩略图生成和上传功能
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              {videosWithoutThumbnails} 个缺少缩略图
            </Badge>
            {processingCount > 0 && (
              <Badge variant="secondary">
                {processingCount} 个处理中
              </Badge>
            )}
            <Button 
              onClick={handleBatchGenerate}
              disabled={videosWithoutThumbnails === 0 || processingCount > 0}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              批量生成缺失缩略图
            </Button>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">总视频数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{videos.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">缺少缩略图</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{videosWithoutThumbnails}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">处理中</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{processingCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">成功生成</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {Object.values(uploadResults).filter(r => r.success).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 视频网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => {
            const status = getVideoStatus(video)
            const StatusIcon = status.icon
            
            return (
              <Card key={video.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium truncate">
                      {video.title}
                    </CardTitle>
                    <Badge 
                      variant={
                        status.type === 'success' || status.type === 'exists' ? 'default' :
                        status.type === 'processing' ? 'secondary' :
                        status.type === 'error' ? 'destructive' : 'outline'
                      }
                      className="flex items-center gap-1 ml-2 flex-shrink-0"
                    >
                      <StatusIcon className={`h-3 w-3 ${status.type === 'processing' ? 'animate-spin' : ''}`} />
                      {status.label}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    ID: {video.id.split('-')[0]}...
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* 视频播放器 */}
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <SimpleVideoPlayer
                      src={video.video_url}
                      poster={video.thumbnail_url || undefined}
                      className="w-full h-full"
                      videoId={video.id}
                      videoTitle={video.title}
                      autoPlayOnHover={true}
                      showPlayButton={true}
                      objectFit="cover"
                    />
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateThumbnail(video)}
                      disabled={processingVideos.has(video.id) || isProcessing(video.id)}
                      className="flex-1"
                    >
                      {processingVideos.has(video.id) || isProcessing(video.id) ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          生成中
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3 mr-1" />
                          生成缩略图
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* 结果信息 */}
                  {uploadResults[video.id] && (
                    <div className="text-xs p-2 rounded bg-muted">
                      {uploadResults[video.id].success ? (
                        <div className="text-green-600">
                          ✅ 上传成功
                          {uploadResults[video.id].url && (
                            <div className="mt-1 break-all">
                              {uploadResults[video.id].url}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-red-600">
                          ❌ 失败: {uploadResults[video.id].error}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {videos.length === 0 && (
          <div className="text-center py-12">
            <Play className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">没有找到测试视频</h3>
            <p className="text-muted-foreground">
              请确保数据库中有已完成的视频记录
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}