import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { parseTitle } from '@/utils/titleParser'
import { AlertCircle, Loader2 } from '@/components/icons'
import { ReactVideoPlayer } from '@/components/video/ReactVideoPlayer'
import supabaseVideoService from '@/services/supabaseVideoService'
import type { Database } from '@/lib/supabase'

type Video = Database['public']['Tables']['videos']['Row']

export default function VideoEmbedPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 获取视频数据
  useEffect(() => {
    if (!id) return
    
    const fetchVideo = async () => {
      try {
        setLoading(true)
        const videoData = await supabaseVideoService.getVideo(id)
        
        if (!videoData) {
          setError(t('pages.videoEmbed.notFound'))
          return
        }
        
        setVideo(videoData)

        // 解析标题
        const currentLocale = i18n.language.split('-')[0]
        const parsedTitle = parseTitle(videoData.title, currentLocale, '视频播放')

        // 更新页面标题和meta标签
        document.title = `${parsedTitle} | AI视频生成平台`
        
        // 添加必要的meta标签以支持iframe嵌入
        const updateMetaTag = (name: string, content: string) => {
          let meta = document.querySelector(`meta[name="${name}"]`)
          if (!meta) {
            meta = document.createElement('meta')
            meta.setAttribute('name', name)
            document.head.appendChild(meta)
          }
          meta.setAttribute('content', content)
        }
        
        updateMetaTag('robots', 'noindex, nofollow') // 防止搜索引擎索引嵌入页面
        updateMetaTag('referrer', 'no-referrer-when-downgrade')
        
      } catch (err) {
        console.error('Failed to fetch video:', err)
        setError(t('pages.videoEmbed.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    
    fetchVideo()
  }, [id])
  
  // 嵌入页面样式
  useEffect(() => {
    // 设置页面样式适合嵌入
    document.body.style.margin = '0'
    document.body.style.padding = '0'
    document.body.style.background = '#000'
    document.body.style.overflow = 'hidden'
    
    return () => {
      // 清理样式
      document.body.style.margin = ''
      document.body.style.padding = ''
      document.body.style.background = ''
      document.body.style.overflow = ''
    }
  }, [])
  
  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>{t('pages.videoEmbed.loading')}</p>
        </div>
      </div>
    )
  }
  
  if (error || !video?.video_url) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <AlertCircle className="h-8 w-8 mx-auto mb-4" />
          <p>{error || t('pages.videoEmbed.unavailable')}</p>
        </div>
      </div>
    )
  }

  // 解析标题用于显示
  const currentLocale = i18n.language.split('-')[0]
  const parsedTitle = parseTitle(video.title, currentLocale, t('videos.untitled'))

  return (
    <div className="w-full h-screen bg-black">
      <ReactVideoPlayer
        src={video.video_url}
        poster={video.thumbnail_url || undefined}
        className="w-full h-full"
        autoPlayOnHover={false}
        showPlayButton={true}
        muted={true} // Twitter要求默认静音
        objectFit="contain"
        videoId={video.id}
        videoTitle={parsedTitle}
        alt={parsedTitle}
        controls={true} // 嵌入模式显示控制栏
        autoPlay={false} // 禁用自动播放，符合Twitter政策
      />
      
    </div>
  )
}