#!/usr/bin/env node

/**
 * JSON模板文件到数据库迁移脚本
 * 
 * 使用方法:
 * 1. 预览模式（不实际导入）: node migrate-templates-to-db.js --dry-run
 * 2. 执行导入: node migrate-templates-to-db.js
 * 3. 强制覆盖现有模板: node migrate-templates-to-db.js --overwrite
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Supabase 配置
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 错误: 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量')
  console.log('请设置环境变量:')
  console.log('export VITE_SUPABASE_URL=your_supabase_url')
  console.log('export VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 模板文件目录
const templatesDir = path.join(__dirname, 'src/features/video-creator/data/templates')

// 命令行参数解析
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const shouldOverwrite = args.includes('--overwrite')

console.log('🚀 JSON模板文件到数据库迁移工具')
console.log('======================================')
console.log(`📁 模板目录: ${templatesDir}`)
console.log(`🔍 运行模式: ${isDryRun ? '预览模式（不会修改数据库）' : '执行模式'}`)
console.log(`♻️  覆盖策略: ${shouldOverwrite ? '覆盖现有模板' : '跳过现有模板'}`)
console.log('')

/**
 * 读取所有JSON模板文件
 */
async function loadTemplateFiles() {
  try {
    const files = fs.readdirSync(templatesDir)
    const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('.backup'))
    
    console.log(`📂 发现 ${jsonFiles.length} 个JSON模板文件:`)
    jsonFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`)
    })
    console.log('')
    
    const templates = []
    const errors = []
    
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(templatesDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const template = JSON.parse(content)
        
        // 基础字段验证
        if (!template.id) {
          template.id = path.basename(file, '.json')
        }
        if (!template.slug) {
          template.slug = template.id
        }
        
        // 添加文件信息
        template._sourceFile = file
        template._filePath = filePath
        
        templates.push(template)
      } catch (error) {
        errors.push({ file, error: error.message })
        console.warn(`⚠️  解析文件失败 ${file}: ${error.message}`)
      }
    }
    
    if (errors.length > 0) {
      console.log(`❌ ${errors.length} 个文件解析失败`)
      console.log('')
    }
    
    return { templates, errors }
  } catch (error) {
    console.error('❌ 读取模板目录失败:', error.message)
    process.exit(1)
  }
}

/**
 * 转换模板数据为数据库格式
 */
function convertTemplateToDbFormat(template) {
  // 处理多语言字段
  const processMultilingualField = (field) => {
    if (!field) return null
    if (typeof field === 'string') return field
    return field // 保持JSON格式
  }

  // 处理时间字段
  const processDateField = (dateStr) => {
    if (!dateStr) return null
    try {
      return new Date(dateStr).toISOString()
    } catch (error) {
      return null
    }
  }

  return {
    id: template.id,
    slug: template.slug || template.id,
    name: processMultilingualField(template.name) || template.slug,
    description: processMultilingualField(template.description) || '',
    thumbnail_url: template.thumbnailUrl || template.thumbnail_url || null,
    preview_url: template.previewUrl || template.preview_url || null,
    category: template.category || 'other',
    credit_cost: Number(template.credits || template.credit_cost) || 1,
    tags: Array.isArray(template.tags) ? template.tags : [],
    parameters: template.params || template.parameters || {},
    prompt_template: template.promptTemplate || template.prompt_template || '',
    like_count: 0,
    is_active: true,
    is_public: true,
    version: template.version || '1.0.0',
    audit_status: 'approved', // 现有模板默认审核通过
    // 新增映射字段
    created_at: processDateField(template.createdAt) || new Date().toISOString(),
    updated_at: processDateField(template.lastModified) || new Date().toISOString(),
    // 将icon和其他veo3设置合并存储
    veo3_settings: {
      ...(template.veo3Settings || template.veo3_settings || {}),
      icon: template.icon || null,
      blurThumbnailUrl: template.blurThumbnailUrl || null
    }
  }
}

/**
 * 验证模板数据
 */
function validateTemplate(template, index) {
  const errors = []
  const prefix = `模板 #${index + 1} (${template._sourceFile})`

  // 必需字段检查
  if (!template.id) {
    errors.push(`${prefix}: 缺少ID字段`)
  }
  if (!template.slug) {
    errors.push(`${prefix}: 缺少slug字段`)
  }
  if (!template.name) {
    errors.push(`${prefix}: 缺少name字段`)
  }

  // 积分检查
  const credits = template.credits || template.credit_cost
  if (credits !== undefined && (typeof credits !== 'number' || credits < 0)) {
    errors.push(`${prefix}: credits必须是非负数字`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 获取数据库中已存在的模板
 */
async function getExistingTemplates() {
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('id, slug, version, updated_at')

    if (error) {
      throw new Error(`获取现有模板失败: ${error.message}`)
    }

    const existingMap = new Map()
    data?.forEach(template => {
      existingMap.set(template.id, template)
      existingMap.set(template.slug, template)
    })

    console.log(`💾 数据库中已有 ${data?.length || 0} 个模板`)
    return existingMap
  } catch (error) {
    console.error('❌ 获取现有模板失败:', error.message)
    throw error
  }
}

/**
 * 执行模板导入
 */
async function importTemplates(templates, existingTemplates) {
  const stats = {
    total: templates.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  }

  console.log(`🔄 开始处理 ${templates.length} 个模板...`)
  console.log('')

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i]
    const dbTemplate = convertTemplateToDbFormat(template)
    
    try {
      const existing = existingTemplates.get(template.id) || existingTemplates.get(template.slug)
      
      if (existing && !shouldOverwrite) {
        console.log(`⏭️  跳过现有模板: ${template.slug}`)
        stats.skipped++
        continue
      }

      if (!isDryRun) {
        if (existing && shouldOverwrite) {
          // 更新现有模板
          const { error } = await supabase
            .from('templates')
            .update({
              ...dbTemplate,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)

          if (error) {
            throw new Error(`更新失败: ${error.message}`)
          }

          console.log(`🔄 更新模板: ${template.slug}`)
          stats.updated++
        } else {
          // 创建新模板
          const { error } = await supabase
            .from('templates')
            .insert(dbTemplate)

          if (error) {
            throw new Error(`插入失败: ${error.message}`)
          }

          console.log(`✅ 创建模板: ${template.slug}`)
          stats.created++
        }
      } else {
        // 预览模式
        if (existing && shouldOverwrite) {
          console.log(`🔄 [预览] 将更新模板: ${template.slug}`)
          stats.updated++
        } else if (!existing) {
          console.log(`✅ [预览] 将创建模板: ${template.slug}`)
          stats.created++
        } else {
          console.log(`⏭️  [预览] 将跳过现有模板: ${template.slug}`)
          stats.skipped++
        }
      }

    } catch (error) {
      console.error(`❌ 处理模板失败 ${template.slug}: ${error.message}`)
      stats.failed++
      stats.errors.push(`${template.slug}: ${error.message}`)
    }
  }

  return stats
}

/**
 * 主函数
 */
async function main() {
  const startTime = Date.now()

  try {
    // 1. 加载模板文件
    const { templates, errors: loadErrors } = await loadTemplateFiles()
    
    if (templates.length === 0) {
      console.log('❌ 没有找到有效的模板文件')
      process.exit(1)
    }

    // 2. 验证模板数据
    console.log('🔍 验证模板数据...')
    const validationErrors = []
    const validTemplates = []

    for (let i = 0; i < templates.length; i++) {
      const validation = validateTemplate(templates[i], i)
      if (validation.valid) {
        validTemplates.push(templates[i])
      } else {
        validationErrors.push(...validation.errors)
      }
    }

    if (validationErrors.length > 0) {
      console.log('❌ 模板验证失败:')
      validationErrors.forEach(error => console.log(`   ${error}`))
      console.log('')
      
      if (validTemplates.length === 0) {
        console.log('❌ 没有有效的模板可以导入')
        process.exit(1)
      } else {
        console.log(`⚠️  将跳过 ${validationErrors.length} 个无效模板，继续处理 ${validTemplates.length} 个有效模板`)
        console.log('')
      }
    }

    // 3. 获取现有模板
    const existingTemplates = await getExistingTemplates()
    console.log('')

    // 4. 执行导入
    const stats = await importTemplates(validTemplates, existingTemplates)

    // 5. 显示结果
    const duration = Date.now() - startTime
    console.log('')
    console.log('🎉 迁移完成!')
    console.log('======================================')
    console.log(`⏱️  耗时: ${(duration / 1000).toFixed(2)} 秒`)
    console.log(`📊 处理统计:`)
    console.log(`   总计: ${stats.total}`)
    console.log(`   创建: ${stats.created}`)
    console.log(`   更新: ${stats.updated}`)
    console.log(`   跳过: ${stats.skipped}`)
    console.log(`   失败: ${stats.failed}`)

    if (stats.errors.length > 0) {
      console.log('')
      console.log('❌ 错误详情:')
      stats.errors.forEach(error => console.log(`   ${error}`))
    }

    if (isDryRun) {
      console.log('')
      console.log('💡 这是预览模式，数据库未被修改')
      console.log('   要执行实际导入，请运行: node migrate-templates-to-db.js')
    }

  } catch (error) {
    console.error('')
    console.error('❌ 迁移失败:', error.message)
    process.exit(1)
  }
}

// 运行主函数
main().catch(console.error)