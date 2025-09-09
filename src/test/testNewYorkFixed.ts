import { PromptGenerator } from '@/services/promptGenerator';
import cityHistoricalTemplate from '@/features/video-creator/data/templates/city-historical-evolution.json';

// 测试修正后的纽约模板
async function testNewYorkFixed() {
  console.log('=== 测试修正后的纽约模板 ===\n');
  
  const newYorkParams = { city: 'new_york', makePublic: false };
  const newYorkJsonPrompt = PromptGenerator.generateJsonPrompt(cityHistoricalTemplate, newYorkParams);
  
  console.log('🇺🇸 修正后的纽约JSON提示词:');
  console.log('==============================');
  console.log(JSON.stringify(newYorkJsonPrompt, null, 2));
  
  console.log('\n✅ 纽约模板修正测试完成');
}

testNewYorkFixed().catch(console.error);