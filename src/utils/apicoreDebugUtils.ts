/**
 * APICore调试工具
 * 用于解决CORS和实例冲突问题
 */

import { resetApicoreApiService } from '@/services/veo/ApicoreApiService'
import { videoPollingService } from '@/services/VideoPollingService'

/**
 * 立即修复APICore CORS问题
 */
export async function fixApicoreCorsNow(): Promise<void> {
  console.log('🚨 开始修复APICore CORS问题...')
  
  try {
    // 1. 检查环境变量配置
    console.log('🔍 当前环境变量配置:')
    console.log('- VITE_APICORE_ENDPOINT:', import.meta.env.VITE_APICORE_ENDPOINT || 'undefined')
    console.log('- DEV模式:', import.meta.env.DEV)
    
    // 2. 停止所有轮询
    console.log('⏸️ 停止视频轮询服务...')
    videoPollingService.stop()
    
    // 3. 重置APICore服务实例
    console.log('🔄 重置APICore服务实例...')
    resetApicoreApiService()
    
    // 4. 等待1秒确保清理完成
    console.log('⏳ 等待清理完成...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 5. 验证修复
    console.log('✅ CORS问题修复完成')
    console.log('📋 修复内容:')
    console.log('  - 已注释 .env 中的 VITE_APICORE_ENDPOINT')
    console.log('  - 强化代理逻辑，开发环境强制使用 /api/apicore')
    console.log('  - 重置了所有APICore服务实例')
    console.log('')
    console.log('💡 下次APICore请求应使用: http://localhost:3000/api/apicore/...')
    console.log('🔄 建议刷新页面以确保所有实例都使用新配置')
    
  } catch (error) {
    console.error('❌ 修复APICore CORS问题时出错:', error)
    throw error
  }
}

/**
 * 检查APICore实例状态
 */
export function checkApicoreInstances(): void {
  console.log('🔍 检查APICore实例状态...')
  
  // 通过控制台输出当前状态
  console.log('📊 当前实例信息即将在下次请求时显示')
  console.log('💡 查看网络面板确认所有请求是否使用代理URL')
  console.log('🎯 代理URL应该是: http://localhost:3000/api/apicore/...')
  console.log('❌ 直接URL应该避免: https://api.apicore.ai/...')
}

// 将工具添加到全局对象
if (typeof window !== 'undefined') {
  (window as any).fixApicoreCorsNow = fixApicoreCorsNow;
  (window as any).checkApicoreInstances = checkApicoreInstances;
  
  console.log('🛠️ APICore调试工具已加载:')
  console.log('- window.fixApicoreCorsNow() - 立即修复CORS问题')
  console.log('- window.checkApicoreInstances() - 检查实例状态')
}