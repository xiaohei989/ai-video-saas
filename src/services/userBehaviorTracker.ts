/**
 * 用户行为跟踪服务 - 增强模板预加载的智能性
 * 分析用户在模板页面的行为模式，提供更精准的预加载策略
 */

interface UserInteraction {
  type: 'hover' | 'click' | 'scroll' | 'view' | 'search' | 'filter'
  templateId?: string
  category?: string
  timestamp: number
  duration?: number
  metadata?: Record<string, any>
}

interface BehaviorPattern {
  preferredCategories: Map<string, number> // 分类偏好及权重
  averageHoverTime: number // 平均悬停时间
  searchHistory: string[] // 搜索历史
  viewDepth: number // 平均浏览深度（页数）
  sessionDuration: number // 会话时长
  interactionFrequency: number // 交互频率
  devicePattern: 'mobile' | 'desktop' // 设备类型
  timeOfDayPattern: number[] // 24小时使用模式
}

interface PredictionScore {
  templateId: string
  score: number // 0-100
  reasons: string[]
}

class UserBehaviorTracker {
  private interactions: UserInteraction[] = []
  private sessionStart: number = Date.now()
  private lastInteractionTime: number = Date.now()
  private hoverStartTime: Map<string, number> = new Map()
  
  // 行为模式缓存
  private behaviorPattern: BehaviorPattern | null = null
  private patternCacheTime: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

  constructor() {
    this.setupGlobalListeners()
    this.loadBehaviorFromStorage()
  }

