/**
 * 运行时移除不必要的预加载链接
 * 这是一个临时解决方案，直到我们完全配置好Vite预加载策略
 */

export function removeUnnecessaryPreloadLinks(): void {
  // 立即执行一次清理
  performRemoval()
  
  // 在DOM加载完成后立即执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', performRemoval)
  } else {
    performRemoval()
  }

  // 同时在页面加载时也执行一次
  window.addEventListener('load', performRemoval)
  
  // 额外在100ms后再执行一次，确保清理所有延迟生成的预加载链接
  setTimeout(performRemoval, 100)
}

function performRemoval(): void {
  // 移除有问题的预加载链接
  const preloadLinks = document.querySelectorAll('link[rel="preload"]')
  
  preloadLinks.forEach(link => {
    const href = link.getAttribute('href')
    if (!href) return

    // 移除导致404的vendor.js预加载
    if (href.includes('vendor.js')) {
      console.log('[PRELOAD CLEANUP] Removing vendor.js preload link')
      link.remove()
      return
    }

    // 移除index.css预加载，因为我们已经内联了关键CSS
    if (href.includes('index.css')) {
      console.log('[PRELOAD CLEANUP] Removing index.css preload link')
      link.remove()
      return
    }

    // 移除Google字体预加载，因为我们现在异步加载
    if (href.includes('fonts.gstatic.com')) {
      console.log('[PRELOAD CLEANUP] Removing Google Fonts preload link')
      link.remove()
      return
    }
  })
}

/**
 * 监控新添加的预加载链接并移除
 */
export function setupPreloadLinkMonitoring(): (() => void) | void {
  // 使用MutationObserver监控动态添加的预加载链接
  if ('MutationObserver' in window) {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              
              // 检查是否是预加载链接
              if (element.tagName === 'LINK' && 
                  element.getAttribute('rel') === 'preload') {
                const href = element.getAttribute('href')
                if (href && (href.includes('vendor.js') || 
                           href.includes('index.css') || 
                           href.includes('fonts.gstatic.com'))) {
                  console.log('[PRELOAD MONITORING] Removing dynamically added preload:', href)
                  element.remove()
                }
              }
              
              // 检查子元素
              const preloadChildren = element.querySelectorAll?.('link[rel="preload"]')
              preloadChildren?.forEach(link => {
                const href = link.getAttribute('href')
                if (href && (href.includes('vendor.js') || 
                           href.includes('index.css') || 
                           href.includes('fonts.gstatic.com'))) {
                  console.log('[PRELOAD MONITORING] Removing nested preload:', href)
                  link.remove()
                }
              })
            }
          })
        }
      })
    })

    observer.observe(document.head, { childList: true, subtree: true })
    
    // 返回cleanup函数
    return () => observer.disconnect()
  }
}

/**
 * 初始化预加载链接清理
 */
export function initPreloadCleanup(): void {
  removeUnnecessaryPreloadLinks()
  setupPreloadLinkMonitoring()
}