// 强制模板同步脚本
console.log('清除模板同步缓存...')
localStorage.removeItem('template_sync_cache')
console.log('✅ 缓存已清除')

// 清除点赞缓存
if (window.likesCacheService) {
  window.likesCacheService.clear()
  console.log('✅ 点赞缓存已清除')
}

console.log('请刷新页面来触发模板重新同步')

// 也清除模板ID转换缓存
if (window.clearIdMappingCache) {
  window.clearIdMappingCache()
  console.log('✅ ID映射缓存已清除')
}