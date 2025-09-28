/**
 * 清理图片缓存脚本
 * 用于在图片压缩优化后清理旧缓存，让系统重新缓存优化后的图片
 * 注意：此脚本只清理localStorage，IndexedDB的清理请使用force-clear-cache.js
 */

console.log('🧹 开始清理图片缓存...')

// 清理localStorage中的图片缓存
let clearedCount = 0
const keysToRemove = []

for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (key && (key.startsWith('cached_img_') || key.startsWith('template_') || key.startsWith('thumb:'))) {
    keysToRemove.push(key)
  }
}

keysToRemove.forEach(key => {
  localStorage.removeItem(key)
  clearedCount++
})

console.log(`✅ 已清理 ${clearedCount} 个图片缓存项`)
console.log('💡 刷新页面以使用压缩优化后的图片')

// 如果在浏览器环境中运行，提供交互式确认
if (typeof window !== 'undefined' && confirm('是否立即刷新页面以应用压缩优化？')) {
  window.location.reload()
}