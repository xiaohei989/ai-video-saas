#!/usr/bin/env node

/**
 * 模板同步命令行工具
 * 用于手动同步模板到数据库
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 从环境变量读取配置
require('dotenv').config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少Supabase配置，请检查环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 读取所有JSON模板
function loadTemplates() {
  const templatesDir = path.join(__dirname, '../src/features/video-creator/data/templates')
  const files = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'))
  
  const templates = []
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(templatesDir, file), 'utf8')
      const template = JSON.parse(content)
      templates.push(template)
    } catch (error) {
      console.error(`❌ 读取模板文件 ${file} 失败:`, error.message)
    }
  }
  
  return templates
}

// 获取模板版本
function getTemplateVersion(template) {
  return template.version || template.lastModified || '1.0.0'
}

// 检查同步状态
async function checkSync() {
  try {
    console.log('🔍 检查同步状态...\n')
    
    const templates = loadTemplates()
    const { data: dbTemplates } = await supabase
      .from('templates')
      .select('slug, version')

    const dbMap = new Map()
    dbTemplates?.forEach(t => {
      dbMap.set(t.slug, t.version || '1.0.0')
    })

    const missing = []
    const outdated = []
    const upToDate = []

    for (const template of templates) {
      const dbVersion = dbMap.get(template.id)
      const frontendVersion = getTemplateVersion(template)

      if (!dbVersion) {
        missing.push(template.id)
      } else if (dbVersion !== frontendVersion) {
        outdated.push({ id: template.id, dbVersion, frontendVersion })
      } else {
        upToDate.push(template.id)
      }
    }

    // 显示统计信息
    console.log(`📊 同步状态统计:`)
    console.log(`  - 前端模板总数: ${templates.length}`)
    console.log(`  - 数据库模板总数: ${dbTemplates?.length || 0}`)
    console.log(`  - 需要新增: ${missing.length}`)
    console.log(`  - 需要更新: ${outdated.length}`)
    console.log(`  - 已同步: ${upToDate.length}\n`)

    if (missing.length > 0) {
      console.log('📝 需要新增的模板:')
      missing.forEach(id => console.log(`  - ${id}`))
      console.log()
    }

    if (outdated.length > 0) {
      console.log('🔄 需要更新的模板:')
      outdated.forEach(({ id, dbVersion, frontendVersion }) => 
        console.log(`  - ${id}: ${dbVersion} → ${frontendVersion}`)
      )
      console.log()
    }

    return { missing, outdated, upToDate, totalNeeded: missing.length + outdated.length }
  } catch (error) {
    console.error('❌ 检查失败:', error.message)
    return null
  }
}

// 执行同步
async function sync(options = {}) {
  const { forceUpdate = false, dryRun = false } = options
  
  try {
    console.log(`🚀 开始同步模板${dryRun ? ' (模拟运行)' : ''}...\n`)
    
    const templates = loadTemplates()
    const { data: existingTemplates } = await supabase
      .from('templates')
      .select('id, slug, like_count, comment_count, view_count, version, updated_at')

    const existingMap = new Map()
    existingTemplates?.forEach(t => {
      existingMap.set(t.slug, t)
    })

    let synced = 0
    let updated = 0
    const errors = []
    const newTemplates = []
    const updatedTemplates = []

    for (const template of templates) {
      try {
        const existingTemplate = existingMap.get(template.id)
        const currentVersion = getTemplateVersion(template)

        if (!existingTemplate) {
          // 新模板
          console.log(`📝 新增模板: ${template.id}`)
          newTemplates.push(template.id)
          
          if (!dryRun) {
            const { error: insertError } = await supabase
              .from('templates')
              .insert({
                name: template.name,
                slug: template.id,
                description: template.description,
                prompt_template: template.promptTemplate || template.prompt_template || '',
                parameters: template.parameters || template.params || {},
                category: template.category,
                credit_cost: template.credits || 1,
                is_public: true,
                is_active: true,
                like_count: template.likes || 0,
                comment_count: 0,
                share_count: 0,
                view_count: 0,
                favorite_count: 0,
                usage_count: 0,
                tags: template.tags || [],
                version: currentVersion,
                thumbnail_url: template.thumbnailUrl,
                preview_url: template.previewUrl
              })

            if (insertError) {
              errors.push(`${template.id}: ${insertError.message}`)
              continue
            }
          }
          
          synced++
        } else {
          // 现有模板
          const needsUpdate = forceUpdate || existingTemplate.version !== currentVersion

          if (needsUpdate) {
            console.log(`🔄 更新模板: ${template.id}`)
            updatedTemplates.push(template.id)
            
            if (!dryRun) {
              const { error: updateError } = await supabase
                .from('templates')
                .update({
                  name: template.name,
                  description: template.description,
                  prompt_template: template.promptTemplate || template.prompt_template || '',
                  parameters: template.parameters || template.params || {},
                  category: template.category,
                  credit_cost: template.credits || 1,
                  tags: template.tags || [],
                  version: currentVersion,
                  thumbnail_url: template.thumbnailUrl,
                  preview_url: template.previewUrl,
                  updated_at: new Date().toISOString()
                })
                .eq('slug', template.id)

              if (updateError) {
                errors.push(`${template.id}: ${updateError.message}`)
                continue
              }
            }
            
            updated++
          } else {
            console.log(`⏭️  跳过模板: ${template.id} (无变化)`)
          }
        }
      } catch (error) {
        errors.push(`${template.id}: ${error.message}`)
        console.error(`❌ 处理模板 ${template.id} 时出错:`, error.message)
      }
    }

    // 显示结果
    console.log(`\n✅ 同步完成${dryRun ? ' (模拟)' : ''}:`)
    console.log(`  - 新增: ${synced}`)
    console.log(`  - 更新: ${updated}`)
    console.log(`  - 错误: ${errors.length}`)

    if (newTemplates.length > 0) {
      console.log(`\n📝 新增的模板:`)
      newTemplates.forEach(id => console.log(`  - ${id}`))
    }

    if (updatedTemplates.length > 0) {
      console.log(`\n🔄 更新的模板:`)
      updatedTemplates.forEach(id => console.log(`  - ${id}`))
    }

    if (errors.length > 0) {
      console.log(`\n❌ 错误详情:`)
      errors.forEach(error => console.log(`  - ${error}`))
    }

    return { success: errors.length === 0, synced, updated, errors }
  } catch (error) {
    console.error('❌ 同步失败:', error.message)
    return { success: false, synced: 0, updated: 0, errors: [error.message] }
  }
}

// 命令行接口
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'check'
  
  switch (command) {
    case 'check':
      await checkSync()
      break
      
    case 'sync':
      const forceUpdate = args.includes('--force')
      const dryRun = args.includes('--dry-run')
      await sync({ forceUpdate, dryRun })
      break
      
    case 'help':
    default:
      console.log(`
模板同步工具使用说明:

命令:
  check           检查模板同步状态
  sync            同步模板到数据库
  help            显示帮助信息

选项:
  --force         强制更新所有模板（忽略版本检查）
  --dry-run       模拟运行，不实际修改数据库

示例:
  node scripts/sync-templates.js check
  node scripts/sync-templates.js sync
  node scripts/sync-templates.js sync --dry-run
  node scripts/sync-templates.js sync --force
      `)
      break
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ 执行失败:', error)
    process.exit(1)
  })
}

module.exports = { checkSync, sync, loadTemplates }