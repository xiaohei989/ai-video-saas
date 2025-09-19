/**
 * 清理数据库中的重复模板记录
 * 删除带UUID后缀的重复记录，保留原始记录
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🧹 开始清理重复的模板记录...')

async function cleanupDuplicates() {
  try {
    // 1. 获取所有模板
    const { data: templates } = await supabase
      .from('templates')
      .select('id, slug, name, like_count, created_at')
      .order('created_at', { ascending: true })

    console.log(`📊 清理前模板总数: ${templates?.length || 0}`)

    // 2. 查找重复的slug（去掉UUID后缀）
    const slugMap = new Map()
    const duplicatesToDelete = []

    templates?.forEach(template => {
      // 检查slug是否以8位UUID结尾
      const uuidPattern = /-[0-9a-f]{8}$/
      const hasUUIDSuffix = uuidPattern.test(template.slug)
      const baseSlug = template.slug.replace(uuidPattern, '')
      
      if (slugMap.has(baseSlug)) {
        const existing = slugMap.get(baseSlug)
        
        // 如果当前模板有UUID后缀，则标记为删除
        if (hasUUIDSuffix) {
          duplicatesToDelete.push({
            id: template.id,
            slug: template.slug,
            reason: '带UUID后缀的重复记录'
          })
        } else {
          // 如果现有模板有UUID后缀，替换映射并标记现有的为删除
          if (/-[0-9a-f]{8}$/.test(existing.slug)) {
            duplicatesToDelete.push({
              id: existing.id,
              slug: existing.slug,
              reason: '被原始记录替换'
            })
            slugMap.set(baseSlug, template)
          } else {
            // 两个都没有UUID后缀，保留较早创建的
            if (new Date(template.created_at) > new Date(existing.created_at)) {
              duplicatesToDelete.push({
                id: template.id,
                slug: template.slug,
                reason: '较晚创建的重复记录'
              })
            } else {
              duplicatesToDelete.push({
                id: existing.id,
                slug: existing.slug,
                reason: '较晚创建的重复记录'
              })
              slugMap.set(baseSlug, template)
            }
          }
        }
      } else {
        slugMap.set(baseSlug, template)
      }
    })

    console.log(`\n🗑️ 准备删除 ${duplicatesToDelete.length} 个重复记录:`)
    duplicatesToDelete.forEach((item, i) => {
      console.log(`${i + 1}. ${item.slug} (${item.id}) - ${item.reason}`)
    })

    if (duplicatesToDelete.length === 0) {
      console.log('✨ 没有发现重复记录，无需清理')
      return
    }

    // 3. 确认删除
    console.log('\n⚠️ 即将删除上述重复记录...')
    
    // 4. 执行删除
    let deletedCount = 0
    let errorCount = 0

    for (const item of duplicatesToDelete) {
      try {
        const { error } = await supabase
          .from('templates')
          .delete()
          .eq('id', item.id)

        if (error) {
          console.error(`❌ 删除失败 ${item.slug}:`, error.message)
          errorCount++
        } else {
          console.log(`✅ 已删除: ${item.slug}`)
          deletedCount++
        }
      } catch (error) {
        console.error(`❌ 删除异常 ${item.slug}:`, error.message)
        errorCount++
      }
    }

    // 5. 验证结果
    const { count: finalCount } = await supabase
      .from('templates')
      .select('*', { count: 'exact', head: true })

    console.log('\n🎉 清理完成!')
    console.log(`📊 统计:`)
    console.log(`  ✅ 成功删除: ${deletedCount}`)
    console.log(`  ❌ 删除失败: ${errorCount}`)
    console.log(`  📋 清理后总数: ${finalCount}`)
    console.log(`  🎯 预期结果: 33个模板 (31个JSON + 2个数据库专有)`)

    return {
      deleted: deletedCount,
      errors: errorCount,
      finalCount
    }

  } catch (error) {
    console.error('❌ 清理过程失败:', error)
    return null
  }
}

const result = await cleanupDuplicates()
if (result) {
  if (result.errors === 0) {
    console.log('\n🎊 所有重复记录清理成功!')
  } else {
    console.log('\n⚠️ 清理过程中遇到错误，请检查日志')
  }
}