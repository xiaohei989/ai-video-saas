/**
 * 背景视频管理 Hook
 * 
 * 提供背景视频的统一管理和控制逻辑
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface BackgroundVideoConfig {
  videos: string[]
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  enablePlaylist?: boolean
  playlistInterval?: number
  shufflePlaylist?: boolean
  enableMobileOptimization?: boolean
  fallbackImage?: string
}

export interface BackgroundVideoState {
  currentVideoIndex: number
  isPlaying: boolean
  isMuted: boolean
  isLoading: boolean
  hasError: boolean
  isMobile: boolean
  currentVideoSrc: string
  playlist: string[]
}

export interface BackgroundVideoActions {
  play: () => void
  pause: () => void
  togglePlay: () => void
  toggleMute: () => void
  nextVideo: () => void
  previousVideo: () => void
  selectVideo: (index: number) => void
  shufflePlaylist: () => void
  retry: () => void
}

export function useBackgroundVideo(config: BackgroundVideoConfig) {
  const {
    videos = [],
    autoPlay = true,
    muted = true,
    enablePlaylist = false,
    playlistInterval = 30,
    shufflePlaylist = false
  } = config

  // 状态管理
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [isMuted, setIsMuted] = useState(muted)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [playlist, setPlaylist] = useState<string[]>(videos)

  // Refs
  const playlistIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const videoLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 初始化播放列表
  useEffect(() => {
    if (shufflePlaylist && videos.length > 1) {
      const shuffled = [...videos].sort(() => Math.random() - 0.5)
      setPlaylist(shuffled)
    } else {
      setPlaylist(videos)
    }
    setCurrentVideoIndex(0)
  }, [videos, shufflePlaylist])

  // 当前视频源
  const currentVideoSrc = playlist[currentVideoIndex] || videos[0] || ''

  // 播放列表自动切换
  useEffect(() => {
    if (!enablePlaylist || playlist.length <= 1 || isMobile) {
      if (playlistIntervalRef.current) {
        clearInterval(playlistIntervalRef.current)
      }
      return
    }

    if (playlistInterval > 0) {
      playlistIntervalRef.current = setInterval(() => {
        setCurrentVideoIndex(prev => (prev + 1) % playlist.length)
      }, playlistInterval * 1000)
    }

    return () => {
      if (playlistIntervalRef.current) {
        clearInterval(playlistIntervalRef.current)
      }
    }
  }, [enablePlaylist, playlist.length, playlistInterval, isMobile])

  // 视频加载超时处理
  useEffect(() => {
    if (isLoading) {
      videoLoadingTimeoutRef.current = setTimeout(() => {
        setHasError(true)
        setIsLoading(false)
        console.warn('Video loading timeout:', currentVideoSrc)
      }, 15000) // 15秒超时
    }

    return () => {
      if (videoLoadingTimeoutRef.current) {
        clearTimeout(videoLoadingTimeoutRef.current)
      }
    }
  }, [isLoading, currentVideoSrc])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (playlistIntervalRef.current) {
        clearInterval(playlistIntervalRef.current)
      }
      if (videoLoadingTimeoutRef.current) {
        clearTimeout(videoLoadingTimeoutRef.current)
      }
    }
  }, [])

  // Actions
  const play = useCallback(() => {
    if (!isMobile) {
      setIsPlaying(true)
    }
  }, [isMobile])

  const pause = useCallback(() => {
    if (!isMobile) {
      setIsPlaying(false)
    }
  }, [isMobile])

  const togglePlay = useCallback(() => {
    if (isMobile) return
    setIsPlaying(prev => !prev)
  }, [isMobile])

  const toggleMute = useCallback(() => {
    if (isMobile) return
    setIsMuted(prev => !prev)
  }, [isMobile])

  const nextVideo = useCallback(() => {
    if (playlist.length <= 1) return
    setCurrentVideoIndex(prev => (prev + 1) % playlist.length)
    setIsLoading(true)
    setHasError(false)
  }, [playlist.length])

  const previousVideo = useCallback(() => {
    if (playlist.length <= 1) return
    setCurrentVideoIndex(prev => prev === 0 ? playlist.length - 1 : prev - 1)
    setIsLoading(true)
    setHasError(false)
  }, [playlist.length])

  const selectVideo = useCallback((index: number) => {
    if (index < 0 || index >= playlist.length) return
    setCurrentVideoIndex(index)
    setIsLoading(true)
    setHasError(false)
  }, [playlist.length])

  const shufflePlaylistAction = useCallback(() => {
    if (playlist.length <= 1) return
    const shuffled = [...playlist].sort(() => Math.random() - 0.5)
    setPlaylist(shuffled)
    setCurrentVideoIndex(0)
    setIsLoading(true)
    setHasError(false)
  }, [playlist])

  const retry = useCallback(() => {
    setHasError(false)
    setIsLoading(true)
  }, [])

  // State
  const state: BackgroundVideoState = {
    currentVideoIndex,
    isPlaying,
    isMuted,
    isLoading,
    hasError,
    isMobile,
    currentVideoSrc,
    playlist
  }

  // Actions
  const actions: BackgroundVideoActions = {
    play,
    pause,
    togglePlay,
    toggleMute,
    nextVideo,
    previousVideo,
    selectVideo,
    shufflePlaylist: shufflePlaylistAction,
    retry
  }

  // 事件处理器
  const eventHandlers = {
    onLoadStart: useCallback(() => {
      setIsLoading(true)
      setHasError(false)
    }, []),

    onLoadedData: useCallback(() => {
      setIsLoading(false)
      setHasError(false)
      if (videoLoadingTimeoutRef.current) {
        clearTimeout(videoLoadingTimeoutRef.current)
      }
    }, []),

    onError: useCallback((error?: string) => {
      setHasError(true)
      setIsLoading(false)
      console.error('Background video error:', error || 'Unknown error')
      if (videoLoadingTimeoutRef.current) {
        clearTimeout(videoLoadingTimeoutRef.current)
      }
      
      // 自动尝试下一个视频
      if (playlist.length > 1) {
        setTimeout(() => {
          nextVideo()
        }, 2000)
      }
    }, [playlist.length, nextVideo]),

    onEnded: useCallback(() => {
      if (enablePlaylist && playlist.length > 1) {
        nextVideo()
      }
    }, [enablePlaylist, playlist.length, nextVideo])
  }

  return [state, actions, eventHandlers] as const
}

export default useBackgroundVideo