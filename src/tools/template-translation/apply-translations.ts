/**
 * 直接应用翻译到模板文件
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { TranslationManager } from './manager/TranslationManager';
import { TranslationProcessor } from './engine/TranslationProcessor';

async function applyTranslations() {
  console.log('🚀 开始应用翻译到所有模板...\n');

  const manager = new TranslationManager({
    templatesDir: join(process.cwd(), 'src/features/video-creator/data/templates'),
    translationDataDir: join(process.cwd(), 'src/tools/template-translation/data'),
    backupDir: join(process.cwd(), 'src/tools/template-translation/backups'),
    dryRun: false // 实际修改文件
  });

  try {
    // 1. 加载数据
    console.log('📂 加载模板和翻译数据...');
    const templates = await manager.loadTemplates();
    const translationBatches = await manager.loadTranslationBatches();
    
    console.log(`✅ 加载了 ${templates.length} 个模板`);
    console.log(`✅ 加载了 ${translationBatches.length} 个翻译批次`);
    
    // 2. 合并翻译数据
    console.log('\n🔄 合并翻译数据...');
    const mergedTranslations = TranslationProcessor.mergeTranslationBatches(translationBatches);
    console.log(`✅ 合并后包含 ${Object.keys(mergedTranslations).length} 个模板的翻译`);
    
    // 3. 找到匹配的模板
    const templateSlugs = templates.map(t => t.slug);
    const translationSlugs = Object.keys(mergedTranslations);
    const matchingSlugs = templateSlugs.filter(slug => translationSlugs.includes(slug));
    
    console.log(`\n🎯 找到 ${matchingSlugs.length} 个匹配的模板：`);
    matchingSlugs.forEach(slug => console.log(`  - ${slug}`));
    
    // 4. 处理匹配的模板
    console.log(`\n🔄 开始处理 ${matchingSlugs.length} 个模板...`);
    
    let successCount = 0;
    let totalFieldsProcessed = 0;
    
    for (const slug of matchingSlugs) {
      console.log(`\n📝 处理模板: ${slug}`);
      
      const template = templates.find(t => t.slug === slug);
      const translations = mergedTranslations[slug];
      
      if (!template || !translations) {
        console.log(`  ❌ 跳过：未找到模板或翻译数据`);
        continue;
      }
      
      // 应用翻译
      const result = TranslationProcessor.applyTranslationToTemplate(
        template,
        translations
      );
      
      if (result.success) {
        console.log(`  ✅ 成功处理 ${result.fieldsProcessed} 个字段`);
        
        // 写回文件
        const templatePath = join(
          process.cwd(), 
          'src/features/video-creator/data/templates', 
          `${slug}.json`
        );
        
        await fs.writeFile(templatePath, JSON.stringify(template, null, 2), 'utf-8');
        console.log(`  💾 已保存到文件`);
        
        successCount++;
        totalFieldsProcessed += result.fieldsProcessed;
      } else {
        console.log(`  ❌ 处理失败:`);
        result.errors.forEach(error => console.log(`    - ${error}`));
      }
      
      if (result.warnings.length > 0) {
        console.log(`  ⚠️ 警告:`);
        result.warnings.slice(0, 3).forEach(warning => console.log(`    - ${warning}`));
        if (result.warnings.length > 3) {
          console.log(`    ... 还有 ${result.warnings.length - 3} 个警告`);
        }
      }
    }
    
    // 5. 生成最终报告
    console.log(`\n🎉 翻译应用完成！`);
    console.log(`📊 处理统计:`);
    console.log(`  - 成功处理: ${successCount}/${matchingSlugs.length} 个模板`);
    console.log(`  - 总字段数: ${totalFieldsProcessed} 个`);
    console.log(`  - 成功率: ${((successCount / matchingSlugs.length) * 100).toFixed(1)}%`);
    
    // 6. 检查未处理的模板
    const unprocessedTemplates = templateSlugs.filter(slug => !matchingSlugs.includes(slug));
    if (unprocessedTemplates.length > 0) {
      console.log(`\n📝 未处理的模板 (${unprocessedTemplates.length} 个):`);
      unprocessedTemplates.forEach(slug => console.log(`  - ${slug}`));
      console.log(`\n💡 这些模板需要手动创建翻译数据`);
    }
    
    console.log(`\n✅ 多语言处理完成！所有匹配的模板已更新。`);
    
  } catch (error) {
    console.error('❌ 应用翻译失败:', error);
    process.exit(1);
  }
}

applyTranslations();