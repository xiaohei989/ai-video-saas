import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 测试新的点赞API...')

async function testTemplateListApi() {
  try {
    console.log('\n📊 测试模板列表API...')
    
    // 模拟API调用
    const params = {
      page: 1,
      pageSize: 10,
      sort: 'popular'
    }

    // 获取模板基础数据
    let query = supabase
      .from('templates')
      .select(`
        id,
        slug,
        name,
        description,
        thumbnail_url,
        preview_url,
        category,
        credit_cost,
        tags,
        is_active,
        is_public,
        version,
        created_at,
        updated_at,
        audit_status
      `, { count: 'exact' })
      .eq('audit_status', 'approved')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(0, 9)

    const { data: templates, error: templatesError, count } = await query

    if (templatesError) {
      throw templatesError
    }

    console.log(`获取到 ${templates.length} 个模板`)

    // 获取每个模板的点赞数
    if (templates.length > 0) {
      const templateIds = templates.map(t => t.id)
      
      const { data: likeCounts, error: likesError } = await supabase
        .from('template_likes')
        .select('template_id')
        .in('template_id', templateIds)

      if (likesError) {
        console.warn('获取点赞数失败:', likesError)
      }

      // 统计每个模板的点赞数
      const likeCountMap = new Map()
      likeCounts?.forEach(like => {
        const currentCount = likeCountMap.get(like.template_id) || 0
        likeCountMap.set(like.template_id, currentCount + 1)
      })

      // 为每个模板添加点赞数
      const templatesWithLikes = templates.map(template => ({
        ...template,
        like_count: likeCountMap.get(template.id) || 0
      }))

      // 如果是popular排序，进行排序
      const finalData = templatesWithLikes.sort((a, b) => b.like_count - a.like_count)

      console.log('\n📊 模板点赞排行:')
      finalData.forEach((template, i) => {
        const name = typeof template.name === 'object' ? 
          template.name?.zh || template.name?.en || 'Unknown' : template.name
        console.log(`${i+1}. ${name}: ${template.like_count} 赞 (${template.slug})`)
      })

      console.log(`\n总计: ${count} 个模板，显示前 ${finalData.length} 个`)
      
      // 验证有点赞的模板数量
      const likedTemplates = finalData.filter(t => t.like_count > 0)
      console.log(`✅ 有点赞的模板: ${likedTemplates.length} 个`)
      console.log(`❌ 没有点赞的模板: ${finalData.length - likedTemplates.length} 个`)
    }

  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

await testTemplateListApi()