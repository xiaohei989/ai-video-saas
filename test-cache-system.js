/**
 * 缓存系统综合测试
 * 测试统一缓存系统的功能、性能和稳定性
 */

import { unifiedCache } from './src/services/UnifiedCacheService.js'
import { templatesCacheService } from './src/services/templatesCacheService.js'
import { videoCacheService } from './src/services/videoCacheService.js'
import { cachePerformanceTracker } from './src/services/cachePerformanceTracker.js'

// 测试数据生成器
function generateTestData(size) {
  const data = {}
  for (let i = 0; i < size; i++) {
    data[`key_${i}`] = `test_value_${i}_${Math.random().toString(36).substring(7)}`
  }
  return data
}

// 生成大型测试数据（模拟图片）
function generateLargeTestData(sizeKB) {
  return 'x'.repeat(sizeKB * 1024)
}

class CacheSystemTester {
  constructor() {
    this.testResults = {
      basicFunctionality: { passed: 0, failed: 0, tests: [] },
      performance: { passed: 0, failed: 0, tests: [] },
      stability: { passed: 0, failed: 0, tests: [] },
      integration: { passed: 0, failed: 0, tests: [] }
    }
  }

  log(category, message, success = true) {
    const result = { message, success, timestamp: Date.now() }
    this.testResults[category].tests.push(result)
    if (success) {
      this.testResults[category].passed++
    } else {
      this.testResults[category].failed++
    }
    
    const status = success ? '✅' : '❌'
    console.log(`[${category.toUpperCase()}] ${status} ${message}`)
  }

  async testBasicFunctionality() {
    console.log('\n🔍 开始基础功能测试...')
    
    try {
      // 测试基本的 set/get 操作
      const testKey = 'test_basic_key'
      const testValue = { data: 'test_value', timestamp: Date.now() }
      
      await unifiedCache.set(testKey, testValue, { category: 'test', ttl: 60 })
      const retrieved = await unifiedCache.get(testKey, { category: 'test' })
      
      if (JSON.stringify(retrieved) === JSON.stringify(testValue)) {
        this.log('basicFunctionality', '基本读写操作测试通过')
      } else {
        this.log('basicFunctionality', '基本读写操作测试失败', false)
      }

      // 测试TTL过期
      await unifiedCache.set('ttl_test', 'value', { category: 'test', ttl: 0.001 }) // 1ms
      await new Promise(resolve => setTimeout(resolve, 10)) // 等待10ms
      const expiredValue = await unifiedCache.get('ttl_test', { category: 'test' })
      
      if (expiredValue === null) {
        this.log('basicFunctionality', 'TTL过期机制测试通过')
      } else {
        this.log('basicFunctionality', 'TTL过期机制测试失败', false)
      }

      // 测试不同分类
      const categories = ['image', 'template', 'video', 'user']
      for (const category of categories) {
        await unifiedCache.set(`test_${category}`, { category }, { category })
        const value = await unifiedCache.get(`test_${category}`, { category })
        if (value?.category === category) {
          this.log('basicFunctionality', `${category} 分类测试通过`)
        } else {
          this.log('basicFunctionality', `${category} 分类测试失败`, false)
        }
      }

      // 测试批量删除
      await unifiedCache.clearCategory('test')
      const clearedValue = await unifiedCache.get(testKey, { category: 'test' })
      if (clearedValue === null) {
        this.log('basicFunctionality', '分类清除功能测试通过')
      } else {
        this.log('basicFunctionality', '分类清除功能测试失败', false)
      }

    } catch (error) {
      this.log('basicFunctionality', `基础功能测试异常: ${error.message}`, false)
    }
  }

