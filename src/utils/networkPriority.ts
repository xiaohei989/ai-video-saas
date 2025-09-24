/**
 * 网络优先级工具 - 在保留预加载（metadata）的前提下，优先被交互的视频
 * 通过 preconnect 与 link rel=preload 提升浏览器调度优先级
 */

function getOriginFromUrl(url: string): string | null {
  try {
    // 处理相对路径（如 /api/r2/...）
    const u = new URL(url, window.location.origin)
    return u.origin
  } catch {
    return null
  }
}

/**
 * 确保对目标资源域名进行预连接（DNS/TLS 握手提前完成）
 */
export function ensurePreconnect(url: string): void {
  if (typeof document === 'undefined') return
  const origin = getOriginFromUrl(url)
  if (!origin) return

  // 避免重复插入
  const exists = document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`)
  if (exists) return

  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = origin
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)

  // 兼容性：同时插入 dns-prefetch
  const dnsPrefetch = document.createElement('link')
  dnsPrefetch.rel = 'dns-prefetch'
  dnsPrefetch.href = origin
  document.head.appendChild(dnsPrefetch)
}

/**
 * 预加载视频资源，提升网络调度优先级（不改变 <video> 的预加载策略）
 * 🔧 临时禁用：避免浏览器警告，使用原生 <video> preload 即可
 */
export function ensurePreloadVideo(url: string): void {
  // 🔧 临时禁用预加载 link 标签，避免浏览器 "unsupported as value" 警告
  // 现代浏览器的 <video preload="metadata"> 已经足够高效
  if (typeof document === 'undefined') return
  
  // 只进行预连接优化，不再创建 preload link
  ensurePreconnect(url)
  
  // 注释掉的原代码：
  // const cleanUrl = url.split('#')[0]
  // const selector = `link[rel="preload"][as="fetch"][href="${cleanUrl}"]`
  // const exists = document.head.querySelector(selector)
  // if (exists) return
  // const link = document.createElement('link')
  // link.rel = 'preload'
  // link.as = 'fetch'
  // link.href = cleanUrl
  // link.crossOrigin = 'anonymous'
  // link.setAttribute('type', 'video/mp4')
  // ;(link as any).fetchPriority = 'high'
  // link.setAttribute('fetchpriority', 'high')
  // document.head.appendChild(link)
}

/**
 * 移除对应的预加载 link（可选）
 */
export function removePreloadVideo(url: string): void {
  if (typeof document === 'undefined') return
  const cleanUrl = url.split('#')[0]
  const selector = `link[rel="preload"][as="fetch"][href="${cleanUrl}"]`
  const el = document.head.querySelector(selector)
  if (el) {
    el.parentNode?.removeChild(el)
  }
}

