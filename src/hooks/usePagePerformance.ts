/**
 * 页面性能监控Hook
 * 收集详细的页面性能数据，包括React渲染性能
 */

import { useEffect, useRef, useState, useCallback } from 'react'

export interface PagePerformanceData {
  // Core Web Vitals
  fcp: number | null // First Contentful Paint
  lcp: number | null // Largest Contentful Paint
  fid: number | null // First Input Delay
  cls: number | null // Cumulative Layout Shift
  
  // 导航时机
  navigationStart: number
  domContentLoaded: number
  domComplete: number
  loadComplete: number
  
  // React 性能
  componentMounts: number
  componentUpdates: number
  componentUnmounts: number
  renderTime: number
  
  // 资源加载
  jsHeapSize: number
  resourceCount: number
  imageCount: number
  cssCount: number
  
  // 用户体验
  scrollDepth: number
  interactionCount: number
  errorCount: number
  
  // 设备信息
  devicePixelRatio: number
  connectionType: string
  hardwareConcurrency: number
}

export interface PerformanceConfig {
  enableWebVitals?: boolean
  enableResourceTracking?: boolean
  enableUserInteractions?: boolean
  sampleRate?: number // 0-1, 采样率
}

export function usePagePerformance(config: PerformanceConfig = {}) {
  const {
    enableWebVitals = true,
    enableResourceTracking = true,
    enableUserInteractions = true,
    sampleRate = 1
  } = config
  
  const [performanceData, setPerformanceData] = useState<PagePerformanceData | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  
  // 计数器引用
  const countersRef = useRef({
    componentMounts: 0,
    componentUpdates: 0,
    componentUnmounts: 0,
    interactions: 0,
    errors: 0,
    maxScrollDepth: 0,
    renderStart: 0
  })
  
  // Web Vitals 收集
  const collectWebVitals = useCallback(() => {
    if (!enableWebVitals) return {}
    
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    return {
      navigationStart: navigation?.navigationStart || 0,
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.navigationStart || 0,
      domComplete: navigation?.domComplete - navigation?.navigationStart || 0,
      loadComplete: navigation?.loadEventEnd - navigation?.navigationStart || 0
    }
  }, [enableWebVitals])
  
  // 资源统计
  const collectResourceStats = useCallback(() => {
    if (!enableResourceTracking) return {}
    
    const resources = performance.getEntriesByType('resource')
    const images = resources.filter(r => r.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i))
    const css = resources.filter(r => r.name.includes('.css'))
    
    const memory = (performance as any).memory
    
    return {
      resourceCount: resources.length,
      imageCount: images.length,
      cssCount: css.length,
      jsHeapSize: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0
    }
  }, [enableResourceTracking])
  
  // 设备信息
  const collectDeviceInfo = useCallback(() => {
    const connection = (navigator as any).connection
    
    return {
      devicePixelRatio: window.devicePixelRatio || 1,
      connectionType: connection?.effectiveType || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 0
    }
  }, [])
  
  // 滚动深度追踪
  const trackScrollDepth = useCallback(() => {
    if (!enableUserInteractions) return
    
    const scrollDepth = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    )
    
    if (scrollDepth > countersRef.current.maxScrollDepth) {
      countersRef.current.maxScrollDepth = Math.min(scrollDepth, 100)
    }
  }, [enableUserInteractions])
  
  // 收集所有性能数据
  const collectPerformanceData = useCallback((): PagePerformanceData => {
    const renderTime = countersRef.current.renderStart 
      ? performance.now() - countersRef.current.renderStart 
      : 0
    
    return {
      fcp: null, // 需要通过 PerformanceObserver 获取
      lcp: null,
      fid: null,
      cls: null,
      ...collectWebVitals(),
      componentMounts: countersRef.current.componentMounts,
      componentUpdates: countersRef.current.componentUpdates,
      componentUnmounts: countersRef.current.componentUnmounts,
      renderTime: Math.round(renderTime * 100) / 100,
      ...collectResourceStats(),
      scrollDepth: countersRef.current.maxScrollDepth,
      interactionCount: countersRef.current.interactions,
      errorCount: countersRef.current.errors,
      ...collectDeviceInfo()
    }
  }, [collectWebVitals, collectResourceStats, collectDeviceInfo])
  
  // 开始性能追踪
  const startTracking = useCallback(() => {
    if (Math.random() > sampleRate) return
    
    setIsTracking(true)
    countersRef.current.renderStart = performance.now()
    
    // 设置 Web Vitals 观察器
    if (enableWebVitals && 'PerformanceObserver' in window) {
      try {
        // LCP Observer
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          if (lastEntry?.renderTime || lastEntry?.loadTime) {
            setPerformanceData(prev => prev ? {
              ...prev,
              lcp: lastEntry.renderTime || lastEntry.loadTime
            } : null)
          }
        })
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
        
        // FID Observer
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach(entry => {
            setPerformanceData(prev => prev ? {
              ...prev,
              fid: (entry as any).processingStart - entry.startTime
            } : null)
          })
        })
        fidObserver.observe({ type: 'first-input', buffered: true })
        
        // CLS Observer
        let clsScore = 0
        const clsObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (!(entry as any).hadRecentInput) {
              clsScore += (entry as any).value
              setPerformanceData(prev => prev ? {
                ...prev,
                cls: clsScore
              } : null)
            }
          })
        })
        clsObserver.observe({ type: 'layout-shift', buffered: true })
        
      } catch (error) {
        console.warn('Performance Observer not fully supported:', error)
      }
    }
    
    // 滚动追踪
    if (enableUserInteractions) {
      const handleScroll = () => {
        trackScrollDepth()
        countersRef.current.interactions++
      }
      
      const handleClick = () => {
        countersRef.current.interactions++
      }
      
      const handleError = () => {
        countersRef.current.errors++
      }
      
      window.addEventListener('scroll', handleScroll, { passive: true })
      window.addEventListener('click', handleClick)
      window.addEventListener('error', handleError)
      
      return () => {
        window.removeEventListener('scroll', handleScroll)
        window.removeEventListener('click', handleClick)
        window.removeEventListener('error', handleError)
      }
    }
  }, [sampleRate, enableWebVitals, enableUserInteractions, trackScrollDepth])
  
  // React 生命周期计数器
  const trackComponentMount = useCallback(() => {
    countersRef.current.componentMounts++
  }, [])
  
  const trackComponentUpdate = useCallback(() => {
    countersRef.current.componentUpdates++
  }, [])
  
  const trackComponentUnmount = useCallback(() => {
    countersRef.current.componentUnmounts++
  }, [])
  
  // 生成性能报告
  const generateReport = useCallback(() => {
    const data = collectPerformanceData()
    return {
      ...data,
      performance: {
        excellent: (data.lcp || 0) < 1500 && (data.fid || 0) < 100 && (data.cls || 0) < 0.1,
        good: (data.lcp || 0) < 2500 && (data.fid || 0) < 300 && (data.cls || 0) < 0.25,
        needsImprovement: true
      },
      recommendations: []
    }
  }, [collectPerformanceData])
  
  // 定期更新性能数据
  useEffect(() => {
    if (!isTracking) return
    
    const updateData = () => {
      const data = collectPerformanceData()
      setPerformanceData(data)
    }
    
    updateData()
    const interval = setInterval(updateData, 1000)
    
    return () => clearInterval(interval)
  }, [isTracking, collectPerformanceData])
  
  // 页面加载时自动开始追踪
  useEffect(() => {
    const cleanup = startTracking()
    
    return () => {
      cleanup?.()
      setIsTracking(false)
    }
  }, [startTracking])
  
  return {
    performanceData,
    isTracking,
    trackComponentMount,
    trackComponentUpdate,
    trackComponentUnmount,
    generateReport,
    startTracking,
    stopTracking: () => setIsTracking(false)
  }
}