import { PromptGenerator } from '@/services/promptGenerator';
import countryTemplate from '@/features/video-creator/data/templates/country-historical-evolution.json';

// 测试新的国家模板功能
async function testCountryTemplate() {
  console.log('=== 测试国家历史演变模板 ===\n');
  
  const testCountries = ['india', 'saudi_arabia', 'italy', 'egypt'];
  
  for (const country of testCountries) {
    console.log(`\n🌍 测试 ${country.toUpperCase()}:`);
    console.log('='.repeat(60));
    
    const params = { country, makePublic: false };
    const jsonPrompt = PromptGenerator.generateJsonPrompt(countryTemplate, params) as any;
    
    console.log(`📍 国家名: ${jsonPrompt.visual_core.description.split(' ')[10]}`);
    console.log(`🏛️ 地标1: ${jsonPrompt.timeline[1].action.split('of ')[1].split(' organically')[0]}`);
    console.log(`🎵 音乐: ${jsonPrompt.audio.music}`);
    
    // 检查特色元素
    if (country === 'india') {
      console.log('🇮🇳 印度特色: 泰姬陵、莫卧儿建筑、西塔尔音乐');
    } else if (country === 'saudi_arabia') {
      console.log('🇸🇦 沙特特色: 阿拉伯宫殿、绿洲、乌德琴音乐');
    }
    
    // 显示完整JSON结构（前500字符）
    console.log('\n📋 JSON结构预览:');
    console.log(JSON.stringify(jsonPrompt, null, 2).substring(0, 500) + '...');
  }
  
  console.log('\n✅ 国家模板测试完成');
  console.log('\n📊 模板统计:');
  console.log(`- 总国家数: ${countryTemplate.params.country.options.length}`);
  console.log(`- 隐藏参数数: ${Object.keys(countryTemplate.params).filter(key => countryTemplate.params[key as keyof typeof countryTemplate.params]?.type === 'hidden').length}`);
}

testCountryTemplate().catch(console.error);