/**
 * 测试URL参数调试功能
 * 这个文件用于验证URL参数控制日志级别的功能
 */

import { log, logger } from './utils/logger';

// 等待DOM加载完成后测试
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    // 延迟执行，确保logger完全初始化
    setTimeout(() => {
      console.log('🧪 开始测试URL参数调试功能...');
      
      // 测试当前URL参数
      const urlParams = new URLSearchParams(window.location.search);
      const debugParam = urlParams.get('debug');
      
      console.log('当前URL debug参数:', debugParam);
      console.log('当前日志配置:', (window as any).__APP_LOGGER__?.getConfig());
      console.log('当前调试设置:', (window as any).__APP_LOGGER__?.getDebugInfo());
      
      // 生成测试日志
      console.log('\n📝 生成测试日志...');
      log.error('测试错误日志 - 应该始终显示');
      log.warn('测试警告日志 - 应该始终显示');
      log.info('测试信息日志 - debug模式才显示');
      log.debug('测试调试日志 - debug模式才显示');
      log.trace('测试跟踪日志 - trace模式才显示');
      
      // 显示使用说明
      console.log('\n📋 使用说明:');
      console.log('?debug=true   - 开启DEBUG级别');
      console.log('?debug=trace  - 开启TRACE级别');
      console.log('?debug=info   - 开启INFO级别');
      console.log('?debug=false  - 关闭调试模式');
      
      console.log('\n🔧 控制台命令:');
      console.log('__APP_LOGGER__.enableDebug()  - 开启调试');
      console.log('__APP_LOGGER__.disableDebug() - 关闭调试');
      console.log('__APP_LOGGER__.diagnose()     - 显示诊断信息');
      
    }, 1000);
  });
}