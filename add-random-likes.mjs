import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('🎯 开始为所有模板添加随机点赞数据...')

async function addRandomLikesToAllTemplates() {
  try {
    // 1. 获取所有模板
    console.log('📋 获取所有模板...')
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('id, slug, name')
      .eq('is_active', true)
      .eq('is_public', true)

    if (templatesError) {
      throw templatesError
    }

    console.log(`✅ 找到 ${templates.length} 个模板`)

    // 2. 清空现有点赞数据
    console.log('🧹 清空现有点赞数据...')
    const { error: deleteError } = await supabase
      .from('template_likes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // 删除所有记录

    if (deleteError) {
      console.warn('删除现有数据时出错:', deleteError.message)
    }

    // 3. 为每个模板生成随机点赞数据
    console.log('🎲 生成随机点赞数据...')
    
    const batchSize = 100 // 每批处理100个点赞记录
    let totalLikes = 0

    for (const template of templates) {
      // 为每个模板生成50-1000的随机点赞数
      const likeCount = Math.floor(Math.random() * (1000 - 50 + 1)) + 50
      console.log(`📈 ${template.name || template.slug}: ${likeCount} 个点赞`)

      // 生成虚拟点赞记录
      const likesData = []
      for (let i = 0; i < likeCount; i++) {
        // 生成虚拟用户ID（UUID格式）
        const userId = crypto.randomUUID()
        
        likesData.push({
          template_id: template.id,
          user_id: userId,
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() // 过去30天内随机时间
        })

        // 分批插入，避免请求过大
        if (likesData.length >= batchSize) {
          const { error: insertError } = await supabase
            .from('template_likes')
            .insert(likesData)

          if (insertError) {
            console.error(`❌ 插入点赞数据失败 (${template.slug}):`, insertError.message)
          }

          totalLikes += likesData.length
          likesData.length = 0 // 清空数组
        }
      }

      // 插入剩余的数据
      if (likesData.length > 0) {
        const { error: insertError } = await supabase
          .from('template_likes')
          .insert(likesData)

        if (insertError) {
          console.error(`❌ 插入剩余点赞数据失败 (${template.slug}):`, insertError.message)
        }

        totalLikes += likesData.length
      }
    }

    console.log(`\n🎊 完成！总共添加了 ${totalLikes} 个点赞记录`)

    // 4. 验证结果
    console.log('\n📊 验证结果...')
    const { data: verification } = await supabase
      .from('template_likes')
      .select('template_id')

    const likeCounts = new Map()
    verification?.forEach(like => {
      const count = likeCounts.get(like.template_id) || 0
      likeCounts.set(like.template_id, count + 1)
    })

    console.log('\n📈 各模板点赞数统计:')
    for (const template of templates.slice(0, 10)) { // 显示前10个模板的统计
      const count = likeCounts.get(template.id) || 0
      console.log(`  - ${template.name || template.slug}: ${count} 赞`)
    }

    if (templates.length > 10) {
      console.log(`  ... 还有 ${templates.length - 10} 个模板`)
    }

  } catch (error) {
    console.error('❌ 操作失败:', error)
  }
}

await addRandomLikesToAllTemplates()