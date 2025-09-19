/**
 * 调试翻译应用问题
 */

import { join } from 'path';
import { TranslationManager } from './manager/TranslationManager';

async function debugTranslation() {
  console.log('🔍 调试翻译应用问题...\n');

  const manager = new TranslationManager({
    templatesDir: join(process.cwd(), 'src/features/video-creator/data/templates'),
    translationDataDir: join(process.cwd(), 'src/tools/template-translation/data'),
    backupDir: join(process.cwd(), 'src/tools/template-translation/debug-backups'),
    dryRun: true
  });

  try {
    // 加载数据
    const templates = await manager.loadTemplates();
    const translationBatches = await manager.loadTranslationBatches();
    
    console.log(`📂 加载了 ${templates.length} 个模板`);
    console.log(`📂 加载了 ${translationBatches.length} 个翻译批次`);
    
    // 显示前几个模板的slug
    console.log('\n📋 前5个模板的slug:');
    templates.slice(0, 5).forEach((template, index) => {
      console.log(`${index + 1}. ${template.slug}`);
    });
    
    // 显示翻译批次中的模板
    console.log('\n📋 翻译批次中的模板:');
    translationBatches.forEach((batch, batchIndex) => {
      console.log(`\n批次 ${batchIndex + 1}:`);
      if (batch.templates) {
        Object.keys(batch.templates).slice(0, 3).forEach(slug => {
          console.log(`- ${slug}`);
        });
        console.log(`... 共 ${Object.keys(batch.templates).length} 个模板`);
      }
    });

    // 测试预览
    console.log('\n🧪 测试预览功能...');
    const { preview, report } = await manager.previewTranslations();
    console.log(`预览结果: 处理了 ${preview.length} 个模板`);
    
    if (report) {
      console.log('\n📊 处理报告:');
      if (report.analysis) {
        console.log('分析:', report.analysis.summary);
      }
      if (report.processing) {
        console.log('处理:', report.processing.summary);
      }
    }

    // 检查第一个成功处理的模板
    if (preview.length > 0) {
      const firstTemplate = preview[0];
      console.log(`\n🔍 第一个处理的模板: ${firstTemplate.slug}`);
      console.log('名称:', firstTemplate.name);
      console.log('描述:', firstTemplate.description);
    } else {
      console.log('\n⚠️ 没有模板被成功处理');
    }

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugTranslation();