#!/usr/bin/env node

/**
 * 同步前端模板JSON文件中的 previewUrl 和 thumbnailUrl 到数据库
 *
 * 运行: node scripts/sync-template-urls.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 模板文件目录
const TEMPLATES_DIR = path.join(__dirname, '../src/features/video-creator/data/templates');

/**
 * 读取所有模板 JSON 文件
 */
function loadTemplates() {
  const templates = [];
  const files = fs.readdirSync(TEMPLATES_DIR);

  for (const file of files) {
    if (!file.endsWith('.json') || file === 'index.json' || file === 'config.json') {
      continue;
    }

    const filePath = path.join(TEMPLATES_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const template = JSON.parse(content);

      if (template.id && template.slug) {
        templates.push({
          id: template.id,
          slug: template.slug,
          previewUrl: template.previewUrl,
          thumbnailUrl: template.thumbnailUrl,
          blurThumbnailUrl: template.blurThumbnailUrl
        });
      }
    } catch (err) {
      console.error(`❌ 读取模板文件失败: ${file}`, err.message);
    }
  }

  return templates;
}

/**
 * 同步单个模板的 URL
 */
async function syncTemplateUrl(template) {
  const { id, slug, previewUrl, thumbnailUrl, blurThumbnailUrl } = template;

  try {
    // 更新数据库
    const { data, error } = await supabase
      .from('templates')
      .update({
        preview_url: previewUrl || null,
        thumbnail_url: thumbnailUrl || null,
        blur_thumbnail_url: blurThumbnailUrl || null,
        updated_at: new Date().toISOString()
      })
      .eq('slug', slug)
      .select('id, slug, preview_url, thumbnail_url');

    if (error) {
      console.error(`❌ 更新失败 [${slug}]:`, error.message);
      return { success: false, slug, error: error.message };
    }

    if (!data || data.length === 0) {
      console.warn(`⚠️  模板不存在 [${slug}] - 跳过`);
      return { success: false, slug, error: '模板不存在' };
    }

    console.log(`✅ 同步成功 [${slug}]`, {
      preview_url: previewUrl ? '✓' : '✗',
      thumbnail_url: thumbnailUrl ? '✓' : '✗',
      blur_thumbnail_url: blurThumbnailUrl ? '✓' : '✗'
    });

    return { success: true, slug, data: data[0] };
  } catch (err) {
    console.error(`❌ 同步异常 [${slug}]:`, err.message);
    return { success: false, slug, error: err.message };
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始同步模板 URL 到数据库...\n');

  // 1. 加载所有模板
  const templates = loadTemplates();
  console.log(`📦 找到 ${templates.length} 个模板文件\n`);

  if (templates.length === 0) {
    console.log('❌ 没有找到任何模板文件');
    return;
  }

  // 2. 同步每个模板
  const results = [];
  for (const template of templates) {
    const result = await syncTemplateUrl(template);
    results.push(result);
  }

  // 3. 统计结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 同步结果统计:');
  console.log('='.repeat(60));

  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ 成功: ${success} 个`);
  console.log(`❌ 失败: ${failed} 个`);

  if (failed > 0) {
    console.log('\n失败的模板:');
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`  - ${r.slug}: ${r.error}`));
  }

  // 4. 验证 glass-cutting-asmr 模板
  console.log('\n' + '='.repeat(60));
  console.log('🔍 验证 glass-cutting-asmr 模板:');
  console.log('='.repeat(60));

  const { data: glassTemplate, error } = await supabase
    .from('templates')
    .select('id, slug, name, preview_url, thumbnail_url, blur_thumbnail_url')
    .eq('slug', 'glass-cutting-asmr')
    .single();

  if (error) {
    console.error('❌ 查询失败:', error.message);
  } else if (glassTemplate) {
    console.log('模板信息:');
    console.log(`  - Slug: ${glassTemplate.slug}`);
    console.log(`  - Preview URL: ${glassTemplate.preview_url ? '✓ ' + glassTemplate.preview_url : '✗ 无'}`);
    console.log(`  - Thumbnail URL: ${glassTemplate.thumbnail_url ? '✓ ' + glassTemplate.thumbnail_url : '✗ 无'}`);
    console.log(`  - Blur Thumbnail URL: ${glassTemplate.blur_thumbnail_url ? '✓ ' + glassTemplate.blur_thumbnail_url : '✗ 无'}`);
  } else {
    console.log('❌ 模板不存在');
  }

  console.log('\n✨ 同步完成!');
}

// 运行主函数
main().catch(err => {
  console.error('💥 脚本执行失败:', err);
  process.exit(1);
});
