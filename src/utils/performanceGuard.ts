/**
 * 移动端性能保护系统
 * 监控系统资源使用情况，在性能下降时自动采取保护措施
 */

import { log } from '@/utils/logger'
import videoPlaybackManager from '@/utils/videoPlaybackManager'
import timerManager from '@/utils/timerManager'

export interface PerformanceMetrics {
  // 内存相关
  memoryUsage: number
  memoryLimit: number
  memoryPressure: number // 0-1

  // CPU相关
  cpuPressure: number // 估算值 0-1
  
  // 网络相关
  connectionType: string
  effectiveType: string
  
  // 设备相关
  deviceMemory?: number
  hardwareConcurrency: number
  
  // 性能相关
  frameRate: number
  isLowPowerMode: boolean
  batteryLevel?: number
  
  // 时间戳
  timestamp: number
}

export interface PerformanceThresholds {
  memoryPressureWarning: number // 内存压力警告阈值
  memoryPressureCritical: number // 内存压力临界阈值
  frameRateWarning: number // 帧率警告阈值
  cpuPressureWarning: number // CPU压力警告阈值
  batteryLowThreshold: number // 低电量阈值
}

type PerformanceLevel = 'high' | 'normal' | 'low' | 'critical'
type ProtectionAction = 'reduceVideoQuality' | 'limitConcurrency' | 'pauseAnimations' | 'clearCaches' | 'emergencyMode'

class PerformanceGuard {
  private isActive: boolean = false
  private isMobile: boolean = false
  private currentLevel: PerformanceLevel = 'normal'
  private metrics: PerformanceMetrics | null = null
  private monitoringInterval: number | null = null
  
  // 性能阈值
  private thresholds: PerformanceThresholds = {
    memoryPressureWarning: 0.7,   // 70%内存使用率
    memoryPressureCritical: 0.9,  // 90%内存使用率
    frameRateWarning: 20,         // 20fps以下
    cpuPressureWarning: 0.8,      // 80%CPU使用率
    batteryLowThreshold: 0.2      // 20%电量
  }

  // 帧率监控
  private frameCount = 0
  private lastFrameTime = performance.now()
  private currentFPS = 60

  // 保护措施历史
  private protectionHistory: Array<{
    action: ProtectionAction
    timestamp: number
    trigger: string
  }> = []

  constructor() {
    this.detectDevice()
    this.initializeFrameRateMonitoring()
  }

  /**
   * 检测设备类型和基础能力
   */
  private detectDevice(): void {
    if (typeof window === 'undefined') return

    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    // 移动端调整阈值
    if (this.isMobile) {
      this.thresholds.memoryPressureWarning = 0.6  // 移动端更保守
      this.thresholds.memoryPressureCritical = 0.8
      this.thresholds.frameRateWarning = 15
    }

    log.debug('性能守护初始化', { 
      isMobile: this.isMobile,
      thresholds: this.thresholds
    })
  }

