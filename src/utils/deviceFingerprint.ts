/**
 * 设备指纹收集工具
 * 用于防止同一设备批量注册账户
 */

export interface DeviceFingerprint {
  // 浏览器特征
  userAgent: string
  language: string
  languages: string[]
  platform: string
  cookieEnabled: boolean
  
  // 屏幕特征
  screenWidth: number
  screenHeight: number
  screenColorDepth: number
  screenPixelDepth: number
  availableScreenWidth: number
  availableScreenHeight: number
  
  // 时区特征
  timezone: string
  timezoneOffset: number
  
  // 渲染特征
  webglVendor?: string
  webglRenderer?: string
  
  // Canvas指纹
  canvasFingerprint?: string
  
  // 音频指纹
  audioFingerprint?: string
  
  // 其他特征
  touchSupport: boolean
  maxTouchPoints: number
  hardwareConcurrency: number
  deviceMemory?: number
  
  // 插件信息（简化版，避免隐私问题）
  pluginCount: number
  
  // 本地存储支持
  localStorageEnabled: boolean
  sessionStorageEnabled: boolean
  indexedDBEnabled: boolean
  
  // 网络信息（如果可用）
  connectionType?: string
  connectionEffectiveType?: string
  
  // 时间戳
  collectedAt: number
}

/**
 * 生成Canvas指纹
 */
function generateCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'canvas-unavailable'
    
    // 绘制一些基本图形和文本
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('Device fingerprint test 🔒', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('Security check', 4, 45)
    
    // 绘制一些几何图形
    ctx.beginPath()
    ctx.arc(50, 50, 20, 0, Math.PI * 2)
    ctx.fill()
    
    return canvas.toDataURL()
  } catch (error) {
    console.warn('Canvas fingerprint generation failed:', error)
    return 'canvas-error'
  }
}

/**
 * 生成音频指纹
 */
function generateAudioFingerprint(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const analyser = audioContext.createAnalyser()
      const gainNode = audioContext.createGain()
      
      oscillator.type = 'triangle'
      oscillator.frequency.value = 1000
      gainNode.gain.value = 0
      
      oscillator.connect(analyser)
      analyser.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.start()
      
      setTimeout(() => {
        const frequencyData = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(frequencyData)
        
        oscillator.stop()
        audioContext.close()
        
        const fingerprint = Array.from(frequencyData.slice(0, 50)).join(',')
        resolve(fingerprint || 'audio-silent')
      }, 100)
    } catch (error) {
      console.warn('Audio fingerprint generation failed:', error)
      resolve('audio-unavailable')
    }
  })
}

/**
 * 获取WebGL信息
 */
function getWebGLInfo(): { vendor?: string; renderer?: string } {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') as WebGLRenderingContext || 
               canvas.getContext('experimental-webgl') as WebGLRenderingContext
    if (!gl) return {}
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return {}
    
    return {
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    }
  } catch (error) {
    console.warn('WebGL info collection failed:', error)
    return {}
  }
}

/**
 * 检查本地存储支持
 */
function checkStorageSupport() {
  const checkStorage = (storage: Storage | undefined): boolean => {
    try {
      if (!storage) return false
      const testKey = '__storage_test__'
      storage.setItem(testKey, 'test')
      storage.removeItem(testKey)
      return true
    } catch (error) {
      return false
    }
  }
  
  const checkIndexedDB = (): boolean => {
    try {
      return 'indexedDB' in window && indexedDB !== null
    } catch (error) {
      return false
    }
  }
  
  return {
    localStorage: checkStorage(window.localStorage),
    sessionStorage: checkStorage(window.sessionStorage),
    indexedDB: checkIndexedDB()
  }
}

/**
 * 获取网络连接信息
 */
function getConnectionInfo(): { type?: string; effectiveType?: string } {
  try {
    const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection
    
    if (!connection) return {}
    
    return {
      type: connection.type,
      effectiveType: connection.effectiveType
    }
  } catch (error) {
    return {}
  }
}

/**
 * 生成设备指纹
 */
export async function generateDeviceFingerprint(): Promise<DeviceFingerprint> {
  try {
    const storage = checkStorageSupport()
    const webglInfo = getWebGLInfo()
    const connectionInfo = getConnectionInfo()
    
    // 获取异步指纹信息
    const [canvasFingerprint, audioFingerprint] = await Promise.all([
      Promise.resolve(generateCanvasFingerprint()),
      generateAudioFingerprint()
    ])
    
    const fingerprint: DeviceFingerprint = {
      // 浏览器特征
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: Array.from(navigator.languages || []),
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      
      // 屏幕特征
      screenWidth: screen.width,
      screenHeight: screen.height,
      screenColorDepth: screen.colorDepth,
      screenPixelDepth: screen.pixelDepth,
      availableScreenWidth: screen.availWidth,
      availableScreenHeight: screen.availHeight,
      
      // 时区特征
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      
      // 渲染特征
      webglVendor: webglInfo.vendor,
      webglRenderer: webglInfo.renderer,
      
      // 指纹
      canvasFingerprint,
      audioFingerprint,
      
      // 触摸支持
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      
      // 硬件信息
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: (navigator as any).deviceMemory,
      
      // 插件数量（不记录具体插件名称以保护隐私）
      pluginCount: navigator.plugins?.length || 0,
      
      // 本地存储支持
      localStorageEnabled: storage.localStorage,
      sessionStorageEnabled: storage.sessionStorage,
      indexedDBEnabled: storage.indexedDB,
      
      // 网络信息
      connectionType: connectionInfo.type,
      connectionEffectiveType: connectionInfo.effectiveType,
      
      // 收集时间
      collectedAt: Date.now()
    }
    
    return fingerprint
  } catch (error) {
    console.error('Device fingerprint generation failed:', error)
    
    // 返回最基本的指纹信息
    return {
      userAgent: navigator.userAgent || 'unknown',
      language: navigator.language || 'unknown',
      languages: [],
      platform: navigator.platform || 'unknown',
      cookieEnabled: false,
      screenWidth: 0,
      screenHeight: 0,
      screenColorDepth: 0,
      screenPixelDepth: 0,
      availableScreenWidth: 0,
      availableScreenHeight: 0,
      timezone: 'unknown',
      timezoneOffset: 0,
      touchSupport: false,
      maxTouchPoints: 0,
      hardwareConcurrency: 0,
      pluginCount: 0,
      localStorageEnabled: false,
      sessionStorageEnabled: false,
      indexedDBEnabled: false,
      collectedAt: Date.now()
    }
  }
}

