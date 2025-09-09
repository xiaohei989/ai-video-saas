/**
 * 智能资源预加载控制器
 * 根据用户行为和路由预测需要的资源，避免不必要的预加载
 */

import { useEffect } from 'react'

interface PreloadConfig {
  route: string
  resources: string[]
  condition?: () => boolean
  priority: 'high' | 'medium' | 'low'
  delay?: number
}

class SmartPreloader {
  private preloadedResources = new Set<string>()
  private preloadQueue: PreloadConfig[] = []
  private observer: IntersectionObserver | null = null
  private currentRoute = '/'
  private userInteracted = false

  constructor() {
    this.initializeObserver()
    this.setupEventListeners()
  }

  /**
   * 初始化交集观察器
   */
  private initializeObserver(): void {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const route = entry.target.getAttribute('data-route')
              if (route) {
                this.preloadForRoute(route)
              }
            }
          })
        },
        { threshold: 0.1 }
      )
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听用户首次交互
    const handleFirstInteraction = () => {
      this.userInteracted = true
      this.processPreloadQueue()
      
      // 移除监听器
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('scroll', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }

    document.addEventListener('click', handleFirstInteraction, { once: true })
    document.addEventListener('scroll', handleFirstInteraction, { once: true })
    document.addEventListener('touchstart', handleFirstInteraction, { once: true })

    // 监听网络变化
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection) {
        connection.addEventListener('change', () => {
          if (connection.effectiveType === '4g' && this.userInteracted) {
            this.processHighPriorityPreloads()
          }
        })
      }
    }
  }

  /**
   * 注册预加载配置
   */
  registerPreload(config: PreloadConfig): void {
    this.preloadQueue.push(config)
  }

  /**
   * 更新当前路由
   */
  setCurrentRoute(route: string): void {
    this.currentRoute = route
    this.preloadForRoute(route)
  }

  /**
   * 为特定路由预加载资源
   */
  private preloadForRoute(route: string): void {
    const configs = this.preloadQueue.filter(config => 
      config.route === route && 
      (!config.condition || config.condition()) &&
      !this.isResourcePreloaded(config.resources)
    )

    configs.forEach(config => {
      const delay = config.delay || (config.priority === 'high' ? 0 : 1000)
      setTimeout(() => {
        this.preloadResources(config.resources, config.priority)
      }, delay)
    })
  }

  /**
   * 检查资源是否已预加载
   */
  private isResourcePreloaded(resources: string[]): boolean {
    return resources.some(resource => this.preloadedResources.has(resource))
  }

  /**
   * 预加载资源
   */
  private preloadResources(resources: string[], priority: 'high' | 'medium' | 'low'): void {
    if (!this.userInteracted && priority !== 'high') {
      return // 用户未交互时只加载高优先级资源
    }

    resources.forEach(resource => {
      if (!this.preloadedResources.has(resource)) {
        this.preloadSingleResource(resource, priority)
        this.preloadedResources.add(resource)
      }
    })
  }

  /**
   * 预加载单个资源
   */
  private preloadSingleResource(url: string, priority: 'high' | 'medium' | 'low'): void {
    if (document.head.querySelector(`link[href="${url}"]`)) {
      return // 资源已存在
    }

    const link = document.createElement('link')
    link.rel = 'preload'
    
    // 根据文件类型设置合适的 as 属性
    if (url.includes('.js')) {
      link.as = 'script'
    } else if (url.includes('.css')) {
      link.as = 'style'
    } else if (url.includes('.woff2') || url.includes('.woff')) {
      link.as = 'font'
      link.crossOrigin = 'anonymous'
    } else if (url.includes('.mp4') || url.includes('.webm')) {
      link.as = 'video'
    } else {
      link.as = 'fetch'
      link.crossOrigin = 'anonymous'
    }
    
    link.href = url
    
    // 设置优先级
    if (priority === 'high') {
      link.setAttribute('importance', 'high')
    } else if (priority === 'low') {
      link.setAttribute('importance', 'low')
    }

    // 错误处理
    link.onerror = () => {
      console.warn(`Failed to preload resource: ${url}`)
      this.preloadedResources.delete(url)
    }

    document.head.appendChild(link)
  }

  /**
   * 处理预加载队列
   */
  private processPreloadQueue(): void {
    const currentConfigs = this.preloadQueue.filter(config => 
      config.route === this.currentRoute
    )

    // 按优先级排序
    currentConfigs.sort((a, b) => {
      const priorityMap = { high: 3, medium: 2, low: 1 }
      return priorityMap[b.priority] - priorityMap[a.priority]
    })

    currentConfigs.forEach(config => {
      if (!config.condition || config.condition()) {
        this.preloadResources(config.resources, config.priority)
      }
    })
  }

  /**
   * 处理高优先级预加载
   */
  private processHighPriorityPreloads(): void {
    const highPriorityConfigs = this.preloadQueue.filter(config => 
      config.priority === 'high' && 
      (!config.condition || config.condition())
    )

    highPriorityConfigs.forEach(config => {
      this.preloadResources(config.resources, config.priority)
    })
  }

  /**
   * 观察路由链接
   */
  observeRouteLink(element: HTMLElement, route: string): void {
    if (this.observer) {
      element.setAttribute('data-route', route)
      this.observer.observe(element)
    }
  }

  /**
   * 取消观察
   */
  unobserve(element: HTMLElement): void {
    if (this.observer) {
      this.observer.unobserve(element)
    }
  }

  /**
   * 清理
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect()
    }
    this.preloadQueue = []
    this.preloadedResources.clear()
  }
}

// 创建全局实例
export const smartPreloader = new SmartPreloader()

/**
 * 初始化智能预加载配置
 */
export function initializeSmartPreloading(): void {
  // 首页预加载配置
  smartPreloader.registerPreload({
    route: '/',
    resources: [],
    priority: 'high',
    condition: () => true
  })

  // 模板页预加载
  smartPreloader.registerPreload({
    route: '/templates',
    resources: ['/api/templates'],
    priority: 'medium',
    delay: 500
  })

  // 视频创建页预加载
  smartPreloader.registerPreload({
    route: '/create',
    resources: [],
    priority: 'medium',
    condition: () => !!localStorage.getItem('user_session')
  })

  // 用户视频页预加载
  smartPreloader.registerPreload({
    route: '/videos',
    resources: [],
    priority: 'low',
    condition: () => !!localStorage.getItem('user_session')
  })

  // 付费页面预加载
  smartPreloader.registerPreload({
    route: '/pricing',
    resources: ['/api/stripe-config'],
    priority: 'low',
    delay: 1000
  })
}

/**
 * React Hook for smart preloading
 */

export function useSmartPreload(route: string) {
  useEffect(() => {
    smartPreloader.setCurrentRoute(route)
    
    return () => {
      // 清理工作在组件卸载时进行
    }
  }, [route])
}