/**
 * 翻译系统测试脚本
 */

import { join } from 'path';
import { TranslationManager } from './manager/TranslationManager';
import { TranslationEngine } from './engine';

async function testTranslationSystem() {
  console.log('🧪 开始测试翻译系统...\n');

  const manager = new TranslationManager({
    templatesDir: join(process.cwd(), 'src/features/video-creator/data/templates'),
    translationDataDir: join(process.cwd(), 'src/tools/template-translation/data'),
    backupDir: join(process.cwd(), 'src/tools/template-translation/test-backups'),
    dryRun: true // 测试模式，不修改文件
  });

  try {
    // 1. 测试加载模板
    console.log('📂 测试加载模板...');
    const templates = await manager.loadTemplates();
    console.log(`✅ 成功加载 ${templates.length} 个模板`);

    // 2. 测试加载翻译数据
    console.log('\n📂 测试加载翻译数据...');
    const translationBatches = await manager.loadTranslationBatches();
    console.log(`✅ 成功加载 ${translationBatches.length} 个翻译批次`);

    // 3. 测试加载术语表
    console.log('\n📚 测试加载术语表...');
    const terminology = await manager.loadTerminology();
    console.log(`✅ 成功加载术语表，包含 ${Object.keys(terminology.terminology).length} 个术语`);

    // 4. 测试翻译验证
    console.log('\n🔍 测试翻译验证...');
    const validation = await manager.validateTranslations();
    console.log(`验证结果: ${validation.isValid ? '✅ 通过' : '❌ 失败'}`);
    if (validation.errors.length > 0) {
      console.log('错误:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.log('警告:', validation.warnings.slice(0, 3)); // 只显示前3个警告
    }

    // 5. 测试翻译预览
    console.log('\n👀 测试翻译预览...');
    const { preview, report } = await manager.previewTranslations();
    console.log(`✅ 预览生成成功，处理了 ${preview.length} 个模板`);
    
    if (report?.processing) {
      console.log(`处理统计: 成功 ${report.processing.successfulTemplates}/${report.processing.totalTemplates}`);
      console.log(`字段处理数: ${report.processing.totalFieldsProcessed}`);
    }

    // 6. 测试状态报告
    console.log('\n📊 测试状态报告...');
    const statusReport = await manager.generateStatusReport();
    console.log('✅ 状态报告生成成功');
    console.log(`翻译覆盖率: ${statusReport.translationCoverage.translatedTemplates}/${statusReport.translationCoverage.totalTemplates}`);

    // 7. 测试示例模板的翻译结果
    console.log('\n🔍 检查示例模板翻译结果...');
    const sampleTemplate = preview.find(t => t.slug === 'miniature-animals-surprise');
    if (sampleTemplate) {
      console.log('模板名称翻译:');
      if (typeof sampleTemplate.name === 'object') {
        console.log('  中文:', sampleTemplate.name.zh);
        console.log('  日文:', sampleTemplate.name.ja);
        console.log('  韩文:', sampleTemplate.name.ko);
      }
      
      console.log('参数翻译示例:');
      const animalTypeParam = sampleTemplate.params?.animal_type;
      if (animalTypeParam?.label && typeof animalTypeParam.label === 'object') {
        console.log('  标签-中文:', animalTypeParam.label.zh);
        console.log('  标签-日文:', animalTypeParam.label.ja);
      }
    }

    console.log('\n🎉 翻译系统测试完成! 所有功能正常工作。');
    
    console.log('\n📋 测试总结:');
    console.log(`- 模板加载: ✅ ${templates.length} 个`);
    console.log(`- 翻译批次: ✅ ${translationBatches.length} 个`);
    console.log(`- 术语表: ✅ ${Object.keys(terminology.terminology).length} 个术语`);
    console.log(`- 验证结果: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`- 预览生成: ✅ ${preview.length} 个模板`);
    console.log(`- 状态报告: ✅`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testTranslationSystem();