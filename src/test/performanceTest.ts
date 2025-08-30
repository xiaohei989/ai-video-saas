/**
 * 性能测试脚本
 * 测试缓存优化前后的性能差异
 */

import cacheIntegrationService from '@/services/CacheIntegrationService'
import { supabase } from '@/lib/supabase'

interface PerformanceTestResult {
  testName: string
  withCache: {
    duration: number
    success: boolean
    error?: string
  }
  withoutCache: {
    duration: number
    success: boolean
    error?: string
  }
  improvement: {
    speedup: number // 倍数
    description: string
  }
}

/**
 * 性能测试类
 */
class PerformanceTest {
  private testResults: PerformanceTestResult[] = []

  /**
   * 运行所有性能测试
   */
  async runAllTests(): Promise<PerformanceTestResult[]> {
    console.log('[PERFORMANCE TEST] 开始性能测试套件...')
    
    this.testResults = []

    // 初始化缓存服务
    await cacheIntegrationService.initialize()
    
    // 测试用户订阅查询
    await this.testUserSubscriptionQuery()
    
    // 测试用户积分查询
    await this.testUserCreditsQuery()
    
    // 测试模板统计查询
    await this.testTemplateStatsQuery()
    
    // 测试批量点赞状态查询
    await this.testBatchLikeStatusQuery()
    
    console.log('[PERFORMANCE TEST] 所有测试完成')
    return this.testResults
  }

  /**
   * 测试用户订阅查询性能
   */
  private async testUserSubscriptionQuery(): Promise<void> {
    console.log('[PERFORMANCE TEST] 测试用户订阅查询性能...')
    
    const testUserId = 'test-user-id-' + Date.now()
    const iterations = 100 // 执行100次查询

    // 测试使用缓存的性能
    const cacheStartTime = performance.now()
    let cacheSuccess = true
    let cacheError: string | undefined

    try {
      for (let i = 0; i < iterations; i++) {
        await cacheIntegrationService.getUserSubscription(testUserId)
      }
    } catch (error) {
      cacheSuccess = false
      cacheError = error instanceof Error ? error.message : String(error)
    }

    const cacheDuration = performance.now() - cacheStartTime

    // 测试直接数据库查询性能
    const dbStartTime = performance.now()
    let dbSuccess = true
    let dbError: string | undefined

    try {
      for (let i = 0; i < iterations; i++) {
        await this.getUserSubscriptionFromDB(testUserId)
      }
    } catch (error) {
      dbSuccess = false
      dbError = error instanceof Error ? error.message : String(error)
    }

    const dbDuration = performance.now() - dbStartTime

    // 计算性能提升
    const speedup = dbDuration / cacheDuration
    const improvement = Math.max(0, ((dbDuration - cacheDuration) / dbDuration) * 100)

    const result: PerformanceTestResult = {
      testName: '用户订阅查询 (100次)',
      withCache: {
        duration: cacheDuration,
        success: cacheSuccess,
        error: cacheError
      },
      withoutCache: {
        duration: dbDuration,
        success: dbSuccess,
        error: dbError
      },
      improvement: {
        speedup: speedup,
        description: `缓存比直接DB查询快 ${speedup.toFixed(2)} 倍，性能提升 ${improvement.toFixed(1)}%`
      }
    }

    this.testResults.push(result)
    console.log(`[PERFORMANCE TEST] 用户订阅查询测试完成: ${result.improvement.description}`)
  }

