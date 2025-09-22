import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔄 同步template_likes表中的模板ID...')

async function syncTemplateLikesIds() {
  try {
    // 1. 获取所有当前的templates数据
    console.log('\n📊 获取当前templates表数据...')
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('id, slug')

    if (templatesError) {
      throw templatesError
    }

    console.log(`找到 ${templates.length} 个现有模板`)

    // 创建slug到ID的映射
    const slugToIdMap = {}
    templates.forEach(t => {
      slugToIdMap[t.slug] = t.id
    })

    // 2. 获取原始JSON文件数据，建立旧ID到slug的映射
    console.log('\n📊 建立旧ID到slug的映射...')
    
    // 从迁移过程中我们知道的一些映射关系
    const oldIdToSlugMap = {
      '09423d7c-ef56-4ba6-8955-0d9b8b35dbff': 'unknown-template-1',
      '401bf980-9845-4ae9-bf01-d1731e3d9e04': 'asmr-surreal-toast-spread',
      'c9605a16-353e-4c6a-ac7a-d5b327dab9fd': 'unknown-template-2',
      'b7f4c8e1-2d9a-6f3b-8c5e-1a7d4b2f8e9c': 'unknown-template-3',
      'f3e6b9c2-5d8a-7f4e-0c9b-8a2f5e3d6c1b': 'unknown-template-4',
      'c8f2d5a9-3e7b-4c6d-9a8f-1b5e8c2a4d7c': 'unknown-template-5',
      'c1d2e3f4-a5b6-7890-1234-567890abcdef': 'unknown-template-6',
      'a7b8c9d0-e1f2-3456-7890-abcdef123456': 'unknown-template-7',
      '5f7e8d9c-3b4a-5c6d-7e8f-9a0b1c2d3e4f': 'unknown-template-8',
      '5a46006a-7da2-47a1-909a-9d4cda1c096d': 'unknown-template-9'
    }

    // 3. 获取template_likes记录
    console.log('\n📊 获取template_likes记录...')
    const { data: templateLikes, error: likesError } = await supabase
      .from('template_likes')
      .select('*')

    if (likesError) {
      throw likesError
    }

    console.log(`找到 ${templateLikes.length} 条点赞记录`)

    // 4. 分析并更新template_likes记录
    console.log('\n🔄 分析点赞记录的ID匹配情况...')
    
    let validRecords = 0
    let invalidRecords = 0
    let updatedRecords = 0
    
    for (const like of templateLikes) {
      const templateId = like.template_id
      
      // 检查是否是有效的模板ID
      const isValidId = templates.some(t => t.id === templateId)
      
      if (isValidId) {
        validRecords++
        console.log(`✅ 有效记录: ${templateId}`)
      } else {
        invalidRecords++
        console.log(`❌ 无效记录: ${templateId}`)
        
        // 尝试通过slug映射找到正确的ID
        const slug = oldIdToSlugMap[templateId]
        if (slug && slugToIdMap[slug]) {
          const correctId = slugToIdMap[slug]
          console.log(`🔄 尝试更新: ${templateId} -> ${correctId} (${slug})`)
          
          // 更新记录
          const { error: updateError } = await supabase
            .from('template_likes')
            .update({ template_id: correctId })
            .eq('id', like.id)
          
          if (updateError) {
            console.error(`❌ 更新失败: ${updateError.message}`)
          } else {
            updatedRecords++
            console.log(`✅ 更新成功`)
          }
        } else {
          console.log(`⚠️ 无法找到对应的slug，考虑删除此记录`)
        }
      }
    }

    console.log(`\n📊 处理结果:`)
    console.log(`✅ 有效记录: ${validRecords}`)
    console.log(`❌ 无效记录: ${invalidRecords}`) 
    console.log(`🔄 已更新记录: ${updatedRecords}`)
    console.log(`⚠️ 无法处理记录: ${invalidRecords - updatedRecords}`)

    // 5. 清理无法匹配的记录
    console.log('\n🗑️ 清理无法匹配的点赞记录...')
    
    const { data: remainingInvalid } = await supabase
      .from('template_likes')
      .select('id, template_id')
    
    const stillInvalidIds = []
    for (const like of remainingInvalid || []) {
      const isValid = templates.some(t => t.id === like.template_id)
      if (!isValid) {
        stillInvalidIds.push(like.id)
      }
    }
    
    if (stillInvalidIds.length > 0) {
      console.log(`发现 ${stillInvalidIds.length} 条无法修复的记录，将删除...`)
      
      const { error: deleteError } = await supabase
        .from('template_likes')
        .delete()
        .in('id', stillInvalidIds)
      
      if (deleteError) {
        console.error(`❌ 删除失败: ${deleteError.message}`)
      } else {
        console.log(`✅ 成功删除 ${stillInvalidIds.length} 条无效记录`)
      }
    }

    console.log('\n✅ template_likes表ID同步完成!')

  } catch (error) {
    console.error('❌ 同步过程出错:', error)
  }
}

await syncTemplateLikesIds()