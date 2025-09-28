/**
 * 性能监控相关的自定义Hook
 * 包含页面加载性能监控、FCP测量、分析数据发送等逻辑
 */

import { useState, useEffect, useCallback, useContext } from 'react'
import analyticsService from '@/services/analyticsService'
import { AuthContext } from '@/contexts/AuthContext'
import type { PerformanceMetrics, DeviceType } from '@/types/video.types'

interface UsePerformanceMonitorOptions {
  enableAnalytics?: boolean
  pageName?: string
}

interface UsePerformanceMonitorReturn {
  // 状态
  performanceMetrics: PerformanceMetrics
  isMobile: boolean

  // 操作
  incrementCacheHit: () => void
  incrementNetworkRequest: () => void
  recordTimeToInteractive: (time: number) => void
  recordTotalLoadTime: (time: number) => void
}

export function usePerformanceMonitor(options: UsePerformanceMonitorOptions = {}): UsePerformanceMonitorReturn {
  const {
    enableAnalytics = true,
    pageName = 'videos'
  } = options

  const authContext = useContext(AuthContext)
  const user = authContext?.user

  // 状态管理
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    pageLoadStart: 0,
    firstContentfulPaint: 0,
    timeToInteractive: 0,
    cacheHitCount: 0,
    networkRequestCount: 0,
    totalLoadTime: 0
  })

  // 设备检测
  const isMobile = typeof window !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  const deviceType: DeviceType = isMobile ? 'mobile' : 'desktop'

  /**
   * 增加缓存命中计数
   */
  const incrementCacheHit = useCallback(() => {
    setPerformanceMetrics(prev => ({
      ...prev,
      cacheHitCount: prev.cacheHitCount + 1
    }))
  }, [])

  /**
   * 增加网络请求计数
   */
  const incrementNetworkRequest = useCallback(() => {
    setPerformanceMetrics(prev => ({
      ...prev,
      networkRequestCount: prev.networkRequestCount + 1
    }))
  }, [])

  /**
   * 记录可交互时间
   */
  const recordTimeToInteractive = useCallback((time: number) => {
    setPerformanceMetrics(prev => ({
      ...prev,
      timeToInteractive: time
    }))

    // 发送分析数据
    if (enableAnalytics && analyticsService && typeof analyticsService.track === 'function') {
      analyticsService.track('page_performance', {
        metric: 'time_to_interactive',
        value: time,
        device_type: deviceType,
        page: pageName
      })
    }
  }, [enableAnalytics, deviceType, pageName])

  /**
   * 记录总加载时间
   */
  const recordTotalLoadTime = useCallback((time: number) => {
    setPerformanceMetrics(prev => ({
      ...prev,
      totalLoadTime: time
    }))

    // 发送分析数据
    if (enableAnalytics && analyticsService && typeof analyticsService.track === 'function') {
      analyticsService.track('page_performance', {
        metric: 'total_load_time',
        value: time,
        device_type: deviceType,
        page: pageName
      })
    }
  }, [enableAnalytics, deviceType, pageName])

  /**
   * 测量首次内容绘制时间
   */
  const measureFCP = useCallback(() => {
    if ('getEntriesByType' in performance) {
      const paintEntries = performance.getEntriesByType('paint')
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')

      if (fcpEntry) {
        setPerformanceMetrics(prev => ({
          ...prev,
          firstContentfulPaint: fcpEntry.startTime
        }))


        // 发送分析数据
        if (enableAnalytics && analyticsService && typeof analyticsService.track === 'function') {
          analyticsService.track('page_performance', {
            metric: 'first_contentful_paint',
            value: fcpEntry.startTime,
            device_type: deviceType,
            page: pageName
          })
        }
      }
    }
  }, [enableAnalytics, deviceType, pageName])

  /**
   * 初始化性能监控
   */
  useEffect(() => {
    if (!user) return

    const pageLoadStart = performance.now()
    setPerformanceMetrics(prev => ({ ...prev, pageLoadStart }))


    // 延迟测量FCP，确保渲染完成
    setTimeout(measureFCP, 100)

    return () => {
      // 组件卸载时发送最终性能数据
      const totalTime = performance.now() - pageLoadStart

      if (enableAnalytics && analyticsService && typeof analyticsService.track === 'function') {
        analyticsService.track('page_performance_summary', {
          total_time: totalTime,
          cache_hit_count: performanceMetrics.cacheHitCount,
          network_request_count: performanceMetrics.networkRequestCount,
          first_contentful_paint: performanceMetrics.firstContentfulPaint,
          time_to_interactive: performanceMetrics.timeToInteractive,
          device_type: deviceType,
          page: pageName
        })
      }
    }
  }, [user, pageName, enableAnalytics, deviceType, measureFCP])

  /**
   * Web Vitals 监控
   */
  useEffect(() => {
    if (!enableAnalytics || typeof window === 'undefined') return

    // 监控 Largest Contentful Paint (LCP)
    const observeLCP = () => {
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const lastEntry = entries[entries.length - 1]

            if (lastEntry && analyticsService && typeof analyticsService.track === 'function') {
              analyticsService.track('web_vitals', {
                metric: 'largest_contentful_paint',
                value: lastEntry.startTime,
                device_type: deviceType,
                page: pageName
              })
            }
          })

          observer.observe({ type: 'largest-contentful-paint', buffered: true })

          return () => observer.disconnect()
        } catch (error) {
        }
      }
    }

    // 监控 Cumulative Layout Shift (CLS)
    const observeCLS = () => {
      if ('PerformanceObserver' in window) {
        try {
          let clsValue = 0

          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value
              }
            }
          })

          observer.observe({ type: 'layout-shift', buffered: true })

          // 定期报告CLS值
          const reportCLS = () => {
            if (clsValue > 0 && analyticsService && typeof analyticsService.track === 'function') {
              analyticsService.track('web_vitals', {
                metric: 'cumulative_layout_shift',
                value: clsValue,
                device_type: deviceType,
                page: pageName
              })
            }
          }

          const clsTimer = setInterval(reportCLS, 5000) // 每5秒报告一次

          return () => {
            observer.disconnect()
            clearInterval(clsTimer)
          }
        } catch (error) {
        }
      }
    }

    // 监控 First Input Delay (FID)
    const observeFID = () => {
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (analyticsService && typeof analyticsService.track === 'function') {
                analyticsService.track('web_vitals', {
                  metric: 'first_input_delay',
                  value: (entry as any).processingStart - entry.startTime,
                  device_type: deviceType,
                  page: pageName
                })
              }
            }
          })

          observer.observe({ type: 'first-input', buffered: true })

          return () => observer.disconnect()
        } catch (error) {
        }
      }
    }

    // 启动所有观察器
    const cleanup = [
      observeLCP(),
      observeCLS(),
      observeFID()
    ].filter(Boolean)

    return () => {
      cleanup.forEach(fn => fn && fn())
    }
  }, [enableAnalytics, deviceType, pageName])

  return {
    // 状态
    performanceMetrics,
    isMobile,

    // 操作
    incrementCacheHit,
    incrementNetworkRequest,
    recordTimeToInteractive,
    recordTotalLoadTime
  }
}