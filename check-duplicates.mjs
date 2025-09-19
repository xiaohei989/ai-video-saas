/**
 * 检查数据库中的重复模板记录
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🔍 检查数据库中的重复模板...')

async function checkDuplicates() {
  try {
    const { data: templates } = await supabase
      .from('templates')
      .select('id, slug, name, like_count, created_at')
      .order('created_at', { ascending: true })

    console.log(`📊 数据库总模板数: ${templates?.length || 0}`)

    // 查找重复的slug（去掉UUID后缀）
    const slugMap = new Map()
    const duplicates = []

    templates?.forEach(template => {
      // 检查slug是否以8位UUID结尾
      const uuidPattern = /-[0-9a-f]{8}$/
      const baseSlug = template.slug.replace(uuidPattern, '')
      
      if (slugMap.has(baseSlug)) {
        const existing = slugMap.get(baseSlug)
        duplicates.push({
          baseSlug,
          original: existing,
          duplicate: template
        })
      } else {
        slugMap.set(baseSlug, template)
      }
    })

    console.log(`\n🔄 发现 ${duplicates.length} 组重复记录:`)
    duplicates.forEach((dup, i) => {
      console.log(`${i + 1}. ${dup.baseSlug}`)
      console.log(`   原始: ${dup.original.id} - ${dup.original.slug}`)
      console.log(`      点赞: ${dup.original.like_count}, 创建: ${new Date(dup.original.created_at).toLocaleString('zh-CN')}`)
      console.log(`   重复: ${dup.duplicate.id} - ${dup.duplicate.slug}`)
      console.log(`      点赞: ${dup.duplicate.like_count}, 创建: ${new Date(dup.duplicate.created_at).toLocaleString('zh-CN')}`)
      console.log('')
    })

    // 检查哪些模板的slug有UUID后缀
    const templatesWithUUIDSuffix = templates?.filter(template => 
      /-[0-9a-f]{8}$/.test(template.slug)
    ) || []

    console.log(`\n🏷️ 带UUID后缀的模板 (${templatesWithUUIDSuffix.length}个):`)
    templatesWithUUIDSuffix.forEach((template, i) => {
      console.log(`${i + 1}. ${template.slug} (${template.id})`)
      console.log(`   点赞: ${template.like_count}, 创建: ${new Date(template.created_at).toLocaleString('zh-CN')}`)
    })

    return {
      total: templates?.length || 0,
      duplicates: duplicates.length,
      withUUIDSuffix: templatesWithUUIDSuffix.length,
      duplicateRecords: duplicates
    }

  } catch (error) {
    console.error('❌ 检查失败:', error)
    return null
  }
}

const result = await checkDuplicates()
if (result) {
  console.log('\n📋 总结:')
  console.log(`总模板数: ${result.total}`)
  console.log(`重复组数: ${result.duplicates}`)
  console.log(`带UUID后缀: ${result.withUUIDSuffix}`)
  console.log(`预计清理后: ${result.total - result.duplicates}`)
}