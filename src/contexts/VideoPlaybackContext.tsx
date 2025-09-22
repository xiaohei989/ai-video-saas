/**
 * 全局视频播放管理器
 * 
 * 功能：
 * - 确保同时只有一个视频播放
 * - 管理所有视频播放器的注册和注销
 * - 提供统一的播放控制接口
 * - 自动暂停其他视频当新视频开始播放
 */

import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useCallback, 
  useMemo
} from 'react'

// 视频播放器实例接口
export interface VideoPlayerInstance {
  id: string
  pause: () => void
  play: () => Promise<void>
  getCurrentTime: () => number
  getDuration: () => number
  isPlaying: () => boolean
  // 添加立即停止方法，用于确保视频立即停止
  stopImmediate: () => void
}

// 全局播放状态
interface VideoPlaybackState {
  currentPlayingId: string | null
  registeredPlayers: Map<string, VideoPlayerInstance>
  isPlayRequesting: boolean  // 添加播放请求锁
  pendingPlayId: string | null  // 正在请求播放的ID
  playMutex: boolean  // 播放互斥锁，确保严格的播放控制
  lastPlayTime: number  // 最后播放时间，用于防抖
}

// Action 类型
type VideoPlaybackAction = 
  | { type: 'REGISTER_PLAYER'; payload: { id: string; instance: VideoPlayerInstance } }
  | { type: 'UNREGISTER_PLAYER'; payload: { id: string } }
  | { type: 'REQUEST_PLAY'; payload: { id: string } }
  | { type: 'START_PLAYING'; payload: { id: string } }
  | { type: 'STOP_PLAYING'; payload: { id: string } }
  | { type: 'PLAY_REQUEST_FAILED'; payload: { id: string } }
  | { type: 'PAUSE_ALL' }
  | { type: 'ACQUIRE_PLAY_MUTEX'; payload: { id: string } }
  | { type: 'RELEASE_PLAY_MUTEX' }
  | { type: 'IMMEDIATE_STOP_ALL' }

// Reducer
function videoPlaybackReducer(
  state: VideoPlaybackState, 
  action: VideoPlaybackAction
): VideoPlaybackState {
  switch (action.type) {
    case 'REGISTER_PLAYER': {
      const newRegisteredPlayers = new Map(state.registeredPlayers)
      newRegisteredPlayers.set(action.payload.id, action.payload.instance)
      
      return {
        ...state,
        registeredPlayers: newRegisteredPlayers
      }
    }
    
    case 'UNREGISTER_PLAYER': {
      const newRegisteredPlayers = new Map(state.registeredPlayers)
      newRegisteredPlayers.delete(action.payload.id)
      
      return {
        ...state,
        registeredPlayers: newRegisteredPlayers,
        currentPlayingId: state.currentPlayingId === action.payload.id 
          ? null 
          : state.currentPlayingId
      }
    }
    
    case 'REQUEST_PLAY': {
      const now = Date.now()
      
      // 防抖：如果距离上次播放请求太近，忽略
      if (now - state.lastPlayTime < 100) {
        return state
      }
      
      // 如果互斥锁被占用且不是同一个视频，忽略新请求
      if (state.playMutex && state.pendingPlayId !== action.payload.id) {
        return state
      }
      
      // 如果请求的就是当前播放的视频，直接返回不变
      if (state.currentPlayingId === action.payload.id && !state.isPlayRequesting) {
        return state
      }
      
      // 注意：停止其他视频的逻辑已移到 requestPlay 函数中，避免在 reducer 中产生副作用
      
      return {
        ...state,
        isPlayRequesting: true,
        pendingPlayId: action.payload.id,
        playMutex: true,
        lastPlayTime: now,
        // 🚀 只有当切换到不同视频时才清空currentPlayingId
        // 这样UI会显示"请求中"状态而不是"已停止"
        currentPlayingId: state.currentPlayingId === action.payload.id ? state.currentPlayingId : null
      }
    }
    
    case 'START_PLAYING': {
      // 只有当请求的ID匹配时才开始播放
      if (state.pendingPlayId && state.pendingPlayId !== action.payload.id) {
        return state
      }
      
      return {
        ...state,
        currentPlayingId: action.payload.id,
        isPlayRequesting: false,
        pendingPlayId: null,
        playMutex: false  // 释放互斥锁
      }
    }
    
    case 'STOP_PLAYING': {
      return {
        ...state,
        currentPlayingId: state.currentPlayingId === action.payload.id 
          ? null 
          : state.currentPlayingId,
        isPlayRequesting: state.pendingPlayId === action.payload.id ? false : state.isPlayRequesting,
        pendingPlayId: state.pendingPlayId === action.payload.id ? null : state.pendingPlayId,
        playMutex: state.pendingPlayId === action.payload.id ? false : state.playMutex
      }
    }
    
    case 'PLAY_REQUEST_FAILED': {
      // 播放请求失败，清除请求状态
      if (state.pendingPlayId === action.payload.id) {
        return {
          ...state,
          isPlayRequesting: false,
          pendingPlayId: null,
          playMutex: false  // 释放互斥锁
        }
      }
      return state
    }
    
    case 'PAUSE_ALL': {
      // 暂停所有播放器
      state.registeredPlayers.forEach((player) => {
        try {
          if (player.isPlaying()) {
            player.pause()
          }
        } catch {
          // 暂停失败静默处理
        }
      })
      
      return {
        ...state,
        currentPlayingId: null,
        isPlayRequesting: false,
        pendingPlayId: null,
        playMutex: false
      }
    }
    
    case 'ACQUIRE_PLAY_MUTEX': {
      // 获取播放互斥锁
      if (state.playMutex) {
        return state
      }
      
      return {
        ...state,
        playMutex: true,
        pendingPlayId: action.payload.id
      }
    }
    
    case 'RELEASE_PLAY_MUTEX': {
      return {
        ...state,
        playMutex: false,
        pendingPlayId: null,
        isPlayRequesting: false
      }
    }
    
    case 'IMMEDIATE_STOP_ALL': {
      // 立即停止所有播放器，使用stopImmediate方法
      state.registeredPlayers.forEach((player) => {
        try {
          player.stopImmediate()
        } catch {
          // 停止失败静默处理
        }
      })
      
      return {
        ...state,
        currentPlayingId: null,
        isPlayRequesting: false,
        pendingPlayId: null,
        playMutex: false
      }
    }
    
    default:
      return state
  }
}

