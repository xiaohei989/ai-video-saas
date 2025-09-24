/**
 * 基于分辨率和触摸的设备检测工具
 * 更适合开发调试和电脑端模拟测试
 */

export interface ResponsiveDeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  width: number
  height: number
  hasTouch: boolean
  deviceType: 'mobile' | 'tablet' | 'desktop'
}

/**
 * 响应式设备检测 - 基于屏幕尺寸
 */
export function detectResponsiveDevice(): ResponsiveDeviceInfo {
  // 服务端渲染兼容
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      width: 1920,
      height: 1080,
      hasTouch: false,
      deviceType: 'desktop'
    }
  }

  const width = window.innerWidth
  const height = window.innerHeight
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // 分辨率断点定义
  const MOBILE_BREAKPOINT = 768   // 768px以下为手机
  const TABLET_BREAKPOINT = 1024  // 768-1024px为平板

  const isMobile = width < MOBILE_BREAKPOINT
  const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT && hasTouch
  const isDesktop = width >= TABLET_BREAKPOINT || (!hasTouch && width >= MOBILE_BREAKPOINT)

  // 确定设备类型
  let deviceType: 'mobile' | 'tablet' | 'desktop'
  if (isMobile) {
    deviceType = 'mobile'
  } else if (isTablet) {
    deviceType = 'tablet'
  } else {
    deviceType = 'desktop'
  }

  return {
    isMobile,
    isTablet,
    isDesktop,
    width,
    height,
    hasTouch,
    deviceType
  }
}

/**
 * React Hook - 响应式设备检测
 */
import { useState, useEffect } from 'react'

export function useResponsiveDevice(): ResponsiveDeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<ResponsiveDeviceInfo>(() => 
    detectResponsiveDevice()
  )

  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(detectResponsiveDevice())
    }

    // 添加resize监听器
    window.addEventListener('resize', handleResize)
    
    // 立即检测一次
    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return deviceInfo
}

/**
 * 混合检测方案 - 结合User Agent和分辨率
 * 在开发环境优先使用分辨率，生产环境结合User Agent
 */
export function detectDeviceHybrid(): ResponsiveDeviceInfo & { 
  isRealMobile: boolean 
  isSimulatedMobile: boolean 
} {
  const responsiveInfo = detectResponsiveDevice()
  
  // User Agent检测（真实移动设备）
  const userAgent = navigator.userAgent
  const isRealMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  
  // 开发环境检测
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // 模拟移动设备（分辨率小但非真实移动设备）
  const isSimulatedMobile = responsiveInfo.isMobile && !isRealMobile

  return {
    ...responsiveInfo,
    isRealMobile,
    isSimulatedMobile,
    // 在开发环境优先使用分辨率判断，生产环境结合两者
    isMobile: isDevelopment ? responsiveInfo.isMobile : (responsiveInfo.isMobile || isRealMobile)
  }
}

/**
 * 获取CSS媒体查询断点
 */
export function getMediaQueryBreakpoints() {
  return {
    mobile: '(max-width: 767px)',
    tablet: '(min-width: 768px) and (max-width: 1023px)',
    desktop: '(min-width: 1024px)',
    touch: '(hover: none) and (pointer: coarse)'  // 真实触摸设备
  }
}

/**
 * 检测是否为触摸设备
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * 检测是否支持悬停交互
 */
export function supportsHover(): boolean {
  // 检查CSS媒体查询
  if (window.matchMedia) {
    return window.matchMedia('(hover: hover)').matches
  }
  // 回退检测：非触摸设备通常支持悬停
  return !isTouchDevice()
}