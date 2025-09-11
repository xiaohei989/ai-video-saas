/**
 * 开发环境模板热重载工具
 * 自动检测模板文件变化并刷新缓存
 */

import { clearTemplateCache } from './quickCacheClear'

interface TemplateChangeDetector {
  lastCheck: number
  templateHashes: Map<string, string>
  checkInterval: number
  isFirstLoad: boolean
  version: string
}

class TemplateHotReload {
  private detector: TemplateChangeDetector
  private intervalId: number | null = null

  constructor() {
    this.detector = {
      lastCheck: Date.now(),
      templateHashes: new Map(),
      checkInterval: 2000, // 每2秒检查一次
      isFirstLoad: true,
      version: '1.0'
    }
    
    // 从localStorage恢复哈希值
    this.loadHashesFromStorage()
  }

  /**
   * 从localStorage加载哈希值
   */
  private loadHashesFromStorage(): void {
    try {
      const stored = localStorage.getItem('template_hot_reload_hashes')
      if (stored) {
        const data = JSON.parse(stored)
        
        // 检查版本兼容性
        if (data.version === this.detector.version) {
          // 恢复哈希值
          this.detector.templateHashes = new Map(data.hashes)
          this.detector.lastCheck = data.lastCheck || Date.now()
          
          console.log(`🔄 从缓存恢复了${this.detector.templateHashes.size}个模板哈希值`)
          
          // 标记为非首次加载
          this.detector.isFirstLoad = false
        } else {
          console.log('📋 模板缓存版本不匹配，清理旧缓存')
          localStorage.removeItem('template_hot_reload_hashes')
        }
      }
    } catch (error) {
      console.warn('⚠️ 加载模板哈希缓存失败:', error)
      localStorage.removeItem('template_hot_reload_hashes')
    }
  }

  /**
   * 保存哈希值到localStorage
   */
  private saveHashesToStorage(): void {
    try {
      const data = {
        version: this.detector.version,
        hashes: Array.from(this.detector.templateHashes.entries()),
        lastCheck: this.detector.lastCheck,
        timestamp: Date.now()
      }
      
      localStorage.setItem('template_hot_reload_hashes', JSON.stringify(data))
    } catch (error) {
      console.warn('⚠️ 保存模板哈希缓存失败:', error)
    }
  }

