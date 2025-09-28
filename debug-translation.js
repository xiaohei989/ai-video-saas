// 调试翻译问题的测试脚本
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 调试翻译显示问题...')
console.log('问题：页面显示 "video.backgroundLoading.desktop" 而不是中文翻译')
console.log()

console.log('📋 问题分析：')
console.log('1. 翻译key存在于zh.json文件中')
console.log('2. useTranslation hook已正确导入和使用')
console.log('3. i18n配置文件看起来正常')
console.log('4. 可能的原因：')
console.log('   - i18n初始化时机问题')
console.log('   - 组件渲染时翻译资源未加载完成')
console.log('   - Suspense边界问题')
console.log('   - namespace配置问题')
console.log()

console.log('🔧 建议的解决方案：')
console.log('1. 添加翻译加载检查')
console.log('2. 使用i18n.isReady状态')
console.log('3. 添加loading状态处理')
console.log('4. 检查翻译资源是否正确加载')