import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('🎯 为所有模板添加简单随机点赞数据...')

async function addSimpleRandomLikes() {
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
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteError) {
      console.warn('删除现有数据时出错:', deleteError.message)
    }

    // 3. 获取一些真实用户ID用于创建测试数据
    console.log('🔍 获取真实用户ID...')
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .limit(50) // 获取前50个用户

    if (usersError || !users || users.length === 0) {
      console.log('⚠️ 没有找到真实用户，使用模拟统计方法')
      
      // 方法2：直接在API中模拟点赞数
      console.log('📊 为每个模板设置随机点赞数...')
      const templateStats = []
      
      for (const template of templates) {
        const likeCount = Math.floor(Math.random() * (1000 - 50 + 1)) + 50
        const name = typeof template.name === 'object' ? 
          template.name?.zh || template.name?.en || template.slug : template.name
        
        templateStats.push({
          id: template.id,
          name: name,
          likeCount: likeCount
        })
        
        console.log(`📈 ${name}: ${likeCount} 赞`)
      }
      
      // 保存到文件供API使用
      console.log('\n💾 保存点赞统计数据...')
      const fs = await import('fs')
      fs.writeFileSync('./mock-like-stats.json', JSON.stringify(templateStats, null, 2))
      
      console.log('✅ 模拟数据已保存到 mock-like-stats.json')
      console.log('🔧 需要在API服务中读取此文件来返回模拟的点赞数')
      
      return
    }

    console.log(`✅ 找到 ${users.length} 个真实用户`)

    // 4. 为每个模板创建真实的点赞记录
    console.log('🎲 使用真实用户创建点赞记录...')
    
    for (const template of templates) {
      const likeCount = Math.floor(Math.random() * (1000 - 50 + 1)) + 50
      const name = typeof template.name === 'object' ? 
        template.name?.zh || template.name?.en || template.slug : template.name
      
      console.log(`📈 ${name}: ${likeCount} 赞`)

      // 随机选择用户来创建点赞记录
      const likesData = []
      const usedUsers = new Set()
      
      for (let i = 0; i < Math.min(likeCount, users.length); i++) {
        let randomUser
        do {
          randomUser = users[Math.floor(Math.random() * users.length)]
        } while (usedUsers.has(randomUser.id) && usedUsers.size < users.length)
        
        if (!usedUsers.has(randomUser.id)) {
          usedUsers.add(randomUser.id)
          likesData.push({
            template_id: template.id,
            user_id: randomUser.id,
            created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
          })
        }
      }

      // 分批插入点赞记录
      const batchSize = 50
      for (let i = 0; i < likesData.length; i += batchSize) {
        const batch = likesData.slice(i, i + batchSize)
        const { error: insertError } = await supabase
          .from('template_likes')
          .insert(batch)

        if (insertError) {
          console.error(`❌ 插入点赞数据失败 (${template.slug}):`, insertError.message)
          break
        }
      }
    }

    // 5. 验证结果
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
    for (const template of templates.slice(0, 10)) {
      const count = likeCounts.get(template.id) || 0
      const name = typeof template.name === 'object' ? 
        template.name?.zh || template.name?.en || template.slug : template.name
      console.log(`  - ${name}: ${count} 赞`)
    }

    if (templates.length > 10) {
      console.log(`  ... 还有 ${templates.length - 10} 个模板`)
    }

    console.log(`\n🎊 完成！总共创建了 ${verification?.length || 0} 个点赞记录`)

  } catch (error) {
    console.error('❌ 操作失败:', error)
  }
}

await addSimpleRandomLikes()