import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔧 修复点赞数据同步问题...')

async function fixLikeCounts() {
  try {
    // 1. 获取所有模板
    console.log('\n📊 获取所有模板...')
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('id, slug')

    if (templatesError) {
      throw templatesError
    }

    console.log(`找到 ${templates.length} 个模板`)

    // 2. 为每个模板计算正确的点赞数
    console.log('\n🧮 重新计算每个模板的点赞数...')
    const updates = []

    for (const template of templates) {
      // 获取该模板的点赞数
      const { data: likes, error: likesError } = await supabase
        .from('template_likes')
        .select('id')
        .eq('template_id', template.id)

      if (likesError) {
        console.warn(`⚠️ 获取模板 ${template.slug} 的点赞数失败:`, likesError.message)
        continue
      }

      const likeCount = likes?.length || 0
      updates.push({
        id: template.id,
        slug: template.slug,
        currentLikes: likeCount
      })

      console.log(`📌 ${template.slug}: ${likeCount} 赞`)
    }

    // 3. 批量更新模板的点赞数
    console.log('\n💾 更新模板点赞数...')
    let successCount = 0
    let errorCount = 0

    for (const update of updates) {
      const { error } = await supabase
        .from('templates')
        .update({ like_count: update.currentLikes })
        .eq('id', update.id)

      if (error) {
        console.error(`❌ 更新 ${update.slug} 失败:`, error.message)
        errorCount++
      } else {
        successCount++
        console.log(`✅ ${update.slug}: 更新为 ${update.currentLikes} 赞`)
      }
    }

    console.log(`\n📊 更新完成:`)
    console.log(`✅ 成功: ${successCount} 个模板`)
    console.log(`❌ 失败: ${errorCount} 个模板`)

    // 4. 验证结果
    console.log('\n🔍 验证更新结果...')
    const { data: verifyData } = await supabase
      .from('templates')
      .select('slug, like_count')
      .order('like_count', { ascending: false })
      .limit(10)

    console.log('📊 更新后的点赞排行（Top 10）:')
    verifyData?.forEach((template, i) => {
      console.log(`${i+1}. ${template.slug}: ${template.like_count} 赞`)
    })

  } catch (error) {
    console.error('❌ 修复过程出错:', error)
  }
}

await fixLikeCounts()