// Context 接口
interface VideoPlaybackContextType {
  // 当前播放状态
  currentPlayingId: string | null
  
  // 播放器管理
  registerPlayer: (id: string, instance: VideoPlayerInstance) => void
  unregisterPlayer: (id: string) => void
  
  // 播放控制
  requestPlay: (id: string) => boolean  // 改为同步方法
  requestPlayAsync: (id: string) => Promise<boolean>  // 保留异步版本以兼容现有代码
  notifyPause: (id: string) => void
  pauseAll: () => void
  immediateStopAll: () => void  // 新增：立即停止所有视频
  
  // 互斥锁控制
  acquirePlayMutex: (id: string) => boolean
  releasePlayMutex: () => void
  
  // 状态查询
  isCurrentlyPlaying: (id: string) => boolean
  isPendingPlay: (id: string) => boolean
  isPlayMutexLocked: () => boolean  // 新增：检查互斥锁状态
  getRegisteredPlayerCount: () => number
}

// 创建 Context
const VideoPlaybackContext = createContext<VideoPlaybackContextType | null>(null)

// 初始状态
const initialState: VideoPlaybackState = {
  currentPlayingId: null,
  registeredPlayers: new Map(),
  isPlayRequesting: false,
  pendingPlayId: null,
  playMutex: false,
  lastPlayTime: 0
}