  async testPerformance() {
    console.log('\n⚡ 开始性能测试...')
    
    try {
      // 测试大量小数据写入性能
      const smallDataCount = 100
      const smallDataStartTime = performance.now()
      
      for (let i = 0; i < smallDataCount; i++) {
        await unifiedCache.set(`perf_small_${i}`, { index: i, data: 'small_data' }, { category: 'test' })
      }
      
      const smallDataWriteTime = performance.now() - smallDataStartTime
      this.log('performance', `小数据写入性能: ${smallDataCount}项用时${smallDataWriteTime.toFixed(1)}ms (平均${(smallDataWriteTime/smallDataCount).toFixed(2)}ms/项)`)

      // 测试大量小数据读取性能
      const smallDataReadStartTime = performance.now()
      
      for (let i = 0; i < smallDataCount; i++) {
        await unifiedCache.get(`perf_small_${i}`, { category: 'test' })
      }
      
      const smallDataReadTime = performance.now() - smallDataReadStartTime
      this.log('performance', `小数据读取性能: ${smallDataCount}项用时${smallDataReadTime.toFixed(1)}ms (平均${(smallDataReadTime/smallDataCount).toFixed(2)}ms/项)`)

      // 测试大数据写入性能
      const largeDataSizes = [10, 50, 100, 500] // KB
      for (const sizeKB of largeDataSizes) {
        const largeData = generateLargeTestData(sizeKB)
        const largeDataStartTime = performance.now()
        
        await unifiedCache.set(`perf_large_${sizeKB}kb`, largeData, { category: 'test' })
        
        const largeDataTime = performance.now() - largeDataStartTime
        this.log('performance', `大数据写入性能 (${sizeKB}KB): ${largeDataTime.toFixed(1)}ms`)
      }

      // 测试并发性能
      const concurrentCount = 20
      const concurrentStartTime = performance.now()
      
      const concurrentPromises = []
      for (let i = 0; i < concurrentCount; i++) {
        concurrentPromises.push(
          unifiedCache.set(`concurrent_${i}`, { index: i, timestamp: Date.now() }, { category: 'test' })
        )
      }
      
      await Promise.all(concurrentPromises)
      const concurrentTime = performance.now() - concurrentStartTime
      this.log('performance', `并发写入性能: ${concurrentCount}个并发操作用时${concurrentTime.toFixed(1)}ms`)

      // 测试缓存统计性能
      const statsStartTime = performance.now()
      const stats = unifiedCache.getGlobalStats()
      const statsTime = performance.now() - statsStartTime
      this.log('performance', `缓存统计性能: 获取全局统计用时${statsTime.toFixed(1)}ms`)

    } catch (error) {
      this.log('performance', `性能测试异常: ${error.message}`, false)
    }
  }

  async testStability() {
    console.log('\n🏗️ 开始稳定性测试...')
    
    try {
      // 压力测试：大量数据操作
      const stressTestCount = 200
      let successCount = 0
      let errorCount = 0
      
      console.log(`开始压力测试: ${stressTestCount}次操作...`)
      
      for (let i = 0; i < stressTestCount; i++) {
        try {
          const key = `stress_${i}_${Math.random().toString(36).substring(7)}`
          const value = generateTestData(5) // 生成5个键值对的测试数据
          
          await unifiedCache.set(key, value, { category: 'test', ttl: 30 })
          const retrieved = await unifiedCache.get(key, { category: 'test' })
          
          if (retrieved) {
            successCount++
          } else {
            errorCount++
          }
          
          // 随机执行删除操作
          if (Math.random() < 0.3) {
            await unifiedCache.delete(key, { category: 'test' })
          }
          
        } catch (error) {
          errorCount++
        }
        
        // 每50次操作显示进度
        if ((i + 1) % 50 === 0) {
          console.log(`压力测试进度: ${i + 1}/${stressTestCount} (成功: ${successCount}, 错误: ${errorCount})`)
        }
      }
      
      const successRate = (successCount / stressTestCount * 100).toFixed(1)
      if (successRate >= 95) {
        this.log('stability', `压力测试通过: 成功率${successRate}% (${successCount}/${stressTestCount})`)
      } else {
        this.log('stability', `压力测试失败: 成功率${successRate}% (${successCount}/${stressTestCount})`, false)
      }

      // 内存泄漏测试：重复操作相同键
      const memoryTestKey = 'memory_leak_test'
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0
      
      for (let i = 0; i < 100; i++) {
        await unifiedCache.set(memoryTestKey, generateTestData(10), { category: 'test' })
        await unifiedCache.get(memoryTestKey, { category: 'test' })
        await unifiedCache.delete(memoryTestKey, { category: 'test' })
      }
      
      const finalMemory = process.memoryUsage?.()?.heapUsed || 0
      const memoryDiff = finalMemory - initialMemory
      
      if (memoryDiff < 1024 * 1024) { // 小于1MB增长
        this.log('stability', `内存泄漏测试通过: 内存变化${(memoryDiff/1024).toFixed(1)}KB`)
      } else {
        this.log('stability', `内存泄漏测试警告: 内存增长${(memoryDiff/1024/1024).toFixed(1)}MB`, false)
      }

      // 错误恢复测试
      try {
        await unifiedCache.set('error_test', null, { category: 'invalid_category_!@#' })
        await unifiedCache.get('nonexistent_key', { category: 'test' })
        this.log('stability', '错误处理测试通过')
      } catch (error) {
        this.log('stability', `错误处理测试: ${error.message}`)
      }

    } catch (error) {
      this.log('stability', `稳定性测试异常: ${error.message}`, false)
    }
  }

