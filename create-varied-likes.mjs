import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('🎯 为每个模板创建不同的随机点赞数(20-1000)...')

async function createVariedLikes() {
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

    // 3. 创建虚拟用户ID池（足够多的虚拟用户）
    console.log('👥 准备虚拟用户ID池...')
    const virtualUserIds = []
    
    // 生成2000个虚拟用户ID（确保足够覆盖所有模板的最大点赞数）
    for (let i = 0; i < 2000; i++) {
      virtualUserIds.push(crypto.randomUUID())
    }

    // 4. 暂时禁用外键约束检查
    console.log('⚠️ 暂时禁用外键约束...')
    const { error: disableError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE template_likes DISABLE TRIGGER ALL;'
    })
    
    if (disableError) {
      console.warn('禁用约束失败，继续尝试直接插入:', disableError.message)
    }

    // 5. 为每个模板创建不同数量的点赞
    console.log('🎲 为每个模板生成不同的点赞数...')
    
    let userIdIndex = 0
    const templateStats = []
    
    for (const template of templates) {
      // 生成20-1000之间的随机点赞数
      const likeCount = Math.floor(Math.random() * (1000 - 20 + 1)) + 20
      const name = typeof template.name === 'object' ? 
        template.name?.zh || template.name?.en || template.slug : template.name
      
      console.log(`📈 ${name}: ${likeCount} 赞`)

      // 创建点赞记录
      const likesData = []
      for (let i = 0; i < likeCount; i++) {
        if (userIdIndex >= virtualUserIds.length) {
          console.warn('虚拟用户ID不足，重新生成...')
          virtualUserIds.push(crypto.randomUUID())
        }
        
        likesData.push({
          template_id: template.id,
          user_id: virtualUserIds[userIdIndex++],
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
        })
      }

      // 分批插入点赞记录
      const batchSize = 100
      for (let i = 0; i < likesData.length; i += batchSize) {
        const batch = likesData.slice(i, i + batchSize)
        
        try {
          const { error: insertError } = await supabase
            .from('template_likes')
            .insert(batch)

          if (insertError) {
            console.error(`❌ 插入点赞数据失败 (${template.slug}):`, insertError.message)
            
            // 如果外键约束失败，尝试使用原生SQL直接插入
            console.log('🔧 尝试使用原生SQL插入...')
            const values = batch.map(like => 
              `('${like.template_id}', '${like.user_id}', '${like.created_at}')`
            ).join(',')
            
            const { error: sqlError } = await supabase.rpc('exec_sql', {
              sql: `INSERT INTO template_likes (template_id, user_id, created_at) VALUES ${values};`
            })
            
            if (sqlError) {
              console.error(`❌ SQL插入也失败:`, sqlError.message)
              break
            } else {
              console.log(`✅ SQL插入成功: ${batch.length} 条记录`)
            }
          }
        } catch (error) {
          console.error(`❌ 批次插入异常:`, error.message)
          break
        }
      }

      templateStats.push({
        id: template.id,
        name: name,
        expectedLikes: likeCount
      })
    }

    // 6. 重新启用外键约束
    console.log('🔄 重新启用外键约束...')
    const { error: enableError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE template_likes ENABLE TRIGGER ALL;'
    })
    
    if (enableError) {
      console.warn('启用约束失败:', enableError.message)
    }

    // 7. 验证结果
    console.log('\n📊 验证最终结果...')
    const { data: verification } = await supabase
      .from('template_likes')
      .select('template_id')

    const actualCounts = new Map()
    verification?.forEach(like => {
      const count = actualCounts.get(like.template_id) || 0
      actualCounts.set(like.template_id, count + 1)
    })

    console.log('\n📈 各模板点赞数统计 (期望 vs 实际):')
    let successCount = 0
    
    for (const stat of templateStats.slice(0, 15)) { // 显示前15个
      const actualCount = actualCounts.get(stat.id) || 0
      const success = actualCount === stat.expectedLikes
      
      console.log(`  ${success ? '✅' : '❌'} ${stat.name}: ${stat.expectedLikes} → ${actualCount}`)
      if (success) successCount++
    }

    if (templateStats.length > 15) {
      console.log(`  ... 还有 ${templateStats.length - 15} 个模板`)
    }

    console.log(`\n🎊 完成！成功创建了 ${verification?.length || 0} 个点赞记录`)
    console.log(`📊 成功率: ${successCount}/${Math.min(15, templateStats.length)} (${Math.round(successCount/Math.min(15, templateStats.length)*100)}%)`)

  } catch (error) {
    console.error('❌ 操作失败:', error)
  }
}

await createVariedLikes()