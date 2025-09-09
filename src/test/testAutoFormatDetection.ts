/**
 * 测试自动格式检测：
 * - JSON格式模板 → 输出JSON
 * - 文本格式模板 → 输出文本
 */

import { PromptGenerator } from '../services/promptGenerator';
import livingBookStormsTemplate from '../features/video-creator/data/templates/living-book-storms.json';
import magicPenTemplate from '../features/video-creator/data/templates/magic-pen-3d-bloom.json';

console.log('🤖 自动格式检测测试');
console.log('=' .repeat(60));

// 测试参数
const testParams1 = {
  ship_type: 'viking_longship',
  cta_text: 'veo3video.me',
  makePublic: false
};

const testParams2 = {
  pen_type: 'transparent pen containing colored particles',
  base_sketch: 'cracked earth',
  creation_type: 'colorful flowers with petals unfolding and stamens popping out',
  color_palette: 'red, yellow, pink, and blue',
  sound_effect: 'flowers blooming'
};

console.log('\n📖 测试1: Living Book Storms (JSON格式模板)');
console.log('-'.repeat(50));
console.log(`模板promptTemplate类型: ${typeof livingBookStormsTemplate.promptTemplate}`);

const result1 = PromptGenerator.generateJsonPrompt(livingBookStormsTemplate, testParams1);
console.log(`输出结果类型: ${typeof result1}`);

if (typeof result1 === 'object') {
  console.log('✅ JSON格式模板正确输出为JSON对象');
  console.log(`- 包含字段: ${Object.keys(result1).join(', ')}`);
  console.log(`- model: ${result1.model}`);
  console.log(`- duration: ${result1.duration}`);
  console.log(`- visual_core.description: ${result1.visual_core?.description?.slice(0, 60)}...`);
} else {
  console.log('❌ JSON格式模板错误地输出为字符串');
  console.log(`输出长度: ${result1.length} 字符`);
}

console.log('\n✨ 测试2: Magic Pen 3D Bloom (文本格式模板)');
console.log('-'.repeat(50));
console.log(`模板promptTemplate类型: ${typeof magicPenTemplate.promptTemplate}`);

const result2 = PromptGenerator.generateJsonPrompt(magicPenTemplate, testParams2);
console.log(`输出结果类型: ${typeof result2}`);

if (typeof result2 === 'string') {
  console.log('✅ 文本格式模板正确输出为字符串');
  console.log(`输出长度: ${result2.length} 字符`);
  console.log(`开头: ${result2.slice(0, 80)}...`);
} else {
  console.log('❌ 文本格式模板错误地输出为对象');
  console.log(`对象字段: ${Object.keys(result2)}`);
}

// 验证参数替换是否正确
console.log('\n🔍 参数替换验证');
console.log('-'.repeat(30));

// 检查JSON输出中的参数替换
if (typeof result1 === 'object' && result1.visual_core) {
  const hasShipDescription = result1.visual_core.description.includes('Viking longship');
  console.log(`JSON格式参数替换: ${hasShipDescription ? '✅' : '❌'} ship_description`);
}

// 检查字符串输出中的参数替换
if (typeof result2 === 'string') {
  const hasPenType = result2.includes('transparent pen containing colored particles');
  const hasCreationType = result2.includes('colorful flowers with petals unfolding');
  console.log(`文本格式参数替换: ${hasPenType ? '✅' : '❌'} pen_type`);
  console.log(`文本格式参数替换: ${hasCreationType ? '✅' : '❌'} creation_type`);
}

console.log('\n📊 总结');
console.log('-'.repeat(20));
console.log(`Living Book Storms (JSON模板): ${typeof result1} 输出`);
console.log(`Magic Pen 3D Bloom (文本模板): ${typeof result2} 输出`);
console.log('\n✅ 自动格式检测测试完成!');