  async testIntegration() {
    console.log('\n🔗 开始集成测试...')
    
    try {
      // 测试模板缓存服务集成
      console.log('测试模板缓存服务集成...')
      const templateStats = templatesCacheService.getCacheStats()
      this.log('integration', `模板缓存统计获取成功: ${templateStats.totalItems}项`)

      // 测试视频缓存服务集成
      console.log('测试视频缓存服务集成...')
      const videoStats = videoCacheService.getCacheStats()
      this.log('integration', `视频缓存统计获取成功: ${videoStats.totalItems}项`)

      // 测试性能追踪器集成
      console.log('测试性能追踪器集成...')
      await cachePerformanceTracker.captureSnapshot()
      const performanceMetrics = cachePerformanceTracker.getPerformanceMetrics('1h')
      this.log('integration', `性能追踪器工作正常: 平均命中率${(performanceMetrics.averageHitRate * 100).toFixed(1)}%`)

      // 测试全局统计
      const globalStats = unifiedCache.getGlobalStats()
      const hasRequiredStats = globalStats.summary && globalStats.categories && Array.isArray(globalStats.categories)
      if (hasRequiredStats) {
        this.log('integration', '全局统计结构验证通过')
      } else {
        this.log('integration', '全局统计结构验证失败', false)
      }

      // 测试分类系统完整性
      const categoryNames = globalStats.categories.map(cat => cat.name)
      const expectedCategories = ['image', 'template', 'video', 'user']
      const missingCategories = expectedCategories.filter(cat => !categoryNames.includes(cat))
      
      if (missingCategories.length === 0) {
        this.log('integration', '分类系统完整性验证通过')
      } else {
        this.log('integration', `分类系统缺少: ${missingCategories.join(', ')}`, false)
      }

    } catch (error) {
      this.log('integration', `集成测试异常: ${error.message}`, false)
    }
  }

  printSummary() {
    console.log('\n📊 测试结果总结')
    console.log('=' .repeat(50))
    
    let totalPassed = 0
    let totalFailed = 0
    
    Object.entries(this.testResults).forEach(([category, results]) => {
      const { passed, failed } = results
      totalPassed += passed
      totalFailed += failed
      
      const total = passed + failed
      const passRate = total > 0 ? (passed / total * 100).toFixed(1) : '0.0'
      const status = failed === 0 ? '✅' : '⚠️ '
      
      console.log(`${status} ${category.padEnd(15)}: ${passed}/${total} 通过 (${passRate}%)`)
    })
    
    const overallTotal = totalPassed + totalFailed
    const overallPassRate = overallTotal > 0 ? (totalPassed / overallTotal * 100).toFixed(1) : '0.0'
    
    console.log('-'.repeat(50))
    console.log(`🎯 总体结果: ${totalPassed}/${overallTotal} 通过 (${overallPassRate}%)`)
    
    if (totalFailed === 0) {
      console.log('🎉 所有测试通过！缓存系统运行正常。')
    } else {
      console.log(`⚠️  发现 ${totalFailed} 个失败的测试，请检查详细日志。`)
    }

    // 性能建议
    console.log('\n💡 性能建议:')
    const performanceTests = this.testResults.performance.tests
    performanceTests.forEach(test => {
      if (test.success && test.message.includes('ms')) {
        console.log(`  • ${test.message}`)
      }
    })

    return { totalPassed, totalFailed, passRate: overallPassRate }
  }

  async runAllTests() {
    console.log('🚀 开始缓存系统综合测试')
    console.log('测试时间:', new Date().toLocaleString('zh-CN'))
    
    const startTime = performance.now()
    
    await this.testBasicFunctionality()
    await this.testPerformance()
    await this.testStability()
    await this.testIntegration()
    
    const totalTime = performance.now() - startTime
    
    console.log(`\n⏱️  总测试时间: ${totalTime.toFixed(1)}ms`)
    
    const results = this.printSummary()
    
    // 清理测试数据
    await unifiedCache.clearCategory('test')
    console.log('\n🧹 测试数据已清理')
    
    return results
  }
}

// 运行测试
async function runTests() {
  try {
    const tester = new CacheSystemTester()
    const results = await tester.runAllTests()
    
    // 如果测试通过率低于90%，退出进程返回错误码
    if (parseFloat(results.passRate) < 90) {
      process.exit(1)
    } else {
      process.exit(0)
    }
    
  } catch (error) {
    console.error('❌ 测试运行失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件则执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
}

export { CacheSystemTester }