  /**
   * 测试用户积分查询性能
   */
  private async testUserCreditsQuery(): Promise<void> {
    console.log('[PERFORMANCE TEST] 测试用户积分查询性能...')
    
    const testUserId = 'test-user-id-' + Date.now()
    const iterations = 100

    // 测试使用缓存的性能
    const cacheStartTime = performance.now()
    let cacheSuccess = true
    let cacheError: string | undefined

    try {
      for (let i = 0; i < iterations; i++) {
        await cacheIntegrationService.getUserCredits(testUserId)
      }
    } catch (error) {
      cacheSuccess = false
      cacheError = error instanceof Error ? error.message : String(error)
    }

    const cacheDuration = performance.now() - cacheStartTime

    // 测试直接数据库查询性能
    const dbStartTime = performance.now()
    let dbSuccess = true
    let dbError: string | undefined

    try {
      for (let i = 0; i < iterations; i++) {
        await this.getUserCreditsFromDB(testUserId)
      }
    } catch (error) {
      dbSuccess = false
      dbError = error instanceof Error ? error.message : String(error)
    }

    const dbDuration = performance.now() - dbStartTime

    const speedup = dbDuration / cacheDuration
    const improvement = Math.max(0, ((dbDuration - cacheDuration) / dbDuration) * 100)

    const result: PerformanceTestResult = {
      testName: '用户积分查询 (100次)',
      withCache: {
        duration: cacheDuration,
        success: cacheSuccess,
        error: cacheError
      },
      withoutCache: {
        duration: dbDuration,
        success: dbSuccess,
        error: dbError
      },
      improvement: {
        speedup: speedup,
        description: `缓存比直接DB查询快 ${speedup.toFixed(2)} 倍，性能提升 ${improvement.toFixed(1)}%`
      }
    }

    this.testResults.push(result)
    console.log(`[PERFORMANCE TEST] 用户积分查询测试完成: ${result.improvement.description}`)
  }

  /**
   * 测试模板统计查询性能
   */
  private async testTemplateStatsQuery(): Promise<void> {
    console.log('[PERFORMANCE TEST] 测试模板统计查询性能...')
    
    const testTemplateId = 'test-template-id-' + Date.now()
    const iterations = 50

    // 测试使用缓存的性能
    const cacheStartTime = performance.now()
    let cacheSuccess = true
    let cacheError: string | undefined

    try {
      for (let i = 0; i < iterations; i++) {
        await cacheIntegrationService.getTemplateStats(testTemplateId)
      }
    } catch (error) {
      cacheSuccess = false
      cacheError = error instanceof Error ? error.message : String(error)
    }

    const cacheDuration = performance.now() - cacheStartTime

    // 测试直接数据库查询性能
    const dbStartTime = performance.now()
    let dbSuccess = true
    let dbError: string | undefined

    try {
      for (let i = 0; i < iterations; i++) {
        await this.getTemplateStatsFromDB(testTemplateId)
      }
    } catch (error) {
      dbSuccess = false
      dbError = error instanceof Error ? error.message : String(error)
    }

    const dbDuration = performance.now() - dbStartTime

    const speedup = dbDuration / cacheDuration
    const improvement = Math.max(0, ((dbDuration - cacheDuration) / dbDuration) * 100)

    const result: PerformanceTestResult = {
      testName: '模板统计查询 (50次)',
      withCache: {
        duration: cacheDuration,
        success: cacheSuccess,
        error: cacheError
      },
      withoutCache: {
        duration: dbDuration,
        success: dbSuccess,
        error: dbError
      },
      improvement: {
        speedup: speedup,
        description: `缓存比直接DB查询快 ${speedup.toFixed(2)} 倍，性能提升 ${improvement.toFixed(1)}%`
      }
    }

    this.testResults.push(result)
    console.log(`[PERFORMANCE TEST] 模板统计查询测试完成: ${result.improvement.description}`)
  }