/**
 * 生成设备指纹哈希
 */
export async function generateDeviceFingerprintHash(): Promise<string> {
  try {
    const fingerprint = await generateDeviceFingerprint()
    
    // 选择最重要的特征生成哈希
    const criticalFeatures = [
      fingerprint.userAgent,
      fingerprint.platform,
      fingerprint.screenWidth + 'x' + fingerprint.screenHeight,
      fingerprint.screenColorDepth,
      fingerprint.timezone,
      fingerprint.language,
      fingerprint.hardwareConcurrency,
      fingerprint.canvasFingerprint?.slice(0, 100), // 只取前100字符
      fingerprint.webglVendor,
      fingerprint.webglRenderer
    ].filter(Boolean).join('|')
    
    // 使用Web Crypto API生成哈希
    const encoder = new TextEncoder()
    const data = encoder.encode(criticalFeatures)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return hashHex
  } catch (error) {
    console.error('Device fingerprint hash generation failed:', error)
    // 返回基于时间戳的简单哈希作为备用
    const fallback = navigator.userAgent + Date.now().toString()
    return btoa(fallback).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)
  }
}

/**
 * 获取客户端IP地址（需要从请求头或第三方服务获取）
 */
export async function getClientIPAddress(): Promise<string | null> {
  try {
    // 尝试使用免费的IP检测服务
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      cache: 'no-cache'
    })
    
    if (response.ok) {
      const data = await response.json()
      return data.ip
    }
  } catch (error) {
    console.warn('Failed to get client IP:', error)
  }
  
  // 如果无法获取，返回null（服务器端会使用请求头中的IP）
  return null
}

/**
 * 检测是否为可疑的自动化环境
 */
export function detectAutomation(): {
  isLikelyBot: boolean
  suspiciousFeatures: string[]
} {
  const suspiciousFeatures: string[] = []
  
  // 检查常见的自动化工具特征
  if (navigator.webdriver) {
    suspiciousFeatures.push('webdriver_detected')
  }
  
  // 检查用户代理字符串
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('headless') || ua.includes('phantom') || ua.includes('selenium')) {
    suspiciousFeatures.push('automation_user_agent')
  }
  
  // 检查屏幕尺寸异常
  if (screen.width === 0 || screen.height === 0) {
    suspiciousFeatures.push('invalid_screen_size')
  }
  
  // 检查语言设置异常
  if (!navigator.language || navigator.languages.length === 0) {
    suspiciousFeatures.push('missing_language_info')
  }
  
  // 检查插件数量异常（真实浏览器通常有一些插件）
  if (navigator.plugins.length === 0) {
    suspiciousFeatures.push('no_plugins')
  }
  
  // 检查是否缺少触摸事件支持（移动设备检测）
  const isMobileUA = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  
  if (isMobileUA && !hasTouchSupport) {
    suspiciousFeatures.push('mobile_ua_no_touch')
  }
  
  // 检查时区和语言不匹配（简单检测）
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const language = navigator.language
  
  // 一些基本的地理一致性检查
  if (language.startsWith('zh') && !timezone.includes('Shanghai') && !timezone.includes('Asia')) {
    suspiciousFeatures.push('language_timezone_mismatch')
  }
  
  return {
    isLikelyBot: suspiciousFeatures.length >= 3,
    suspiciousFeatures
  }
}

/**
 * 收集完整的设备环境信息
 */
export async function collectDeviceEnvironment(): Promise<{
  fingerprint: DeviceFingerprint
  fingerprintHash: string
  ipAddress: string | null
  automationDetection: ReturnType<typeof detectAutomation>
}> {
  const [fingerprint, fingerprintHash, ipAddress] = await Promise.all([
    generateDeviceFingerprint(),
    generateDeviceFingerprintHash(),
    getClientIPAddress()
  ])
  
  const automationDetection = detectAutomation()
  
  return {
    fingerprint,
    fingerprintHash,
    ipAddress,
    automationDetection
  }
}

export default {
  generateDeviceFingerprint,
  generateDeviceFingerprintHash,
  getClientIPAddress,
  detectAutomation,
  collectDeviceEnvironment
}