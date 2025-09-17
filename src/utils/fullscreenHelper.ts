/**
 * 跨平台全屏播放工具函数
 * 处理iOS Safari和其他浏览器的全屏API差异
 */

// 扩展HTMLVideoElement接口以包含webkit方法
interface WebKitVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitDisplayingFullscreen?: boolean
}

// 扩展Document接口以包含webkit全屏属性
interface WebKitDocument extends Document {
  webkitFullscreenElement?: Element
  webkitExitFullscreen?: () => void
  webkitIsFullScreen?: boolean
}

/**
 * 设备和浏览器能力检测
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
 * 全屏状态信息
 */
export interface FullscreenState {
  isFullscreen: boolean
  method: 'webkit' | 'standard' | 'none'
  element: Element | null
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
  const testVideo = document.createElement('video') as WebKitVideoElement
  const supportsWebkitFullscreen = typeof testVideo.webkitEnterFullscreen === 'function'
  
  // 检测标准全屏支持
  const testDiv = document.createElement('div')
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
 * 获取当前全屏状态
 */
export function getFullscreenState(): FullscreenState {
  const doc = document as WebKitDocument
  
  // 检查webkit全屏状态
  if (doc.webkitIsFullScreen || doc.webkitFullscreenElement) {
    return {
      isFullscreen: true,
      method: 'webkit',
      element: doc.webkitFullscreenElement || null
    }
  }
  
  // 检查标准全屏状态
  if (doc.fullscreenElement) {
    return {
      isFullscreen: true,
      method: 'standard',
      element: doc.fullscreenElement
    }
  }
  
  return {
    isFullscreen: false,
    method: 'none',
    element: null
  }
}

/**
 * iOS专用：视频全屏处理
 */
export async function enterVideoFullscreeniOS(video: WebKitVideoElement): Promise<boolean> {
  if (!video.webkitEnterFullscreen) {
    console.warn('[Fullscreen] iOS webkit全屏API不可用')
    return false
  }

  try {
    video.webkitEnterFullscreen()
    console.log('[Fullscreen] iOS webkit全屏已触发')
    return true
  } catch (error) {
    console.error('[Fullscreen] iOS webkit全屏失败:', error)
    return false
  }
}

/**
 * iOS专用：退出视频全屏
 */
export async function exitVideoFullscreeniOS(video: WebKitVideoElement): Promise<boolean> {
  if (!video.webkitExitFullscreen) {
    console.warn('[Fullscreen] iOS webkit退出全屏API不可用')
    return false
  }

  try {
    video.webkitExitFullscreen()
    console.log('[Fullscreen] iOS webkit退出全屏已触发')
    return true
  } catch (error) {
    console.error('[Fullscreen] iOS webkit退出全屏失败:', error)
    return false
  }
}

/**
 * 标准全屏API：进入全屏
 */
export async function enterFullscreenStandard(element: HTMLElement): Promise<boolean> {
  if (!element.requestFullscreen) {
    console.warn('[Fullscreen] 标准全屏API不可用')
    return false
  }

  try {
    await element.requestFullscreen()
    console.log('[Fullscreen] 标准全屏已进入')
    return true
  } catch (error) {
    console.error('[Fullscreen] 标准全屏失败:', error)
    return false
  }
}

/**
 * 标准全屏API：退出全屏
 */
export async function exitFullscreenStandard(): Promise<boolean> {
  if (!document.exitFullscreen) {
    console.warn('[Fullscreen] 标准退出全屏API不可用')
    return false
  }

  try {
    await document.exitFullscreen()
    console.log('[Fullscreen] 标准全屏已退出')
    return true
  } catch (error) {
    console.error('[Fullscreen] 标准退出全屏失败:', error)
    return false
  }
}

/**
 * 智能全屏切换：自动选择合适的API
 */
export async function toggleFullscreen(
  videoElement: HTMLVideoElement,
  containerElement?: HTMLElement
): Promise<boolean> {
  const capabilities = detectDeviceCapabilities()
  const state = getFullscreenState()

  console.log('[Fullscreen] 设备能力:', capabilities)
  console.log('[Fullscreen] 当前状态:', state)

  // 如果已经在全屏状态，尝试退出
  if (state.isFullscreen) {
    if (capabilities.isiOS && capabilities.supportsWebkitFullscreen) {
      return await exitVideoFullscreeniOS(videoElement as WebKitVideoElement)
    } else if (capabilities.supportsStandardFullscreen) {
      return await exitFullscreenStandard()
    }
  } else {
    // 尝试进入全屏
    if (capabilities.isiOS && capabilities.supportsWebkitFullscreen) {
      // iOS使用视频专用全屏
      return await enterVideoFullscreeniOS(videoElement as WebKitVideoElement)
    } else if (capabilities.supportsStandardFullscreen && containerElement) {
      // 其他平台使用标准全屏
      return await enterFullscreenStandard(containerElement)
    }
  }

  console.warn('[Fullscreen] 当前设备不支持全屏功能')
  return false
}

/**
 * 创建全屏事件监听器
 */
export function createFullscreenEventListener(
  callback: (isFullscreen: boolean, method: 'webkit' | 'standard') => void
): () => void {
  const capabilities = detectDeviceCapabilities()
  const cleanupFunctions: Array<() => void> = []

  // iOS webkit事件监听
  if (capabilities.isiOS) {
    const handleWebkitBegin = () => {
      console.log('[Fullscreen] iOS webkit开始全屏')
      callback(true, 'webkit')
    }
    
    const handleWebkitEnd = () => {
      console.log('[Fullscreen] iOS webkit结束全屏')
      callback(false, 'webkit')
    }
    
    // 注意：这些事件需要绑定到video元素上，而不是document
    // 这里提供通用的事件名称，具体绑定在组件中处理
    cleanupFunctions.push(() => {
      // iOS事件的清理会在组件中处理
    })
  }

  // 标准全屏事件监听
  if (capabilities.supportsStandardFullscreen) {
    const handleFullscreenChange = () => {
      const state = getFullscreenState()
      console.log('[Fullscreen] 标准全屏状态变化:', state)
      callback(state.isFullscreen, 'standard')
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    cleanupFunctions.push(() => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    })
  }

  // 返回清理函数
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup())
  }
}

