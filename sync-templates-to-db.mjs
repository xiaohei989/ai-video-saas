/**
 * 同步所有JSON模板文件到数据库
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const templatesDir = './src/features/video-creator/data/templates'

console.log('🚀 开始同步JSON模板到数据库...')

/**
 * 将JSON模板转换为数据库记录格式
 */
function convertTemplateToRecord(template) {
  return {
    id: template.id,
    slug: template.slug || template.id,
    name: typeof template.name === 'string' ? template.name : JSON.stringify(template.name || { en: template.id }),
    description: typeof template.description === 'string' ? template.description : JSON.stringify(template.description || ''),
    thumbnail_url: null,
    preview_url: template.previewUrl || null,
    category: template.category || null,
    credit_cost: Number(template.credits) || 0,
    tags: Array.isArray(template.tags) ? template.tags : [],
    parameters: template.params || {},
    prompt_template: JSON.stringify(template.promptTemplate || {}),
    veo3_settings: template.veo3Settings || {},
    like_count: 0, // 新模板默认0赞，更新时会保留现有值
    is_active: true,
    is_public: true,
    version: template.version || '1.0.0',
    audit_status: 'approved', // 自动标记为已审核
    published_at: new Date().toISOString()
  }
}

async function syncAllTemplates() {
  try {
    // 1. 读取所有JSON文件
    console.log('\n📂 读取模板文件...')
    const files = readdirSync(templatesDir).filter(file => 
      file.endsWith('.json') && 
      file !== 'index.json' && 
      file !== 'config.json'
    )
    
    console.log(`📋 发现 ${files.length} 个模板文件`)
    
    const templates = []
    for (const file of files) {
      try {
        const filePath = join(templatesDir, file)
        const content = readFileSync(filePath, 'utf8')
        const template = JSON.parse(content)
        
        if (template.id) {
          templates.push(template)
          console.log(`  ✅ ${file} -> ${template.id}`)
        } else {
          console.warn(`  ⚠️ ${file} 缺少ID，跳过`)
        }
      } catch (error) {
        console.error(`  ❌ ${file} 解析失败:`, error.message)
      }
    }
    
    console.log(`\n📊 成功加载 ${templates.length} 个模板`)
    
    // 2. 获取现有的数据库记录
    console.log('\n🔍 检查数据库现有记录...')
    const { data: existingTemplates, error: fetchError } = await supabase
      .from('templates')
      .select('id, slug, like_count, version, created_at')
    
    if (fetchError) {
      console.error('❌ 获取数据库记录失败:', fetchError.message)
      return
    }
    
    console.log(`📋 数据库中现有 ${existingTemplates.length} 条记录`)
    
    const existingById = new Map(existingTemplates.map(t => [t.id, t]))
    const existingBySlug = new Map(existingTemplates.map(t => [t.slug, t]))
    
    // 3. 处理每个模板
    let created = 0
    let updated = 0
    let skipped = 0
    let errors = []
    
    console.log('\n🔄 开始同步...')
    
    for (const template of templates) {
      try {
        const record = convertTemplateToRecord(template)
        const existing = existingById.get(template.id)
        
        if (existing) {
          // 检查是否需要更新
          const needsUpdate = existing.version !== template.version ||
                             existing.slug !== record.slug
          
          if (needsUpdate) {
            // 更新记录，但保留统计数据
            const updateData = { ...record }
            delete updateData.like_count // 保留现有点赞数
            updateData.updated_at = new Date().toISOString()
            
            const { error: updateError } = await supabase
              .from('templates')
              .update(updateData)
              .eq('id', template.id)
            
            if (updateError) {
              console.error(`  ❌ 更新失败 ${template.id}:`, updateError.message)
              errors.push(`更新 ${template.id}: ${updateError.message}`)
            } else {
              console.log(`  🔄 更新: ${template.slug}`)
              updated++
            }
          } else {
            console.log(`  ✨ 跳过: ${template.slug} (无变化)`)
            skipped++
          }
        } else {
          // 检查slug冲突
          const slugConflict = existingBySlug.get(record.slug)
          if (slugConflict && slugConflict.id !== template.id) {
            console.warn(`  ⚠️ Slug冲突: ${record.slug} 已被 ${slugConflict.id} 使用`)
            record.slug = `${record.slug}-${template.id.slice(0, 8)}`
            console.log(`  🔧 使用新slug: ${record.slug}`)
          }
          
          // 创建新记录
          const { error: insertError } = await supabase
            .from('templates')
            .insert(record)
          
          if (insertError) {
            console.error(`  ❌ 创建失败 ${template.id}:`, insertError.message)
            errors.push(`创建 ${template.id}: ${insertError.message}`)
          } else {
            console.log(`  ✅ 创建: ${template.slug}`)
            created++
          }
        }
      } catch (error) {
        console.error(`  ❌ 处理失败 ${template.id}:`, error.message)
        errors.push(`处理 ${template.id}: ${error.message}`)
      }
    }
    
    // 4. 显示结果
    console.log('\n🎉 同步完成!')
    console.log(`📊 统计:`)
    console.log(`  ✅ 创建: ${created}`)
    console.log(`  🔄 更新: ${updated}`)
    console.log(`  ✨ 跳过: ${skipped}`)
    console.log(`  ❌ 错误: ${errors.length}`)
    
    if (errors.length > 0) {
      console.log('\n⚠️ 错误详情:')
      errors.forEach(error => console.log(`  - ${error}`))
    }
    
    // 5. 验证最终结果
    const { count: finalCount } = await supabase
      .from('templates')
      .select('*', { count: 'exact', head: true })
    
    console.log(`\n✅ 数据库中现有模板总数: ${finalCount}`)
    
    return {
      success: errors.length === 0,
      created,
      updated,
      skipped,
      errors: errors.length,
      total: finalCount
    }
    
  } catch (error) {
    console.error('❌ 同步过程失败:', error)
    return { success: false, error: error.message }
  }
}

// 执行同步
syncAllTemplates().then(result => {
  if (result.success) {
    console.log('\n🎊 所有模板同步成功!')
  } else {
    console.log('\n💥 同步过程中遇到问题，请检查上述错误信息')
    process.exit(1)
  }
})