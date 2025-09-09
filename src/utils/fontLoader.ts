/**
 * 智能字体加载工具
 * 优化字体加载，防止预加载警告
 */

class FontLoader {
  private loadedFonts = new Set<string>()
  private loadingPromises = new Map<string, Promise<void>>()

  /**
   * 异步加载字体
   */
  async loadFont(fontFamily: string, fontUrl?: string): Promise<void> {
    if (this.loadedFonts.has(fontFamily)) {
      return Promise.resolve()
    }

    if (this.loadingPromises.has(fontFamily)) {
      return this.loadingPromises.get(fontFamily)!
    }

    const loadPromise = new Promise<void>((resolve, reject) => {
      // 使用FontFace API检测字体是否可用
      if ('fonts' in document) {
        const checkFont = () => {
          if (document.fonts.check(`12px "${fontFamily}"`)) {
            this.loadedFonts.add(fontFamily)
            document.documentElement.classList.add('fonts-loaded')
            resolve()
          } else {
            // 如果提供了URL，动态加载字体
            if (fontUrl) {
              this.loadFontFromUrl(fontUrl, fontFamily).then(resolve).catch(reject)
            } else {
              // 延迟重试
              setTimeout(checkFont, 100)
            }
          }
        }
        
        checkFont()
      } else {
        // Fallback for older browsers
        resolve()
      }
    })

    this.loadingPromises.set(fontFamily, loadPromise)
    return loadPromise
  }

  /**
   * 从URL加载字体文件
   */
  private async loadFontFromUrl(url: string, fontFamily: string): Promise<void> {
    try {
      const font = new FontFace(fontFamily, `url(${url})`)
      const loadedFont = await font.load()
      document.fonts.add(loadedFont)
      this.loadedFonts.add(fontFamily)
      document.documentElement.classList.add('fonts-loaded')
    } catch (error) {
      console.warn(`Failed to load font ${fontFamily} from ${url}:`, error)
      // Use fallback
      this.loadedFonts.add(fontFamily)
      document.documentElement.classList.add('fonts-loaded')
    }
  }

  /**
   * 批量加载多个字体
   */
  async loadFonts(fonts: Array<{ family: string; url?: string }>): Promise<void> {
    const promises = fonts.map(font => this.loadFont(font.family, font.url))
    await Promise.allSettled(promises)
  }

  /**
   * 检查字体是否已加载
   */
  isFontLoaded(fontFamily: string): boolean {
    return this.loadedFonts.has(fontFamily)
  }

  /**
   * 预加载手写体字体（用户交互后）
   */
  async preloadHandwritingFonts(): Promise<void> {
    const fonts = [
      {
        family: 'Kalam',
        url: 'https://fonts.gstatic.com/s/kalam/v16/YA9dr0Wd4kDdMtD6GgLI.woff2'
      },
      {
        family: 'Caveat',
        url: 'https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIWpZw.woff2'
      }
    ]

    await this.loadFonts(fonts)
  }
}

export const fontLoader = new FontLoader()

/**
 * 初始化字体加载策略
 */
export function initializeFontLoading(): void {
  // 标记字体正在加载
  document.documentElement.classList.add('fonts-loading')

  // 立即检查系统字体
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.documentElement.classList.remove('fonts-loading')
      document.documentElement.classList.add('fonts-loaded')
    })
  } else {
    // 为旧浏览器提供fallback
    setTimeout(() => {
      document.documentElement.classList.remove('fonts-loading')
      document.documentElement.classList.add('fonts-loaded')
    }, 100)
  }

  // 用户交互后延迟加载手写体字体
  const loadHandwritingFonts = () => {
    fontLoader.preloadHandwritingFonts()
    // 移除事件监听器，只加载一次
    document.removeEventListener('click', loadHandwritingFonts)
    document.removeEventListener('scroll', loadHandwritingFonts)
    document.removeEventListener('touchstart', loadHandwritingFonts)
  }

  // 延迟1秒后再添加事件监听器，避免立即触发
  setTimeout(() => {
    document.addEventListener('click', loadHandwritingFonts, { once: true })
    document.addEventListener('scroll', loadHandwritingFonts, { once: true })
    document.addEventListener('touchstart', loadHandwritingFonts, { once: true })
  }, 1000)
}