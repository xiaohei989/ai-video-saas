// 添加测试点赞数据的脚本
import { supabase } from './src/lib/supabase.js'

const addTestLikes = async () => {
  try {
    console.log('正在为模板添加测试点赞数据...')
    
    // 获取所有模板
    const { data: templates, error } = await supabase
      .from('templates')
      .select('id, slug')
    
    if (error) {
      console.error('获取模板失败:', error)
      return
    }
    
    if (!templates || templates.length === 0) {
      console.log('数据库中没有找到模板，请先运行模板同步')
      return
    }
    
    console.log(`找到 ${templates.length} 个模板`)
    
    // 为每个模板添加随机点赞数
    for (const template of templates) {
      const randomLikes = Math.floor(Math.random() * 1000) + 50 // 50-1049之间的随机数
      
      const { error: updateError } = await supabase
        .from('templates')
        .update({ like_count: randomLikes })
        .eq('id', template.id)
      
      if (updateError) {
        console.error(`更新模板 ${template.slug} 点赞数失败:`, updateError)
      } else {
        console.log(`✅ 模板 ${template.slug}: ${randomLikes} 个点赞`)
      }
    }
    
    console.log('完成！所有模板都已添加测试点赞数据。')
  } catch (error) {
    console.error('脚本执行失败:', error)
  }
}

// 如果是直接运行这个脚本
if (typeof window === 'undefined') {
  addTestLikes()
} else {
  // 在浏览器中运行
  window.addTestLikes = addTestLikes
}