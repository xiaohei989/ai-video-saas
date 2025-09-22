import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('📊 构建完整的ID映射关系...')

async function buildIdMapping() {
  try {
    // 1. 读取所有JSON文件，建立旧ID到slug的映射
    console.log('\n📁 读取JSON模板文件...')
    const templatesDir = '/Users/chishengyang/Desktop/AI_ASMR/ai-video-saas/src/features/video-creator/data/templates'
    const jsonFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'))
    
    const oldIdToSlugMap = {}
    
    for (const file of jsonFiles) {
      const filePath = path.join(templatesDir, file)
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      if (content.id && content.slug) {
        oldIdToSlugMap[content.id] = content.slug
        console.log(`${content.id} -> ${content.slug}`)
      }
    }
    
    console.log(`建立了 ${Object.keys(oldIdToSlugMap).length} 个ID映射关系`)

    // 2. 获取当前数据库中的templates数据
    console.log('\n📊 获取数据库中的模板数据...')
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('id, slug')

    if (templatesError) {
      throw templatesError
    }

    const slugToNewIdMap = {}
    templates.forEach(t => {
      slugToNewIdMap[t.slug] = t.id
    })

    console.log(`数据库中有 ${templates.length} 个模板`)

    // 3. 建立旧ID到新ID的映射
    console.log('\n🔄 建立旧ID到新ID的映射...')
    const oldIdToNewIdMap = {}
    
    for (const [oldId, slug] of Object.entries(oldIdToSlugMap)) {
      const newId = slugToNewIdMap[slug]
      if (newId) {
        oldIdToNewIdMap[oldId] = newId
        console.log(`${oldId} -> ${newId} (${slug})`)
      } else {
        console.log(`⚠️ 找不到对应的新ID: ${oldId} (${slug})`)
      }
    }

    console.log(`\n建立了 ${Object.keys(oldIdToNewIdMap).length} 个有效的ID映射`)

    // 4. 更新template_likes表
    console.log('\n🔄 更新template_likes表...')
    
    const { data: templateLikes, error: likesError } = await supabase
      .from('template_likes')
      .select('*')

    if (likesError) {
      throw likesError
    }

    let updatedCount = 0
    let deletedCount = 0
    const toDelete = []

    for (const like of templateLikes) {
      const oldTemplateId = like.template_id
      const newTemplateId = oldIdToNewIdMap[oldTemplateId]

      if (newTemplateId) {
        // 更新为新的模板ID
        const { error: updateError } = await supabase
          .from('template_likes')
          .update({ template_id: newTemplateId })
          .eq('id', like.id)

        if (updateError) {
          console.error(`❌ 更新失败 ${like.id}: ${updateError.message}`)
        } else {
          updatedCount++
          console.log(`✅ 更新: ${oldTemplateId} -> ${newTemplateId}`)
        }
      } else {
        // 检查是否已经是正确的ID
        const isValidId = templates.some(t => t.id === oldTemplateId)
        if (!isValidId) {
          // 标记为删除
          toDelete.push(like.id)
          console.log(`❌ 无效ID，将删除: ${oldTemplateId}`)
        } else {
          console.log(`✅ 已是有效ID: ${oldTemplateId}`)
        }
      }
    }

    // 删除无效记录
    if (toDelete.length > 0) {
      console.log(`\n🗑️ 删除 ${toDelete.length} 条无效记录...`)
      const { error: deleteError } = await supabase
        .from('template_likes')
        .delete()
        .in('id', toDelete)

      if (deleteError) {
        console.error(`❌ 删除失败: ${deleteError.message}`)
      } else {
        deletedCount = toDelete.length
        console.log(`✅ 成功删除 ${deletedCount} 条无效记录`)
      }
    }

    console.log(`\n📊 更新结果:`)
    console.log(`🔄 更新记录: ${updatedCount}`)
    console.log(`🗑️ 删除记录: ${deletedCount}`)
    console.log(`✅ ID同步完成!`)

  } catch (error) {
    console.error('❌ 构建ID映射出错:', error)
  }
}

await buildIdMapping()