// Provider 组件
export function VideoPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(videoPlaybackReducer, initialState)

  // 注册播放器
  const registerPlayer = useCallback((id: string, instance: VideoPlayerInstance) => {
    
    dispatch({
      type: 'REGISTER_PLAYER',
      payload: { id, instance }
    })
  }, [])

  // 注销播放器
  const unregisterPlayer = useCallback((id: string) => {
    
    dispatch({
      type: 'UNREGISTER_PLAYER',
      payload: { id }
    })
  }, [])

  // 同步请求播放 - 新的主要方法，集成性能监控
  const requestPlay = useCallback((id: string): boolean => {
    const requestStartTime = performance.now()
    const player = state.registeredPlayers.get(id)
    
    if (!player) {
      VideoPlaybackPerformanceMonitor.recordPlayRequest(id, false)
      return false
    }

    // 如果已经是当前播放的视频，直接返回成功
    if (state.currentPlayingId === id) {
      VideoPlaybackPerformanceMonitor.recordPlayRequest(id, true, performance.now() - requestStartTime)
      return true
    }

    // 尝试获取播放互斥锁
    if (state.playMutex && state.pendingPlayId !== id) {
      VideoPlaybackPerformanceMonitor.recordMutexWait()
      VideoPlaybackPerformanceMonitor.recordPlayRequest(id, false, performance.now() - requestStartTime)
      return false
    }

    // 在发起播放请求前，先停止所有其他视频
    state.registeredPlayers.forEach((otherPlayer, otherId) => {
      if (otherId !== id) {
        try {
          otherPlayer.stopImmediate()
        } catch {
          // 停止失败静默处理
        }
      }
    })

    // 发起播放请求
    dispatch({
      type: 'REQUEST_PLAY',
      payload: { id }
    })

    // 🔧 移动端修复：仅在必要时进行异步播放
    // 如果视频已经在播放器实例中被用户交互启动，不要重复播放
    if (!player.isPlaying()) {
      player.play().then(() => {
        const playDuration = performance.now() - requestStartTime
        dispatch({
          type: 'START_PLAYING',
          payload: { id }
        })
        VideoPlaybackPerformanceMonitor.recordPlayRequest(id, true, playDuration)
      }).catch(() => {
        const errorDuration = performance.now() - requestStartTime
        dispatch({
          type: 'PLAY_REQUEST_FAILED',
          payload: { id }
        })
        VideoPlaybackPerformanceMonitor.recordPlayRequest(id, false, errorDuration)
      })
    } else {
      // 视频已经在播放，直接标记为成功
      dispatch({
        type: 'START_PLAYING',
        payload: { id }
      })
      VideoPlaybackPerformanceMonitor.recordPlayRequest(id, true, performance.now() - requestStartTime)
    }

    return true  // 立即返回成功，表示请求已被接受
  }, [state.registeredPlayers, state.currentPlayingId, state.playMutex, state.pendingPlayId])

  // 异步请求播放 - 保留以兼容现有代码
  const requestPlayAsync = useCallback(async (id: string): Promise<boolean> => {
    const player = state.registeredPlayers.get(id)
    if (!player) {
      return false
    }

    // 如果已经是当前播放的视频，直接返回成功
    if (state.currentPlayingId === id && player.isPlaying()) {
      return true
    }

    // 如果有播放请求正在进行且不是同一个视频，忽略此请求
    if (state.isPlayRequesting && state.pendingPlayId !== id) {
      return false
    }

    try {
      // Step 1: 发起播放请求
      dispatch({
        type: 'REQUEST_PLAY',
        payload: { id }
      })

      // Step 2: 尝试播放视频
      await player.play()
      
      // Step 3: 播放成功，更新状态
      dispatch({
        type: 'START_PLAYING',
        payload: { id }
      })
      
      return true
    } catch {
      // 播放失败，清除请求状态
      dispatch({
        type: 'PLAY_REQUEST_FAILED',
        payload: { id }
      })
      
      return false
    }
  }, [state.registeredPlayers, state.currentPlayingId, state.isPlayRequesting, state.pendingPlayId])

  // 通知暂停
  const notifyPause = useCallback((id: string) => {
    
    dispatch({
      type: 'STOP_PLAYING',
      payload: { id }
    })
  }, [])

  // 暂停所有视频
  const pauseAll = useCallback(() => {
    
    dispatch({ type: 'PAUSE_ALL' })
  }, [])

  // 立即停止所有视频
  const immediateStopAll = useCallback(() => {
    
    dispatch({ type: 'IMMEDIATE_STOP_ALL' })
  }, [])

  // 获取播放互斥锁
  const acquirePlayMutex = useCallback((id: string): boolean => {
    if (state.playMutex) {
      return false
    }
    
    dispatch({
      type: 'ACQUIRE_PLAY_MUTEX',
      payload: { id }
    })
    
    return true
  }, [state.playMutex])

  // 释放播放互斥锁
  const releasePlayMutex = useCallback(() => {
    
    dispatch({ type: 'RELEASE_PLAY_MUTEX' })
  }, [])

  // 检查是否为当前播放视频
  const isCurrentlyPlaying = useCallback((id: string) => {
    return state.currentPlayingId === id
  }, [state.currentPlayingId])

  // 检查是否正在请求播放
  const isPendingPlay = useCallback((id: string) => {
    return state.pendingPlayId === id
  }, [state.pendingPlayId])

  // 检查互斥锁状态
  const isPlayMutexLocked = useCallback(() => {
    return state.playMutex
  }, [state.playMutex])

  // 获取注册播放器数量
  const getRegisteredPlayerCount = useCallback(() => {
    return state.registeredPlayers.size
  }, [state.registeredPlayers])

  // Context 值
  const contextValue = useMemo<VideoPlaybackContextType>(() => ({
    currentPlayingId: state.currentPlayingId,
    registerPlayer,
    unregisterPlayer,
    requestPlay,
    requestPlayAsync,
    notifyPause,
    pauseAll,
    immediateStopAll,
    acquirePlayMutex,
    releasePlayMutex,
    isCurrentlyPlaying,
    isPendingPlay,
    isPlayMutexLocked,
    getRegisteredPlayerCount
  }), [
    state.currentPlayingId,
    registerPlayer,
    unregisterPlayer,
    requestPlay,
    requestPlayAsync,
    notifyPause,
    pauseAll,
    immediateStopAll,
    acquirePlayMutex,
    releasePlayMutex,
    isCurrentlyPlaying,
    isPendingPlay,
    isPlayMutexLocked,
    getRegisteredPlayerCount
  ])

  return (
    <VideoPlaybackContext.Provider value={contextValue}>
      {children}
    </VideoPlaybackContext.Provider>
  )
}

