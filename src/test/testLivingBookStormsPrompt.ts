/**
 * 测试 living-book-storms 模板的提示词生成
 * 包括字符串格式和JSON格式的输出
 */

import { PromptGenerator } from '../services/promptGenerator';

// 直接导入 living-book-storms 模板
import livingBookStormsTemplate from '../features/video-creator/data/templates/living-book-storms.json';

const livingBookTemplate = livingBookStormsTemplate;

if (!livingBookTemplate) {
  console.error('❌ Living Book Storms 模板未找到');
  process.exit(1);
}

// 测试参数 - 选择维京长船
const testParams = {
  ship_type: 'viking_longship',
  cta_text: 'Create Your Story Now!',
  makePublic: false
};

console.log('🧪 测试 Living Book Storms 模板提示词生成');
console.log('=' .repeat(60));

console.log('\n📋 测试参数:');
console.log(JSON.stringify(testParams, null, 2));

console.log('\n📝 模板信息:');
console.log(`名称: ${livingBookTemplate.name}`);
console.log(`ID: ${livingBookTemplate.id}`);
console.log(`积分: ${livingBookTemplate.credits}`);

// 测试字符串格式输出
console.log('\n🔤 字符串格式提示词:');
console.log('-'.repeat(40));
try {
  const stringPrompt = PromptGenerator.generatePromptForLocal(livingBookTemplate, testParams);
  console.log(stringPrompt);
} catch (error) {
  console.error('❌ 字符串格式生成失败:', error);
}

// 测试JSON格式输出
console.log('\n🎯 JSON格式提示词:');
console.log('-'.repeat(40));
try {
  const jsonPrompt = PromptGenerator.generateJsonPrompt(livingBookTemplate, testParams);
  console.log(JSON.stringify(jsonPrompt, null, 2));
} catch (error) {
  console.error('❌ JSON格式生成失败:', error);
}

// 测试不同船只类型的输出
console.log('\n🚢 测试不同船只类型:');
console.log('-'.repeat(40));

const shipTypes = [
  'viking_longship',
  'pirate_frigate', 
  'spanish_galleon',
  'missile_destroyer'
];

shipTypes.forEach(shipType => {
  console.log(`\n🏴‍☠️ 船只类型: ${shipType}`);
  try {
    const testParamsForShip = { ...testParams, ship_type: shipType };
    const jsonPrompt = PromptGenerator.generateJsonPrompt(livingBookTemplate, testParamsForShip);
    
    // 只显示关键部分，避免输出过长
    if (typeof jsonPrompt === 'object' && jsonPrompt.visual_core) {
      console.log(`   描述: ${jsonPrompt.visual_core.description}`);
      console.log(`   时间轴[0]: ${jsonPrompt.timeline?.[0]?.action?.slice(0, 80)}...`);
      console.log(`   关键词: ${jsonPrompt.keywords?.slice(0, 3).join(', ')}...`);
    } else {
      console.log(`   字符串输出长度: ${String(jsonPrompt).length} 字符`);
    }
  } catch (error) {
    console.error(`   ❌ 生成失败: ${error.message}`);
  }
});

console.log('\n✅ 测试完成!');