  /**
   * 🔧 设置全局事件监听
   */
  private setupGlobalListeners(): void {
    // 页面可见性变化监听
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackInteraction({ type: 'view', timestamp: Date.now() })
      }
    })

    // 页面卸载时保存数据
    window.addEventListener('beforeunload', () => {
      this.saveBehaviorToStorage()
    })

    // 滚动行为监听
    let lastScrollTime = Date.now()
    window.addEventListener('scroll', () => {
      const now = Date.now()
      if (now - lastScrollTime > 1000) { // 防抖：1秒内多次滚动只记录一次
        this.trackInteraction({
          type: 'scroll',
          timestamp: now,
          metadata: {
            scrollY: window.scrollY,
            scrollSpeed: Math.abs(window.scrollY - (this.getLastScrollY() || 0)) / (now - lastScrollTime)
          }
        })
        lastScrollTime = now
      }
    }, { passive: true })
  }

  /**
   * 📊 记录用户交互
   */
  trackInteraction(interaction: UserInteraction): void {
    this.interactions.push(interaction)
    this.lastInteractionTime = interaction.timestamp

    // 保持最近100个交互记录，避免内存泄漏
    if (this.interactions.length > 100) {
      this.interactions = this.interactions.slice(-100)
    }

    // 清除过期的行为模式缓存
    this.invalidatePatternCache()

    console.log('[BehaviorTracker] 📊 记录交互:', interaction.type, interaction.templateId || '无模板')
  }

  /**
   * 🎯 跟踪模板悬停
   */
  trackTemplateHover(templateId: string, category?: string): void {
    const now = Date.now()
    this.hoverStartTime.set(templateId, now)
    
    this.trackInteraction({
      type: 'hover',
      templateId,
      category,
      timestamp: now
    })
  }

  /**
   * 🎯 跟踪模板悬停结束
   */
  trackTemplateHoverEnd(templateId: string): void {
    const startTime = this.hoverStartTime.get(templateId)
    if (startTime) {
      const duration = Date.now() - startTime
      this.hoverStartTime.delete(templateId)

      // 更新悬停交互记录的时长
      const lastInteraction = this.interactions.findLast(
        i => i.type === 'hover' && i.templateId === templateId
      )
      if (lastInteraction) {
        lastInteraction.duration = duration
      }

      console.log(`[BehaviorTracker] ⏱️ 模板悬停时长: ${templateId} - ${duration}ms`)
    }
  }

  /**
   * 🎯 跟踪模板点击
   */
  trackTemplateClick(templateId: string, category?: string): void {
    this.trackInteraction({
      type: 'click',
      templateId,
      category,
      timestamp: Date.now()
    })
  }

  /**
   * 🔍 跟踪搜索行为
   */
  trackSearch(query: string): void {
    this.trackInteraction({
      type: 'search',
      timestamp: Date.now(),
      metadata: { query: query.toLowerCase() }
    })
  }

  /**
   * 🏷️ 跟踪筛选行为
   */
  trackFilter(filterType: string, filterValue: string): void {
    this.trackInteraction({
      type: 'filter',
      timestamp: Date.now(),
      metadata: { filterType, filterValue }
    })
  }

  /**
   * 🧠 分析用户行为模式
   */
  analyzeBehaviorPattern(): BehaviorPattern {
    const now = Date.now()
    
    // 检查缓存
    if (this.behaviorPattern && now - this.patternCacheTime < this.CACHE_DURATION) {
      return this.behaviorPattern
    }

    console.log('[BehaviorTracker] 🧠 分析行为模式，交互数:', this.interactions.length)

    // 分析分类偏好
    const categoryPreferences = new Map<string, number>()
    let totalHoverTime = 0
    let hoverCount = 0

    this.interactions.forEach(interaction => {
      if (interaction.category) {
        const current = categoryPreferences.get(interaction.category) || 0
        categoryPreferences.set(interaction.category, current + 1)
      }

      if (interaction.type === 'hover' && interaction.duration) {
        totalHoverTime += interaction.duration
        hoverCount++
      }
    })

    // 计算平均悬停时间
    const averageHoverTime = hoverCount > 0 ? totalHoverTime / hoverCount : 2000 // 默认2秒

    // 分析搜索历史
    const searchHistory = this.interactions
      .filter(i => i.type === 'search')
      .map(i => i.metadata?.query as string)
      .filter(Boolean)
      .slice(-5) // 最近5次搜索

    // 计算会话时长
    const sessionDuration = now - this.sessionStart

    // 计算交互频率（每分钟交互次数）
    const interactionFrequency = this.interactions.length / (sessionDuration / 60000)

    // 检测设备类型
    const devicePattern: 'mobile' | 'desktop' = window.innerWidth <= 768 ? 'mobile' : 'desktop'

    // 分析时间模式（当前小时）
    const currentHour = new Date().getHours()
    const timeOfDayPattern = new Array(24).fill(0)
    timeOfDayPattern[currentHour] = 1

    this.behaviorPattern = {
      preferredCategories: categoryPreferences,
      averageHoverTime,
      searchHistory,
      viewDepth: 1, // 简化：暂时固定为1
      sessionDuration,
      interactionFrequency,
      devicePattern,
      timeOfDayPattern
    }

    this.patternCacheTime = now
    return this.behaviorPattern
  }

  /**
   * 🔮 预测用户对模板的兴趣度
   */
  predictTemplateInterest(templates: Array<{
    id: string
    category?: string
    tags?: string[]
    name?: string
  }>): PredictionScore[] {
    const pattern = this.analyzeBehaviorPattern()
    
    return templates.map(template => {
      const reasons: string[] = []
      let score = 50 // 基础分数

      // 分类偏好加分
      if (template.category && pattern.preferredCategories.has(template.category)) {
        const categoryWeight = pattern.preferredCategories.get(template.category)!
        score += Math.min(categoryWeight * 5, 25) // 最高加25分
        reasons.push(`用户偏好分类: ${template.category}`)
      }

      // 搜索历史匹配加分
      const templateName = template.name?.toLowerCase() || ''
      const nameWords = templateName.split(/\s+/)
      
      pattern.searchHistory.forEach(query => {
        if (nameWords.some(word => word.includes(query)) || templateName.includes(query)) {
          score += 15
          reasons.push(`匹配搜索历史: ${query}`)
        }
      })

      // 标签匹配加分
      if (template.tags) {
        template.tags.forEach(tag => {
          if (pattern.searchHistory.some(query => tag.toLowerCase().includes(query))) {
            score += 10
            reasons.push(`标签匹配搜索: ${tag}`)
          }
        })
      }

      // 设备优化
      if (pattern.devicePattern === 'mobile') {
        // 移动端用户倾向于简单明了的模板
        score += 5
        reasons.push('移动端优化')
      }

      // 活跃度加成
      if (pattern.interactionFrequency > 5) { // 高频交互用户
        score += 10
        reasons.push('活跃用户加成')
      }

      // 确保分数在合理范围内
      score = Math.max(0, Math.min(100, score))

      return {
        templateId: template.id,
        score,
        reasons
      }
    }).sort((a, b) => b.score - a.score) // 按分数降序排列
  }

  /**
   * 💾 保存行为数据到本地存储
   */
  private saveBehaviorToStorage(): void {
    try {
      const behaviorData = {
        interactions: this.interactions.slice(-20), // 只保存最近20个交互
        sessionStart: this.sessionStart,
        lastSave: Date.now()
      }
      
      localStorage.setItem('userBehaviorData', JSON.stringify(behaviorData))
      console.log('[BehaviorTracker] 💾 行为数据已保存')
    } catch (error) {
      console.warn('[BehaviorTracker] 保存行为数据失败:', error)
    }
  }

  /**
   * 📖 从本地存储加载行为数据
   */
  private loadBehaviorFromStorage(): void {
    try {
      const stored = localStorage.getItem('userBehaviorData')
      if (stored) {
        const behaviorData = JSON.parse(stored)
        
        // 只加载最近的数据（1小时内）
        const oneHourAgo = Date.now() - 60 * 60 * 1000
        if (behaviorData.lastSave > oneHourAgo) {
          this.interactions = behaviorData.interactions || []
          console.log('[BehaviorTracker] 📖 已加载历史行为数据:', this.interactions.length)
        }
      }
    } catch (error) {
      console.warn('[BehaviorTracker] 加载行为数据失败:', error)
    }
  }

  /**
   * 🗑️ 清除行为模式缓存
   */
  private invalidatePatternCache(): void {
    this.patternCacheTime = 0
    this.behaviorPattern = null
  }

  /**
   * 📊 获取最后一次滚动位置
   */
  private getLastScrollY(): number | null {
    const lastScroll = this.interactions.findLast(i => i.type === 'scroll')
    return lastScroll?.metadata?.scrollY || null
  }

  /**
   * 📈 获取行为统计信息
   */
  getBehaviorStats(): {
    totalInteractions: number
    sessionDuration: number
    averageHoverTime: number
    topCategories: Array<{ category: string, count: number }>
    interactionFrequency: number
  } {
    const pattern = this.analyzeBehaviorPattern()
    
    const topCategories = Array.from(pattern.preferredCategories.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalInteractions: this.interactions.length,
      sessionDuration: pattern.sessionDuration,
      averageHoverTime: pattern.averageHoverTime,
      topCategories,
      interactionFrequency: pattern.interactionFrequency
    }
  }

  /**
   * 🧹 清理行为数据
   */
  clearBehaviorData(): void {
    this.interactions = []
    this.hoverStartTime.clear()
    this.invalidatePatternCache()
    localStorage.removeItem('userBehaviorData')
    console.log('[BehaviorTracker] 🧹 行为数据已清理')
  }
}

// 导出单例实例
export const userBehaviorTracker = new UserBehaviorTracker()