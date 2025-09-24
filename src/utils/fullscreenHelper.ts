/**
 * fullscreenHelper 兼容层
 * 保留必要的设备检测功能
 */

export interface DeviceCapabilities {
  isiOS: boolean
  isiOSChrome: boolean
  isiOSSafari: boolean
  supportsWebkitFullscreen: boolean
  supportsStandardFullscreen: boolean
  isMobile: boolean
}

/**
 * 检测设备和浏览器能力
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      isiOS: false,
      isiOSChrome: false,
      isiOSSafari: false,
      supportsWebkitFullscreen: false,
      supportsStandardFullscreen: false,
      isMobile: false
    }
  }

  const userAgent = navigator.userAgent
  const isiOS = /iPad|iPhone|iPod/.test(userAgent)
  const isiOSChrome = isiOS && /CriOS/.test(userAgent)
  const isiOSSafari = isiOS && /Safari/.test(userAgent) && !/CriOS/.test(userAgent)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  
  // 检测webkit全屏支持
  const testVideo = document.createElement('video') as any
  const supportsWebkitFullscreen = typeof testVideo.webkitEnterFullscreen === 'function'
  
  // 检测标准全屏支持
  const testDiv = document.createElement('div') as any
  const supportsStandardFullscreen = typeof testDiv.requestFullscreen === 'function'

  return {
    isiOS,
    isiOSChrome,
    isiOSSafari,
    supportsWebkitFullscreen,
    supportsStandardFullscreen,
    isMobile
  }
}

/**
 * 检查是否支持全屏功能
 */
export function supportsFullscreen(): boolean {
  const capabilities = detectDeviceCapabilities()
  return capabilities.supportsWebkitFullscreen || capabilities.supportsStandardFullscreen
}