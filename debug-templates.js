// 临时调试脚本 - 清除模板同步缓存并手动设置一些模板点赞数
console.log('清除模板同步缓存...')
localStorage.removeItem('template_sync_cache')

// 手动为数据库中的模板添加一些初始点赞数
console.log('请手动刷新页面来重新触发模板同步')