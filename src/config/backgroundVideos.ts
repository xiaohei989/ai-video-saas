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

export default defaultBackgroundVideoConfig