/**
 * 获取全屏按钮的提示文本
 */
export function getFullscreenTooltip(isFullscreen: boolean): string {
  const capabilities = detectDeviceCapabilities()
  
  if (capabilities.isiOS) {
    return isFullscreen ? '退出全屏 (iOS)' : '全屏播放 (iOS)'
  }
  
  return isFullscreen ? '退出全屏' : '全屏播放'
}

/**
 * 检查是否支持全屏功能
 */
export function supportsFullscreen(): boolean {
  const capabilities = detectDeviceCapabilities()
  return capabilities.supportsWebkitFullscreen || capabilities.supportsStandardFullscreen
}

/**
 * 获取全屏功能不可用的原因
 */
export function getFullscreenUnavailableReason(): string {
  const capabilities = detectDeviceCapabilities()
  
  if (capabilities.isiOS && !capabilities.supportsWebkitFullscreen) {
    return 'iOS Safari全屏功能不可用'
  }
  
  if (!capabilities.supportsStandardFullscreen) {
    return '浏览器不支持全屏功能'
  }
  
  return '未知原因'
}

/**
 * 创建iOS专用的视频事件绑定工具
 */
export function bindVideoFullscreenEventsiOS(
  video: WebKitVideoElement,
  onEnter: () => void,
  onExit: () => void
): () => void {
  if (!video) return () => {}

  const handleWebkitBegin = onEnter
  const handleWebkitEnd = onExit

  video.addEventListener('webkitbeginfullscreen', handleWebkitBegin)
  video.addEventListener('webkitendfullscreen', handleWebkitEnd)

  return () => {
    video.removeEventListener('webkitbeginfullscreen', handleWebkitBegin)
    video.removeEventListener('webkitendfullscreen', handleWebkitEnd)
  }
}