  /**
   * 启动性能监控
   */
  start(): void {
    if (this.isActive) return

    this.isActive = true
    
    // 根据设备类型调整监控频率
    const monitorInterval = this.isMobile ? 5000 : 3000 // 移动端5秒，桌面端3秒
    
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics()
      this.evaluatePerformance()
    }, monitorInterval)

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    
    // 监听内存压力事件（如果支持）
    if ('memory' in performance) {
      this.setupMemoryMonitoring()
    }

    log.info('性能守护已启动', { monitorInterval })
  }

  /**
   * 停止性能监控
   */
  stop(): void {
    if (!this.isActive) return

    this.isActive = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this))

    log.info('性能守护已停止')
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      memoryUsage: 0,
      memoryLimit: 0,
      memoryPressure: 0,
      cpuPressure: this.estimateCPUPressure(),
      connectionType: this.getConnectionType(),
      effectiveType: this.getEffectiveConnectionType(),
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      frameRate: this.currentFPS,
      isLowPowerMode: this.detectLowPowerMode()
    }

    // 收集内存信息
    if ('memory' in performance) {
      const memory = (performance as any).memory
      metrics.memoryUsage = memory.usedJSMemorySize
      metrics.memoryLimit = memory.jsMemoryLimit
      metrics.memoryPressure = metrics.memoryUsage / metrics.memoryLimit
    }

    // 收集设备内存信息
    if ('deviceMemory' in navigator) {
      metrics.deviceMemory = (navigator as any).deviceMemory
    }

    // 收集电池信息
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        metrics.batteryLevel = battery.level
      }).catch(() => {
        // 忽略电池信息获取错误
      })
    }

    this.metrics = metrics
  }

  /**
   * 评估性能级别并采取措施
   */
  private evaluatePerformance(): void {
    if (!this.metrics) return

    const oldLevel = this.currentLevel
    let newLevel: PerformanceLevel = 'high'

    // 基于多个指标评估性能级别
    const issues: string[] = []

    // 内存压力检查
    if (this.metrics.memoryPressure >= this.thresholds.memoryPressureCritical) {
      newLevel = 'critical'
      issues.push('内存压力临界')
    } else if (this.metrics.memoryPressure >= this.thresholds.memoryPressureWarning) {
      newLevel = Math.min(newLevel === 'high' ? 'low' : 'low', newLevel as any) as PerformanceLevel
      issues.push('内存压力过高')
    }

    // 帧率检查
    if (this.metrics.frameRate <= this.thresholds.frameRateWarning) {
      newLevel = newLevel === 'high' ? 'low' : newLevel
      issues.push('帧率过低')
    }

    // CPU压力检查
    if (this.metrics.cpuPressure >= this.thresholds.cpuPressureWarning) {
      newLevel = newLevel === 'high' ? 'low' : (newLevel === 'low' ? 'critical' : newLevel)
      issues.push('CPU压力过高')
    }

    // 低电量检查
    if (this.metrics.batteryLevel && this.metrics.batteryLevel <= this.thresholds.batteryLowThreshold) {
      newLevel = newLevel === 'high' ? 'low' : newLevel
      issues.push('电量过低')
    }

    // 设备能力检查
    if (this.metrics.hardwareConcurrency <= 2 && this.metrics.deviceMemory && this.metrics.deviceMemory <= 2) {
      newLevel = newLevel === 'high' ? 'normal' : newLevel
      issues.push('设备性能有限')
    }

    // 如果没有问题，保持高性能
    if (issues.length === 0) {
      newLevel = 'high'
    }

    this.currentLevel = newLevel

    // 如果性能级别发生变化，采取相应措施
    if (oldLevel !== newLevel) {
      this.applyPerformanceLevel(newLevel, issues)
    }

    log.debug('性能评估', {
      level: newLevel,
      issues,
      metrics: {
        memoryPressure: this.metrics.memoryPressure,
        frameRate: this.metrics.frameRate,
        cpuPressure: this.metrics.cpuPressure,
        batteryLevel: this.metrics.batteryLevel
      }
    })
  }

  /**
   * 应用性能级别对应的保护措施
   */
  private applyPerformanceLevel(level: PerformanceLevel, issues: string[]): void {
    log.info('性能级别变更', { level, issues })

    switch (level) {
      case 'high':
        this.executeProtectionAction('emergencyMode', '性能恢复', false)
        timerManager.setPerformanceMode('high')
        videoPlaybackManager.setMaxConcurrentVideos(this.isMobile ? 1 : 3)
        break

      case 'normal':
        timerManager.setPerformanceMode('normal')
        videoPlaybackManager.setMaxConcurrentVideos(this.isMobile ? 1 : 2)
        break

      case 'low':
        this.executeProtectionAction('limitConcurrency', issues.join(', '))
        this.executeProtectionAction('reduceVideoQuality', issues.join(', '))
        timerManager.setPerformanceMode('low')
        videoPlaybackManager.setMaxConcurrentVideos(1)
        break

      case 'critical':
        this.executeProtectionAction('emergencyMode', issues.join(', '))
        this.executeProtectionAction('clearCaches', '内存压力临界')
        timerManager.setPerformanceMode('low')
        videoPlaybackManager.setMaxConcurrentVideos(1)
        // 强制暂停所有视频
        setTimeout(() => {
          const manager = videoPlaybackManager as any
          if (manager.pauseAllVideos) {
            manager.pauseAllVideos('性能保护')
          }
        }, 0)
        break
    }
  }

  /**
   * 执行保护措施
   */
  private executeProtectionAction(action: ProtectionAction, trigger: string, enable: boolean = true): void {
    this.protectionHistory.push({
      action,
      timestamp: Date.now(),
      trigger
    })

    // 保持历史记录在合理范围内
    if (this.protectionHistory.length > 20) {
      this.protectionHistory.shift()
    }

    log.info('执行保护措施', { action, trigger, enable })

    switch (action) {
      case 'clearCaches':
        if (enable) {
          // 触发缓存清理
          setTimeout(() => {
            if (window.gc) {
              window.gc() // 如果可用，触发垃圾回收
            }
          }, 100)
        }
        break

      case 'emergencyMode':
        // 紧急模式：禁用所有非必要功能
        const body = document.body
        if (enable) {
          body.classList.add('performance-emergency')
        } else {
          body.classList.remove('performance-emergency')
        }
        break
    }
  }

  /**
   * 初始化帧率监控
   */
  private initializeFrameRateMonitoring(): void {
    const measureFrameRate = () => {
      this.frameCount++
      const now = performance.now()
      
      if (now - this.lastFrameTime >= 1000) {
        this.currentFPS = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime))
        this.frameCount = 0
        this.lastFrameTime = now
      }
      
      if (this.isActive) {
        requestAnimationFrame(measureFrameRate)
      }
    }
    
    requestAnimationFrame(measureFrameRate)
  }

  /**
   * 估算CPU压力
   */
  private estimateCPUPressure(): number {
    // 简单的CPU压力估算：基于定时器延迟
    const start = performance.now()
    const delay = 10
    
    return new Promise<number>((resolve) => {
      setTimeout(() => {
        const actual = performance.now() - start
        const pressure = Math.min((actual - delay) / delay, 1)
        resolve(Math.max(0, pressure))
      }, delay)
    }).then(pressure => pressure).catch(() => 0) as any
  }

  /**
   * 获取连接类型
   */
  private getConnectionType(): string {
    if ('connection' in navigator) {
      return (navigator as any).connection?.type || 'unknown'
    }
    return 'unknown'
  }

  /**
   * 获取有效连接类型
   */
  private getEffectiveConnectionType(): string {
    if ('connection' in navigator) {
      return (navigator as any).connection?.effectiveType || 'unknown'
    }
    return 'unknown'
  }

  /**
   * 检测低功耗模式
   */
  private detectLowPowerMode(): boolean {
    // iOS低功耗模式检测
    if (this.isMobile && 'connection' in navigator) {
      const connection = (navigator as any).connection
      return connection?.saveData === true
    }
    return false
  }

  /**
   * 设置内存监控
   */
  private setupMemoryMonitoring(): void {
    if (typeof window === 'undefined') return

    // 监听内存压力事件
    window.addEventListener('memory', (event: any) => {
      if (event.detail && event.detail.level === 'critical') {
        this.executeProtectionAction('emergencyMode', '系统内存压力事件')
      }
    })
  }

  /**
   * 处理页面可见性变化
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // 页面隐藏时，降低性能消耗
      timerManager.setPerformanceMode('low')
    } else {
      // 页面显示时，恢复正常性能
      timerManager.setPerformanceMode('normal')
    }
  }

  /**
   * 获取当前性能状态
   */
  getStatus(): {
    isActive: boolean
    level: PerformanceLevel
    metrics: PerformanceMetrics | null
    protectionHistory: typeof this.protectionHistory
  } {
    return {
      isActive: this.isActive,
      level: this.currentLevel,
      metrics: this.metrics,
      protectionHistory: this.protectionHistory.slice(-5) // 只返回最近5条
    }
  }

  /**
   * 手动触发保护措施
   */
  forceProtection(level: PerformanceLevel = 'low'): void {
    this.applyPerformanceLevel(level, ['手动触发'])
  }
}

// 创建全局单例
const performanceGuard = new PerformanceGuard()

// 自动启动性能监控
if (typeof window !== 'undefined') {
  // 页面加载完成后启动
  if (document.readyState === 'complete') {
    performanceGuard.start()
  } else {
    window.addEventListener('load', () => {
      performanceGuard.start()
    })
  }
}

export { performanceGuard }
export default performanceGuard

// 在开发环境下，将性能守护挂载到全局对象方便调试
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__PERFORMANCE_GUARD__ = {
    guard: performanceGuard,
    status: () => performanceGuard.getStatus(),
    forceProtection: (level: PerformanceLevel) => performanceGuard.forceProtection(level),
    start: () => performanceGuard.start(),
    stop: () => performanceGuard.stop()
  }
}