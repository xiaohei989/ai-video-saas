/**
 * 简化的视频播放控制Context
 * 使用Context管理全局播放状态，避免DOM查询和竞争条件
 */

import React, { createContext, useContext, useState, useCallback } from 'react'

interface VideoContextValue {
  /** 当前播放的视频ID */
  currentPlayingId: string | null
  /** 设置当前播放的视频ID */
  setCurrentPlaying: (id: string | null) => void
  /** 检查指定视频是否正在播放 */
  isVideoPlaying: (id: string) => boolean
}

const VideoContext = createContext<VideoContextValue>({
  currentPlayingId: null,
  setCurrentPlaying: () => {},
  isVideoPlaying: () => false
})

/**
 * VideoContext Provider组件
 */
export function VideoContextProvider({ children }: { children: React.ReactNode }) {
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null)
  
  const setCurrentPlaying = useCallback((id: string | null) => {
    console.log('[VideoContext] 🎯 设置当前播放视频:', id)
    setCurrentPlayingId(id)
  }, [])
  
  const isVideoPlaying = useCallback((id: string) => {
    return currentPlayingId === id
  }, [currentPlayingId])

  return (
    <VideoContext.Provider
      value={{
        currentPlayingId,
        setCurrentPlaying,
        isVideoPlaying
      }}
    >
      {children}
    </VideoContext.Provider>
  )
}

/**
 * 使用VideoContext的Hook
 */
export function useVideoContext() {
  const context = useContext(VideoContext)
  if (!context) {
    throw new Error('useVideoContext must be used within VideoContextProvider')
  }
  return context
}