// Hook 使用 Context
export function useVideoPlayback(): VideoPlaybackContextType {
  const context = useContext(VideoPlaybackContext)
  
  if (!context) {
    throw new Error('useVideoPlayback 必须在 VideoPlaybackProvider 内使用')
  }
  
  return context
}

// 性能监控接口
interface PlaybackPerformanceMetrics {
  playRequestCount: number
  playSuccessCount: number
  playFailureCount: number
  averagePlaySwitchTime: number
  mutexWaitCount: number
  lastActionTime: number
  playRequestHistory: Array<{
    playerId: string
    timestamp: number
    success: boolean
    duration?: number
  }>
}

// 全局性能监控状态
const performanceMetrics: PlaybackPerformanceMetrics = {
  playRequestCount: 0,
  playSuccessCount: 0,
  playFailureCount: 0,
  averagePlaySwitchTime: 0,
  mutexWaitCount: 0,
  lastActionTime: 0,
  playRequestHistory: []
}

// 性能监控工具
export const VideoPlaybackPerformanceMonitor = {
  recordPlayRequest: (playerId: string, success: boolean, duration?: number) => {
    performanceMetrics.playRequestCount++
    if (success) {
      performanceMetrics.playSuccessCount++
    } else {
      performanceMetrics.playFailureCount++
    }
    
    performanceMetrics.playRequestHistory.push({
      playerId,
      timestamp: Date.now(),
      success,
      duration
    })
    
    // 只保留最近100条记录
    if (performanceMetrics.playRequestHistory.length > 100) {
      performanceMetrics.playRequestHistory.shift()
    }
    
    // 计算平均切换时间
    if (duration !== undefined) {
      const successfulRequests = performanceMetrics.playRequestHistory.filter(r => r.success && r.duration !== undefined)
      if (successfulRequests.length > 0) {
        const totalTime = successfulRequests.reduce((sum, r) => sum + (r.duration || 0), 0)
        performanceMetrics.averagePlaySwitchTime = totalTime / successfulRequests.length
      }
    }
    
    performanceMetrics.lastActionTime = Date.now()
    
  },
  
  recordMutexWait: () => {
    performanceMetrics.mutexWaitCount++
  },
  
  getMetrics: (): PlaybackPerformanceMetrics => ({ ...performanceMetrics }),
  
  getSuccessRate: () => {
    if (performanceMetrics.playRequestCount === 0) return 100
    return (performanceMetrics.playSuccessCount / performanceMetrics.playRequestCount) * 100
  },
  
  reset: () => {
    performanceMetrics.playRequestCount = 0
    performanceMetrics.playSuccessCount = 0
    performanceMetrics.playFailureCount = 0
    performanceMetrics.averagePlaySwitchTime = 0
    performanceMetrics.mutexWaitCount = 0
    performanceMetrics.playRequestHistory = []
  }
}

// 开发环境调试 Hook
export function useVideoPlaybackDebug() {
  const context = useContext(VideoPlaybackContext)
  
  if (!context) {
    throw new Error('useVideoPlaybackDebug 必须在 VideoPlaybackProvider 内使用')
  }
  
  return {
    ...context,
    enableDebug: () => {
    },
    getDebugInfo: () => ({
      currentPlayingId: context.currentPlayingId,
      registeredPlayerCount: context.getRegisteredPlayerCount(),
      performanceMetrics: VideoPlaybackPerformanceMonitor.getMetrics(),
      successRate: VideoPlaybackPerformanceMonitor.getSuccessRate()
    }),
    performanceMonitor: VideoPlaybackPerformanceMonitor
  }
}