  /**
   * 测试批量点赞状态查询性能
   */
  private async testBatchLikeStatusQuery(): Promise<void> {
    console.log('[PERFORMANCE TEST] 测试批量点赞状态查询性能...')
    
    const testUserId = 'test-user-id-' + Date.now()
    const templateIds = Array.from({ length: 20 }, (_, i) => `template-${i}`)
    const iterations = 20

    // 测试使用缓存的性能
    const cacheStartTime = performance.now()
    let cacheSuccess = true
    let cacheError: string | undefined

    try {
      for (let i = 0; i < iterations; i++) {
        await cacheIntegrationService.batchCheckUserLikes(testUserId, templateIds)
      }
    } catch (error) {
      cacheSuccess = false
      cacheError = error instanceof Error ? error.message : String(error)
    }

    const cacheDuration = performance.now() - cacheStartTime

    // 测试直接数据库查询性能
    const dbStartTime = performance.now()
    let dbSuccess = true
    let dbError: string | undefined

    try {
      for (let i = 0; i < iterations; i++) {
        await this.batchCheckUserLikesFromDB(testUserId, templateIds)
      }
    } catch (error) {
      dbSuccess = false
      dbError = error instanceof Error ? error.message : String(error)
    }

    const dbDuration = performance.now() - dbStartTime

    const speedup = dbDuration / cacheDuration
    const improvement = Math.max(0, ((dbDuration - cacheDuration) / dbDuration) * 100)

    const result: PerformanceTestResult = {
      testName: '批量点赞状态查询 (20次×20个模板)',
      withCache: {
        duration: cacheDuration,
        success: cacheSuccess,
        error: cacheError
      },
      withoutCache: {
        duration: dbDuration,
        success: dbSuccess,
        error: dbError
      },
      improvement: {
        speedup: speedup,
        description: `缓存比直接DB查询快 ${speedup.toFixed(2)} 倍，性能提升 ${improvement.toFixed(1)}%`
      }
    }

    this.testResults.push(result)
    console.log(`[PERFORMANCE TEST] 批量点赞状态查询测试完成: ${result.improvement.description}`)
  }

  // ============================================
  // 数据库直接查询方法（用于性能对比）
  // ============================================

  private async getUserSubscriptionFromDB(userId: string): Promise<string> {
    const { data } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    return data?.tier || 'free'
  }

  private async getUserCreditsFromDB(userId: string): Promise<number> {
    const { data } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single()

    return data?.credits || 0
  }

  private async getTemplateStatsFromDB(templateId: string): Promise<any> {
    const { data } = await supabase
      .from('templates')
      .select('like_count, comment_count, view_count, usage_count, share_count')
      .eq('id', templateId)
      .single()

    return data
  }

  private async batchCheckUserLikesFromDB(userId: string, templateIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>()
    
    const { data } = await supabase
      .from('template_likes')
      .select('template_id')
      .eq('user_id', userId)
      .in('template_id', templateIds)

    const likedTemplateIds = new Set(data?.map(like => like.template_id) || [])
    
    templateIds.forEach(templateId => {
      result.set(templateId, likedTemplateIds.has(templateId))
    })
    
    return result
  }

  /**
   * 生成性能测试报告
   */
  generateReport(): string {
    let report = '\n========== 性能测试报告 ==========\n\n'
    
    for (const result of this.testResults) {
      report += `测试项目: ${result.testName}\n`
      report += `缓存查询: ${result.withCache.duration.toFixed(2)}ms (${result.withCache.success ? '成功' : '失败'})\n`
      if (result.withCache.error) {
        report += `缓存错误: ${result.withCache.error}\n`
      }
      report += `数据库查询: ${result.withoutCache.duration.toFixed(2)}ms (${result.withoutCache.success ? '成功' : '失败'})\n`
      if (result.withoutCache.error) {
        report += `数据库错误: ${result.withoutCache.error}\n`
      }
      report += `性能提升: ${result.improvement.description}\n`
      report += `---\n\n`
    }

    // 计算总体性能提升
    const avgSpeedup = this.testResults.reduce((sum, result) => sum + result.improvement.speedup, 0) / this.testResults.length
    report += `总体平均性能提升: ${avgSpeedup.toFixed(2)} 倍\n`
    report += '======================================\n'
    
    return report
  }

  /**
   * 获取测试结果
   */
  getResults(): PerformanceTestResult[] {
    return this.testResults
  }
}

// 导出测试函数
export const runPerformanceTest = async (): Promise<PerformanceTestResult[]> => {
  const test = new PerformanceTest()
  const results = await test.runAllTests()
  
  // 打印报告
  console.log(test.generateReport())
  
  return results
}

export default PerformanceTest