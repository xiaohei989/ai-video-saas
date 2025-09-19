/**
 * 详细调试翻译处理流程
 */

import { join } from 'path';
import { TranslationManager } from './manager/TranslationManager';
import { TranslationProcessor } from './engine/TranslationProcessor';

async function debugDetailed() {
  console.log('🔍 详细调试翻译处理流程...\n');

  const manager = new TranslationManager({
    templatesDir: join(process.cwd(), 'src/features/video-creator/data/templates'),
    translationDataDir: join(process.cwd(), 'src/tools/template-translation/data'),
    backupDir: join(process.cwd(), 'src/tools/template-translation/debug-backups'),
    dryRun: true
  });

  try {
    // 1. 加载数据
    const templates = await manager.loadTemplates();
    const translationBatches = await manager.loadTranslationBatches();
    
    console.log(`📂 加载了 ${templates.length} 个模板`);
    console.log(`📂 加载了 ${translationBatches.length} 个翻译批次`);
    
    // 2. 测试合并翻译批次
    console.log('\n🔄 合并翻译批次...');
    const mergedTranslations = TranslationProcessor.mergeTranslationBatches(translationBatches);
    
    console.log(`✅ 合并后包含 ${Object.keys(mergedTranslations).length} 个模板的翻译`);
    console.log('合并后的模板列表:', Object.keys(mergedTranslations).slice(0, 5));
    
    // 3. 查找匹配的模板
    console.log('\n🔍 查找匹配的模板...');
    const templateSlugs = templates.map(t => t.slug);
    const translationSlugs = Object.keys(mergedTranslations);
    
    const matchingSlugs = templateSlugs.filter(slug => translationSlugs.includes(slug));
    const missingSlugs = templateSlugs.filter(slug => !translationSlugs.includes(slug));
    const extraSlugs = translationSlugs.filter(slug => !templateSlugs.includes(slug));
    
    console.log(`✅ 匹配的模板: ${matchingSlugs.length} 个`);
    console.log(`⚠️ 缺失的模板: ${missingSlugs.length} 个`);
    console.log(`❓ 额外的翻译: ${extraSlugs.length} 个`);
    
    if (matchingSlugs.length > 0) {
      console.log('\n📋 匹配的模板示例:');
      matchingSlugs.slice(0, 3).forEach(slug => console.log(`- ${slug}`));
    }
    
    if (missingSlugs.length > 0) {
      console.log('\n📋 缺失的模板示例:');
      missingSlugs.slice(0, 3).forEach(slug => console.log(`- ${slug}`));
    }
    
    // 4. 测试单个模板的翻译应用
    if (matchingSlugs.length > 0) {
      const testSlug = matchingSlugs[0];
      const testTemplate = templates.find(t => t.slug === testSlug);
      const testTranslation = mergedTranslations[testSlug];
      
      console.log(`\n🧪 测试单个模板翻译应用: ${testSlug}`);
      console.log('原始模板名称:', testTemplate?.name);
      console.log('翻译数据:', testTranslation?.name);
      
      if (testTemplate && testTranslation) {
        const result = TranslationProcessor.applyTranslationToTemplate(
          { ...testTemplate }, // 创建副本
          testTranslation
        );
        
        console.log('应用结果:');
        console.log(`- 成功: ${result.success}`);
        console.log(`- 处理字段数: ${result.fieldsProcessed}`);
        console.log(`- 错误数: ${result.errors.length}`);
        console.log(`- 警告数: ${result.warnings.length}`);
        
        if (result.errors.length > 0) {
          console.log('错误:', result.errors);
        }
        if (result.warnings.length > 0) {
          console.log('警告:', result.warnings.slice(0, 3));
        }
      }
    }
    
    // 5. 测试批量处理
    console.log('\n🔄 测试批量处理...');
    const testTemplates = templates.filter(t => matchingSlugs.includes(t.slug)).slice(0, 3);
    const processingResults = TranslationProcessor.batchProcessTranslations(
      testTemplates.map(t => ({ ...t })), // 创建副本
      mergedTranslations
    );
    
    console.log(`批量处理结果: ${processingResults.length} 个模板`);
    processingResults.forEach(result => {
      console.log(`- ${result.templateSlug}: ${result.success ? '✅' : '❌'} (${result.fieldsProcessed} 字段)`);
    });

  } catch (error) {
    console.error('❌ 详细调试失败:', error);
  }
}

debugDetailed();