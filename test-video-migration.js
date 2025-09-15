/**
 * 测试视频迁移到R2
 */

import { videoMigrationService } from './src/services/videoMigrationService.js'

async function testMigration() {
  console.log('🚀 开始测试视频迁移到R2...\n')

  try {
    // 1. 获取迁移统计
    console.log('📊 获取当前迁移统计...')
    const stats = await videoMigrationService.getMigrationStats()
    console.log('迁移统计:', stats)
    console.log('')

    if (stats.pending === 0) {
      console.log('✅ 没有待迁移的视频')
      return
    }

    // 2. 迁移一个视频作为测试
    console.log('🔄 开始迁移视频...')
    const migrationResult = await videoMigrationService.migrateBatch(1)
    
    console.log('迁移结果:')
    console.log(`  总计: ${migrationResult.total}`)
    console.log(`  成功: ${migrationResult.success}`)
    console.log(`  失败: ${migrationResult.failed}`)
    console.log(`  跳过: ${migrationResult.skipped}`)
    
    if (migrationResult.errors.length > 0) {
      console.log('错误信息:')
      migrationResult.errors.forEach(error => {
        console.log(`  ❌ ${error}`)
      })
    }

    // 3. 获取更新后的统计
    console.log('\n📈 迁移后统计...')
    const updatedStats = await videoMigrationService.getMigrationStats()
    console.log('更新后统计:', updatedStats)

  } catch (error) {
    console.error('💥 迁移测试失败:', error)
  }
}

// 运行测试
testMigration()