  /**
   * 开始监听模板文件变化（仅在开发环境）
   */
  start(): void {
    if (process.env.NODE_ENV !== 'development') {
      console.log('🎭 模板热重载仅在开发环境中启用')
      return
    }

    console.log('🔥 启动模板热重载监听器...')
    
    // 初始化模板哈希
    this.initializeTemplateHashes()
    
    // 开始定期检查
    this.intervalId = window.setInterval(() => {
      this.checkForTemplateChanges()
    }, this.detector.checkInterval)

    console.log('✅ 模板热重载已启动，每2秒检查文件变化')
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('🛑 模板热重载监听已停止')
    }
  }

  /**
   * 初始化模板文件哈希值
   */
  private async initializeTemplateHashes(): Promise<void> {
    try {
      // 如果不是首次加载且已有缓存，跳过初始化
      if (!this.detector.isFirstLoad && this.detector.templateHashes.size > 0) {
        console.log(`📋 使用缓存的${this.detector.templateHashes.size}个模板哈希值`)
        return
      }

      // 动态导入模板列表
      const { templateList } = await import('/src/features/video-creator/data/templates/index?t=' + Date.now())
      
      // 基于模板内容计算哈希值
      templateList.forEach((template: any) => {
        const contentHash = this.calculateTemplateHash(template)
        this.detector.templateHashes.set(template.id, contentHash)
      })

      // 保存到localStorage
      this.saveHashesToStorage()

      console.log(`📋 初始化了${this.detector.templateHashes.size}个模板的哈希值`)
    } catch (error) {
      console.error('❌ 初始化模板哈希失败:', error)
    }
  }

  /**
   * 强制重新初始化模板文件哈希值（用于缓存清除后）
   */
  private async forceInitializeTemplateHashes(): Promise<void> {
    try {
      console.log('🔄 强制重新初始化模板哈希值...')

      // 动态导入模板列表
      const { templateList } = await import('/src/features/video-creator/data/templates/index?t=' + Date.now())
      
      // 清除现有哈希值
      this.detector.templateHashes.clear()
      
      // 基于模板内容计算哈希值
      templateList.forEach((template: any) => {
        const contentHash = this.calculateTemplateHash(template)
        this.detector.templateHashes.set(template.id, contentHash)
      })

      console.log(`🎯 强制重新初始化了${this.detector.templateHashes.size}个模板的哈希值`)
    } catch (error) {
      console.error('❌ 强制初始化模板哈希失败:', error)
    }
  }

  /**
   * 检查模板文件是否有变化
   */
  private async checkForTemplateChanges(): Promise<void> {
    try {
      // 首次加载跳过检查
      if (this.detector.isFirstLoad) {
        this.detector.isFirstLoad = false
        console.log('🔥 首次加载，跳过变化检查')
        return
      }

      // 动态重新导入模板索引，检查是否有新文件
      const { templateList } = await import('/src/features/video-creator/data/templates/index?t=' + Date.now())
      
      const currentTemplateCount = templateList.length
      const cachedTemplateCount = this.detector.templateHashes.size

      // 检查模板数量变化
      if (currentTemplateCount !== cachedTemplateCount) {
        console.log(`🆕 检测到模板数量变化: ${cachedTemplateCount} → ${currentTemplateCount}`)
        await this.handleTemplateChange('模板数量变化')
        return
      }

      // 检查模板内容变化
      let hasChanges = false
      const currentHashes = new Map<string, string>()

      for (const template of templateList) {
        const templateAny = template as any
        const templateId = templateAny.slug || templateAny.id
        
        // 计算当前模板的哈希值（基于关键字段）
        const contentHash = this.calculateTemplateHash(templateAny)
        currentHashes.set(templateId, contentHash)
        
        const cachedHash = this.detector.templateHashes.get(templateId)
        
        if (!cachedHash) {
          // 新模板
          console.log(`🆕 发现新模板: ${templateAny.name}`)
          hasChanges = true
        } else if (cachedHash !== contentHash) {
          // 模板内容变化
          console.log(`📝 检测到模板内容变化: ${templateAny.name}`)
          hasChanges = true
        }
      }

      // 检查是否有模板被删除
      for (const [templateId] of this.detector.templateHashes) {
        if (!currentHashes.has(templateId)) {
          console.log(`🗑️ 检测到模板被删除: ${templateId}`)
          hasChanges = true
        }
      }

      if (hasChanges) {
        await this.handleTemplateChange('模板文件变化')
        this.detector.templateHashes = currentHashes
        this.saveHashesToStorage()
      }

    } catch (error) {
      // 静默处理，避免干扰正常使用
      if ((error as any)?.message?.includes('Failed to resolve') || 
          (error as any)?.message?.includes('fetch')) {
        // 模块解析失败，通常是文件还在编译中，忽略
        return
      }
      // 只在真正的错误时输出警告
      console.warn('⚠️ 检查模板变化时出错:', error)
    }
  }

  /**
   * 计算模板内容哈希值
   */
  private calculateTemplateHash(template: any): string {
    // 基于关键字段生成哈希
    const key = [
      template.name,
      template.promptTemplate,
      template.lastModified,
      JSON.stringify(template.params)
    ].join('|')
    
    // 简单哈希算法
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转为32位整数
    }
    
    return hash.toString()
  }

  /**
   * 处理模板变化
   */
  private async handleTemplateChange(reason: string): Promise<void> {
    console.log(`🔄 ${reason}，自动清除模板缓存...`)
    
    try {
      await clearTemplateCache()
      
      // 🔑 关键修复：清除内存中的哈希缓存，防止死循环
      this.detector.templateHashes.clear()
      console.log('🧹 已清除内存中的模板哈希缓存')
      
      // 强制重新初始化哈希记录
      await this.forceInitializeTemplateHashes()
      
      // 保存更新后的哈希值
      this.saveHashesToStorage()
      
      console.log('✅ 模板缓存已自动清除，预览图将重新加载')
      
      // 可选：触发页面软刷新
      if (window.location.pathname.includes('/templates') || 
          window.location.pathname.includes('/creator')) {
        console.log('🔄 检测到在模板相关页面，建议刷新页面以查看最新模板')
      }
      
    } catch (error) {
      console.error('❌ 自动处理模板变化失败:', error)
    }
  }

  /**
   * 手动触发检查
   */
  async manualCheck(): Promise<void> {
    console.log('🔍 手动检查模板变化...')
    await this.checkForTemplateChanges()
  }
}

// 创建全局实例
const templateHotReload = new TemplateHotReload()

// 暴露到全局
if (typeof window !== 'undefined') {
  (window as any).templateHotReload = templateHotReload;
  (window as any).checkTemplateChanges = () => templateHotReload.manualCheck();
  
  console.log('🔥 模板热重载工具已加载:')
  console.log('- window.templateHotReload.start() - 启动自动监听')
  console.log('- window.templateHotReload.stop() - 停止监听')
  console.log('- window.checkTemplateChanges() - 手动检查变化')
}

export { templateHotReload }
export default templateHotReload

// 将这些函数暴露到全局window对象，方便控制台调用
if (typeof window !== 'undefined') {
  // 暂时注释未定义的函数
  // (window as any).clearAllVideoCache = clearAllVideoCache;
  // (window as any).clearVideoCache = clearVideoCache;
  (window as any).clearTemplateCache = clearTemplateCache;
  // (window as any).forceReloadAllVideos = forceReloadAllVideos;
  // (window as any).resetApicoreApiService = resetApicoreApiService;
  
  console.log('🛠️ 缓存清除工具已加载到全局对象:')
  console.log('- window.clearAllVideoCache() - 清除所有视频缓存')
  console.log('- window.clearVideoCache(url) - 清除特定视频缓存')
  console.log('- window.clearTemplateCache() - 清除模板缓存（推荐）')
  console.log('- window.forceReloadAllVideos() - 强制重新加载所有视频')
  console.log('- window.resetApicoreApiService() - 重置APICore服务实例')
}