/**
 * 测试模板同步修复
 * 验证UUID生成和slug匹配逻辑
 */

import { syncTemplatesToDatabase, checkTemplateSync } from '../utils/syncTemplates'

console.log('🔧 测试模板同步修复功能\n')

async function testSyncFix() {
  try {
    console.log('1. 检查当前同步状态...')
    const checkResult = await checkTemplateSync()
    
    console.log(`   - 需要同步: ${checkResult.needsSync}`)
    console.log(`   - 缺失模板: ${checkResult.missingTemplates.length}`)
    console.log(`   - 过期模板: ${checkResult.outdatedTemplates.length}`)
    console.log(`   - 前端模板数: ${checkResult.totalFrontendTemplates}`)
    console.log(`   - 数据库模板数: ${checkResult.totalDbTemplates}`)
    
    if (checkResult.missingTemplates.length > 0) {
      console.log('\n   缺失的模板:', checkResult.missingTemplates)
    }
    
    if (checkResult.outdatedTemplates.length > 0) {
      console.log('\n   过期的模板:', checkResult.outdatedTemplates)
    }
    
    if (checkResult.needsSync) {
      console.log('\n2. 开始同步模板...')
      const syncResult = await syncTemplatesToDatabase()
      
      console.log(`   - 同步成功: ${syncResult.success}`)
      console.log(`   - 新增模板: ${syncResult.synced}`)
      console.log(`   - 更新模板: ${syncResult.updated}`)
      
      if (syncResult.errors.length > 0) {
        console.log('   - 同步错误:', syncResult.errors)
      }
      
      if (syncResult.details) {
        if (syncResult.details.newTemplates.length > 0) {
          console.log('   - 新增列表:', syncResult.details.newTemplates)
        }
        if (syncResult.details.updatedTemplates.length > 0) {
          console.log('   - 更新列表:', syncResult.details.updatedTemplates)
        }
      }
    } else {
      console.log('\n✅ 所有模板都是最新的，无需同步')
    }
    
  } catch (error) {
    console.error('❌ 同步测试失败:', error)
  }
}

testSyncFix()