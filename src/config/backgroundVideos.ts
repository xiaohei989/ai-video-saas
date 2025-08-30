/**
 * 背景视频配置
 * 
 * 管理主页背景视频的播放列表和设置
 */

export interface BackgroundVideoItem {
  id: string
  name: string
  src: string
  poster?: string
  duration?: number
  description?: string
  theme?: 'light' | 'dark' | 'auto'
}

export interface BackgroundVideoConfig {
  videos: BackgroundVideoItem[]
  settings: {
    autoPlay: boolean
    loop: boolean
    muted: boolean
    enablePlaylist: boolean
    playlistInterval: number
    shufflePlaylist: boolean
    overlayOpacity: number
    overlayColor: string
    enableGradient: boolean
    gradientDirection: 'to-bottom' | 'to-top' | 'to-right' | 'to-left'
  }
  fallbacks: {
    image: string
    lowQualityVideo?: string
  }
}

// 所有模板视频配置
export const templateVideos: BackgroundVideoItem[] = [
  {
    id: 'art-coffee-machine',
    name: '艺术咖啡机',
    src: '/templates/videos/art-coffee-machine.mp4',
    poster: '/logo.png',
    description: '艺术创作过程的魔法展示',
    theme: 'dark'
  },
  {
    id: 'asmr-surreal-toast-spread',
    name: 'ASMR吐司涂抹',
    src: '/templates/videos/asmr-surreal-toast-spread.mp4',
    poster: '/logo.png',
    description: '超现实吐司涂抹ASMR',
    theme: 'light'
  },
  {
    id: 'glass-cutting-asmr',
    name: '玻璃切割ASMR',
    src: '/templates/videos/glass-cutting-asmr.mp4',
    poster: '/logo.png',
    description: '精密玻璃切割ASMR体验',
    theme: 'auto'
  },
  {
    id: 'magic-pen-3d-bloom',
    name: '3D魔法笔绘画',
    src: '/templates/videos/magic-pen-3d-bloom.mp4',
    poster: '/logo.png',
    description: '3D艺术创作的神奇瞬间',
    theme: 'dark'
  },
  {
    id: 'miniature-animals-surprise',
    name: '微型动物惊喜',
    src: '/templates/videos/miniature-animals-surprise.mp4',
    poster: '/logo.png',
    description: '可爱的微型动物世界',
    theme: 'light'
  },
  {
    id: 'surveillance-animal-encounter',
    name: '监控动物奇遇',
    src: '/templates/videos/surveillance-animal-encounter.mp4',
    poster: '/logo.png',
    description: '监控镜头下的动物奇遇',
    theme: 'auto'
  },
  {
    id: 'tiny-pet-fingertip',
    name: '指尖宠物',
    src: '/templates/videos/tiny-pet-fingertip.mp4',
    poster: '/logo.png',
    description: '指尖上的迷你宠物',
    theme: 'light'
  }
]

// 默认背景视频配置
export const defaultBackgroundVideoConfig: BackgroundVideoConfig = {
  videos: templateVideos,
  settings: {
    autoPlay: true,
    loop: true,
    muted: true,
    enablePlaylist: true,
    playlistInterval: 30, // 30秒切换
    shufflePlaylist: true, // 启用随机播放
    overlayOpacity: 0.4,
    overlayColor: 'black',
    enableGradient: true,
    gradientDirection: 'to-bottom'
  },
  fallbacks: {
    image: '/images/background-fallback.jpg'
  }
}

// 简单背景视频配置（单个视频循环）
export const simpleBackgroundVideoConfig = {
  src: '/videos/This_surreal_aigenerated_202508211042_ohqs2.mp4',
  poster: '/logo.png',
  settings: {
    autoPlay: true,
    loop: true,
    muted: true,
    overlayOpacity: 0.3
  },
  fallback: '/logo.png'
}

// 获取背景视频配置的辅助函数
export function getBackgroundVideoConfig(mode: 'playlist' | 'single' = 'playlist'): BackgroundVideoConfig | typeof simpleBackgroundVideoConfig {
  return mode === 'playlist' ? defaultBackgroundVideoConfig : simpleBackgroundVideoConfig
}

// 验证视频文件是否可用的辅助函数
export async function validateVideoSources(videos: BackgroundVideoItem[]): Promise<BackgroundVideoItem[]> {
  const validVideos: BackgroundVideoItem[] = []
  
  for (const video of videos) {
    try {
      // 简单的HEAD请求检查文件是否存在
      const response = await fetch(video.src, { method: 'HEAD' })
      if (response.ok) {
        validVideos.push(video)
      } else {
        console.warn(`Background video not available: ${video.src}`)
      }
    } catch (error) {
      console.warn(`Failed to validate background video: ${video.src}`, error)
    }
  }
  
  return validVideos.length > 0 ? validVideos : [videos[0]] // 至少保留第一个作为fallback
}

// 随机选择背景视频
export function getRandomBackgroundVideo(): BackgroundVideoItem {
  const videos = templateVideos
  const randomIndex = Math.floor(Math.random() * videos.length)
  return videos[randomIndex]
}

// 获取随机的多个背景视频（用于播放列表）
export function getRandomBackgroundVideos(count: number = 3): BackgroundVideoItem[] {
  const videos = [...templateVideos]
  const selected: BackgroundVideoItem[] = []
  
  // 随机选择指定数量的视频
  for (let i = 0; i < Math.min(count, videos.length); i++) {
    const randomIndex = Math.floor(Math.random() * videos.length)
    selected.push(videos.splice(randomIndex, 1)[0])
  }
  
  return selected
}

// 根据时间段选择合适的背景视频
export function getTimeBasedBackgroundVideo(): BackgroundVideoItem {
  const hour = new Date().getHours()
  const videos = templateVideos
  
  // 早晨 (6-12): 明亮主题
  if (hour >= 6 && hour < 12) {
    const lightVideos = videos.filter(v => v.theme === 'light')
    return lightVideos[Math.floor(Math.random() * lightVideos.length)] || videos[0]
  }
  // 下午 (12-18): 自动主题  
  if (hour >= 12 && hour < 18) {
    const autoVideos = videos.filter(v => v.theme === 'auto')
    return autoVideos[Math.floor(Math.random() * autoVideos.length)] || videos[1]
  }
  // 晚上 (18-24, 0-6): 深色主题
  const darkVideos = videos.filter(v => v.theme === 'dark')
  return darkVideos[Math.floor(Math.random() * darkVideos.length)] || videos[0]
}

export default defaultBackgroundVideoConfig