import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 调试前端点赞数据显示问题...')

async function debugFrontendLikeData() {
  try {
    console.log('\n1️⃣ 模拟API服务获取模板数据...')
    
    // 模拟templatesApiService.getTemplateList()
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
      .range(0, 11) // 获取前12个模板

    const { data: templates, error: templatesError, count } = await query

    if (templatesError) {
      throw templatesError
    }

    console.log(`✅ 获取到 ${templates.length} 个模板`)

    // 模拟addLikeCountsToTemplates()
    console.log('\n2️⃣ 为模板添加点赞数...')
    
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

      console.log('\n📊 API返回的模板点赞数据:')
      templatesWithLikes.forEach((template, i) => {
        const name = typeof template.name === 'object' ? 
          template.name?.zh || template.name?.en || 'Unknown' : template.name
        console.log(`${i+1}. ${name}: ${template.like_count} 赞 (ID: ${template.id})`)
      })

      // 检查具体的有点赞模板
      const likedTemplates = templatesWithLikes.filter(t => t.like_count > 0)
      console.log(`\n✅ 有点赞的模板: ${likedTemplates.length} 个`)
      
      if (likedTemplates.length > 0) {
        console.log('\n🎯 有点赞的模板详情:')
        likedTemplates.forEach(template => {
          const name = typeof template.name === 'object' ? 
            template.name?.zh || template.name?.en || 'Unknown' : template.name
          console.log(`  - ${name}: ${template.like_count} 赞`)
          console.log(`    ID: ${template.id}`)
          console.log(`    Slug: ${template.slug}`)
        })
      }

      console.log('\n3️⃣ 模拟前端数据转换...')
      
      // 模拟convertDatabaseTemplateToComponentFormat()
      const convertedTemplates = templatesWithLikes.map(template => ({
        id: template.id,
        slug: template.slug,
        name: typeof template.name === 'object' ? 
          template.name?.zh || template.name?.en || 'Unknown' : template.name,
        description: typeof template.description === 'object' ? 
          template.description?.zh || template.description?.en || '' : template.description,
        thumbnailUrl: template.thumbnail_url,
        previewUrl: template.preview_url,
        category: template.category,
        credits: template.credit_cost,
        tags: template.tags,
        likeCount: template.like_count, // 关键：这里应该有正确的点赞数
        isActive: template.is_active,
        isPublic: template.is_public,
        version: template.version,
        auditStatus: template.audit_status
      }))

      console.log('\n📋 转换后的模板数据 (前端格式):')
      convertedTemplates.forEach((template, i) => {
        console.log(`${i+1}. ${template.name}: ${template.likeCount} 赞`)
      })

      // 重点检查：有点赞的模板
      const frontendLikedTemplates = convertedTemplates.filter(t => t.likeCount > 0)
      console.log(`\n🎯 转换后有点赞的模板: ${frontendLikedTemplates.length} 个`)
      
      if (frontendLikedTemplates.length > 0) {
        console.log('\n📌 这些模板应该在前端显示点赞数:')
        frontendLikedTemplates.forEach(template => {
          console.log(`  - ${template.name}: ${template.likeCount} 赞 (ID: ${template.id})`)
        })
      }

      console.log('\n4️⃣ 检查前端显示逻辑...')
      console.log('在TemplateCard组件中:')
      console.log('1. getLikeStatus?.(template.id) 应该返回缓存中的数据')
      console.log('2. 如果缓存为空，likeCount 会是 0，isLiked 会是 false')
      console.log('3. 然后传递给 LikeCounterButton: initialLikeCount={likeCount}')
      console.log('')
      console.log('🚨 **问题可能在这里**:')
      console.log('   - API返回正确的点赞数 (template.like_count)')
      console.log('   - 但前端显示依赖缓存数据 (getLikeStatus)')
      console.log('   - 如果缓存未及时更新，就会显示0')
      
    }

  } catch (error) {
    console.error('❌ 调试失败:', error)
  }
}

await debugFrontendLikeData()