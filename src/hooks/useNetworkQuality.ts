/**
 * 网络质量检测 Hook
 * 
 * 功能：
 * 1. 检测网络连接类型和速度
 * 2. 监控网络变化
 * 3. 提供视频质量建议
 * 4. 检测省流量模式
 * 5. 网络测速功能
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import videoLoaderService, { type NetworkQuality } from '@/services/VideoLoaderService'

export interface NetworkInfo extends NetworkQuality {
  // 扩展的网络信息
  isOnline: boolean
  isSlowConnection: boolean
  isMobileConnection: boolean
  supportsSaveData: boolean
  
  // 质量评级
  qualityRating: 'excellent' | 'good' | 'fair' | 'poor'
  recommendedVideoQuality: 'high' | 'medium' | 'low'
  
  // 测试结果
  lastSpeedTest?: {
    timestamp: number
    downloadSpeed: number // Mbps
    latency: number // ms
    testUrl: string
  }
}

export interface NetworkActions {
  // 手动测速
  runSpeedTest: () => Promise<void>
  
  // 刷新网络信息
  refresh: () => void
  
  // 获取建议的视频设置
  getVideoSettings: () => {
    quality: 'high' | 'medium' | 'low'
    preload: 'none' | 'metadata' | 'auto'
    enableRangeRequests: boolean
  }
}

export function useNetworkQuality(): [NetworkInfo, NetworkActions] {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    type: 'unknown',
    downlink: 1,
    rtt: 300,
    saveData: false,
    isOnline: navigator.onLine,
    isSlowConnection: false,
    isMobileConnection: false,
    supportsSaveData: 'connection' in navigator && 'saveData' in (navigator as any).connection,
    qualityRating: 'fair',
    recommendedVideoQuality: 'medium'
  })

  const speedTestRef = useRef<boolean>(false)

  /**
   * 检测网络信息
   */
  const detectNetworkInfo = useCallback((): void => {
    const online = navigator.onLine
    let connection: any = null

    // 获取网络连接信息
    if ('connection' in navigator) {
      connection = (navigator as any).connection
    } else if ('mozConnection' in navigator) {
      connection = (navigator as any).mozConnection
    } else if ('webkitConnection' in navigator) {
      connection = (navigator as any).webkitConnection
    }

    if (connection) {
      const type = connection.effectiveType || 'unknown'
      const downlink = connection.downlink || 1
      const rtt = connection.rtt || 300
      const saveData = connection.saveData || false

      // 判断网络质量等级
      const qualityRating = getQualityRating(downlink, rtt, type)
      const recommendedVideoQuality = getRecommendedVideoQuality(downlink, rtt, saveData)
      
      // 判断是否为慢速连接
      const isSlowConnection = downlink < 1.5 || rtt > 400 || type === 'slow-2g' || type === '2g'
      
      // 判断是否为移动网络
      const isMobileConnection = type === '2g' || type === '3g' || type === '4g'

      const newNetworkInfo: NetworkInfo = {
        type,
        downlink,
        rtt,
        saveData,
        isOnline: online,
        isSlowConnection,
        isMobileConnection,
        supportsSaveData: 'saveData' in connection,
        qualityRating,
        recommendedVideoQuality,
        lastSpeedTest: networkInfo.lastSpeedTest
      }

      setNetworkInfo(newNetworkInfo)
      
    } else {
      // 浏览器不支持Network Information API，使用后备方案
      setNetworkInfo(prev => ({
        ...prev,
        isOnline: online,
        supportsSaveData: false
      }))
    }
  }, [networkInfo.lastSpeedTest])

  /**
   * 获取质量评级
   */
  const getQualityRating = (
    downlink: number,
    rtt: number,
    type: string
  ): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (type === 'slow-2g' || downlink < 0.5 || rtt > 1000) {
      return 'poor'
    } else if (type === '2g' || downlink < 1.5 || rtt > 400) {
      return 'fair'
    } else if (type === '3g' || downlink < 5 || rtt > 150) {
      return 'good'
    } else {
      return 'excellent'
    }
  }

  /**
   * 获取推荐的视频质量
   */
  const getRecommendedVideoQuality = (
    downlink: number,
    rtt: number,
    saveData: boolean
  ): 'high' | 'medium' | 'low' => {
    if (saveData) {
      return 'low'
    }

    if (downlink >= 5 && rtt <= 100) {
      return 'high'
    } else if (downlink >= 1.5 && rtt <= 300) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  /**
   * 手动测速
   */
  const runSpeedTest = useCallback(async (): Promise<void> => {
    if (speedTestRef.current) {
      console.log('[NetworkQuality] Speed test already running')
      return
    }

    speedTestRef.current = true

    try {
      // 使用一个小的测试文件进行测速
      const testUrl = '/templates/videos/asmr-surreal-toast-spread.mp4'
      const testSize = 1024 * 1024 // 1MB 测试大小
      
      const startTime = Date.now()
      
      // 发起Range请求下载前1MB
      const response = await fetch(testUrl, {
        headers: {
          'Range': `bytes=0-${testSize - 1}`,
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error('Speed test request failed')
      }

      // 读取数据以确保完整下载
      await response.arrayBuffer()
      
      const endTime = Date.now()
      const duration = endTime - startTime // ms
      const downloadedBytes = testSize
      
      // 计算下载速度 (Mbps)
      const downloadSpeed = (downloadedBytes * 8) / (duration) / 1000 // Mbps
      
      // 延迟测试 - 发送一个HEAD请求
      const latencyStart = Date.now()
      await fetch(testUrl, { method: 'HEAD', cache: 'no-cache' })
      const latency = Date.now() - latencyStart

      const testResult = {
        timestamp: Date.now(),
        downloadSpeed: Math.round(downloadSpeed * 100) / 100,
        latency,
        testUrl
      }

      setNetworkInfo(prev => ({
        ...prev,
        lastSpeedTest: testResult,
        downlink: testResult.downloadSpeed,
        rtt: testResult.latency,
        qualityRating: getQualityRating(testResult.downloadSpeed, testResult.latency, prev.type),
        recommendedVideoQuality: getRecommendedVideoQuality(
          testResult.downloadSpeed,
          testResult.latency,
          prev.saveData
        )
      }))

      console.log('[NetworkQuality] Speed test completed:', testResult)
    } catch (error) {
      console.error('[NetworkQuality] Speed test failed:', error)
    } finally {
      speedTestRef.current = false
    }
  }, [])

  /**
   * 刷新网络信息
   */
  const refresh = useCallback((): void => {
    detectNetworkInfo()
  }, [detectNetworkInfo])

  /**
   * 获取视频设置建议
   */
  const getVideoSettings = useCallback(() => {
    const { downlink, rtt, saveData, isSlowConnection } = networkInfo

    let quality: 'high' | 'medium' | 'low' = 'medium'
    let preload: 'none' | 'metadata' | 'auto' = 'metadata'
    let enableRangeRequests = true

    // 根据网络状况调整设置
    if (saveData || isSlowConnection) {
      quality = 'low'
      preload = 'none'
      enableRangeRequests = false
    } else if (downlink >= 5 && rtt <= 100) {
      quality = 'high'
      preload = 'auto'
      enableRangeRequests = true
    } else if (downlink >= 1.5 && rtt <= 300) {
      quality = 'medium'
      preload = 'metadata'
      enableRangeRequests = true
    } else {
      quality = 'low'
      preload = 'none'
      enableRangeRequests = false
    }

    return { quality, preload, enableRangeRequests }
  }, [networkInfo])

  // 初始化网络检测
  useEffect(() => {
    detectNetworkInfo()
  }, [])

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = () => {
      setNetworkInfo(prev => ({ ...prev, isOnline: true }))
      detectNetworkInfo()
    }

    const handleOffline = () => {
      setNetworkInfo(prev => ({ ...prev, isOnline: false }))
    }

    const handleConnectionChange = () => {
      detectNetworkInfo()
    }

    // 添加事件监听器
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Network Information API 变化监听
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener('change', handleConnectionChange)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        connection.removeEventListener('change', handleConnectionChange)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [detectNetworkInfo])

  // 与 VideoLoaderService 同步
  useEffect(() => {
    const loaderNetworkInfo = videoLoaderService.getNetworkQuality()
    if (loaderNetworkInfo && JSON.stringify(loaderNetworkInfo) !== JSON.stringify({
      type: networkInfo.type,
      downlink: networkInfo.downlink,
      rtt: networkInfo.rtt,
      saveData: networkInfo.saveData
    })) {
      // 如果信息不一致，触发同步更新
      detectNetworkInfo()
    }
  }, [networkInfo, detectNetworkInfo])

  const actions: NetworkActions = {
    runSpeedTest,
    refresh,
    getVideoSettings
  }

  return [networkInfo, actions]
}

/**
 * 简化版网络质量 Hook，只提供基本信息
 */
export function useSimpleNetworkQuality() {
  const [networkInfo] = useNetworkQuality()
  
  return {
    isOnline: networkInfo.isOnline,
    isSlowConnection: networkInfo.isSlowConnection,
    saveData: networkInfo.saveData,
    recommendedQuality: networkInfo.recommendedVideoQuality,
    qualityRating: networkInfo.qualityRating
  }
}

/**
 * 网络自适应 Hook，提供网络变化时的回调
 */
export function useNetworkAdaptive(
  onNetworkChange?: (networkInfo: NetworkInfo) => void
) {
  const [networkInfo, actions] = useNetworkQuality()
  const prevNetworkRef = useRef<NetworkInfo | undefined>(undefined)

  useEffect(() => {
    // 检查网络信息是否发生重要变化
    const prev = prevNetworkRef.current
    if (prev && onNetworkChange) {
      const hasSignificantChange = 
        prev.isOnline !== networkInfo.isOnline ||
        prev.recommendedVideoQuality !== networkInfo.recommendedVideoQuality ||
        prev.saveData !== networkInfo.saveData ||
        Math.abs(prev.downlink - networkInfo.downlink) > 1 // 速度变化超过1Mbps

      if (hasSignificantChange) {
        onNetworkChange(networkInfo)
      }
    }

    prevNetworkRef.current = networkInfo
  }, [networkInfo, onNetworkChange])

  return { networkInfo, actions }
}

/**
 * 自动质量调整 Hook
 */
export function useAutoVideoQuality(videoUrl: string) {
  const [networkInfo, { getVideoSettings }] = useNetworkQuality()
  const [currentQuality, setCurrentQuality] = useState<'high' | 'medium' | 'low'>('medium')

  // 根据网络状况自动调整质量
  useEffect(() => {
    const settings = getVideoSettings()
    if (settings.quality !== currentQuality) {
      setCurrentQuality(settings.quality)
      console.log(`[AutoVideoQuality] Quality adjusted to ${settings.quality} for ${videoUrl}`)
    }
  }, [networkInfo, getVideoSettings, currentQuality, videoUrl])

  return {
    quality: currentQuality,
    networkInfo,
    settings: getVideoSettings()
  }
}