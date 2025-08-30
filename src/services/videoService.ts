import { VideoGenerationResponse } from './veo3Service'

export interface VideoItem {
  id: string
  title: string
  templateName: string
  videoUrl: string
  thumbnailUrl?: string
  createdAt: Date
  duration?: number
  fileSize?: number
  resolution?: string
  credits: number
  status: 'completed' | 'processing' | 'failed'
  shareUrl?: string
  downloadCount: number
  viewCount: number
}

class VideoService {
  private readonly STORAGE_KEY = 'ai_video_history'
  private videos: VideoItem[] = []

  constructor() {
    this.loadVideos()
  }

  private loadVideos() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        this.videos = parsed.map((v: any) => ({
          ...v,
          createdAt: new Date(v.createdAt)
        }))
      }
    } catch (error) {
      console.error('Failed to load videos:', error)
      this.videos = []
    }
  }

  private saveVideos() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.videos))
    } catch (error) {
      console.error('Failed to save videos:', error)
    }
  }

  addVideo(job: VideoGenerationResponse, templateName: string, credits: number): VideoItem {
    const video: VideoItem = {
      id: job.id,
      title: `Video ${new Date().toLocaleDateString()}`,
      templateName,
      videoUrl: job.videoUrl || '',
      thumbnailUrl: job.thumbnailUrl,
      createdAt: job.createdAt,
      duration: job.metadata?.duration,
      fileSize: job.metadata?.fileSize,
      resolution: job.metadata?.resolution,
      credits,
      status: job.status as VideoItem['status'],
      downloadCount: 0,
      viewCount: 0
    }

    this.videos.unshift(video)
    this.saveVideos()
    return video
  }

  getVideos(): VideoItem[] {
    return [...this.videos]
  }

  getVideo(id: string): VideoItem | null {
    return this.videos.find(v => v.id === id) || null
  }

  updateVideo(id: string, updates: Partial<VideoItem>) {
    const index = this.videos.findIndex(v => v.id === id)
    if (index !== -1) {
      this.videos[index] = { ...this.videos[index], ...updates }
      this.saveVideos()
    }
  }

  deleteVideo(id: string) {
    this.videos = this.videos.filter(v => v.id !== id)
    this.saveVideos()
  }

  async downloadVideo(id: string): Promise<void> {
    const video = this.getVideo(id)
    if (!video) throw new Error('Video not found')

    // 更新下载计数
    this.updateVideo(id, { downloadCount: video.downloadCount + 1 })

    // 创建下载链接
    const response = await fetch(video.videoUrl)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${video.templateName}-${video.id}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    URL.revokeObjectURL(url)
  }

  generateShareUrl(id: string): string {
    const video = this.getVideo(id)
    if (!video) throw new Error('Video not found')

    // 生成分享链接（实际应用中应该是后端生成的真实链接）
    const shareUrl = `${window.location.origin}/share/${id}`
    this.updateVideo(id, { shareUrl })
    
    return shareUrl
  }

  async copyShareLink(id: string): Promise<void> {
    const shareUrl = this.generateShareUrl(id)
    await navigator.clipboard.writeText(shareUrl)
  }

  incrementViewCount(id: string) {
    const video = this.getVideo(id)
    if (video) {
      this.updateVideo(id, { viewCount: video.viewCount + 1 })
    }
  }

  getRecentVideos(limit: number = 10): VideoItem[] {
    return this.videos
      .filter(v => v.status === 'completed')
      .slice(0, limit)
  }

  getTotalCreditsUsed(): number {
    return this.videos.reduce((sum, v) => sum + v.credits, 0)
  }

  getStatistics() {
    const completed = this.videos.filter(v => v.status === 'completed').length
    const failed = this.videos.filter(v => v.status === 'failed').length
    const processing = this.videos.filter(v => v.status === 'processing').length
    const totalCredits = this.getTotalCreditsUsed()
    const totalViews = this.videos.reduce((sum, v) => sum + v.viewCount, 0)
    const totalDownloads = this.videos.reduce((sum, v) => sum + v.downloadCount, 0)

    return {
      total: this.videos.length,
      completed,
      failed,
      processing,
      totalCredits,
      totalViews,
      totalDownloads
    }
  }

  clearHistory() {
    this.videos = []
    this.saveVideos()
  }

  exportHistory(): string {
    return JSON.stringify(this.videos, null, 2)
  }

  importHistory(jsonData: string) {
    try {
      const imported = JSON.parse(jsonData)
      if (Array.isArray(imported)) {
        this.videos = imported.map((v: any) => ({
          ...v,
          createdAt: new Date(v.createdAt)
        }))
        this.saveVideos()
      }
    } catch (error) {
      throw new Error('Invalid import data')
    }
  }
}

export const videoService = new VideoService()

export default videoService;