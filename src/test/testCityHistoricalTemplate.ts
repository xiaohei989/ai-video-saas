import { PromptGenerator } from '@/services/promptGenerator';
import cityHistoricalTemplate from '@/features/video-creator/data/templates/city-historical-evolution.json';

// 测试城市历史演变模板的参数联动功能
async function testCityHistoricalTemplate() {
  console.log('=== 城市历史演变模板测试 ===');
  
  // 测试罗马
  console.log('\n1. 测试罗马模板生成:');
  const romeParams = { city: 'rome', makePublic: false };
  const romePrompt = PromptGenerator.generatePromptForLocal(cityHistoricalTemplate, romeParams);
  console.log('罗马提示词 (前200字符):');
  console.log(romePrompt.substring(0, 200) + '...');
  
  // 测试埃及
  console.log('\n2. 测试埃及模板生成:');
  const cairoParams = { city: 'cairo', makePublic: false };
  const cairoPrompt = PromptGenerator.generatePromptForLocal(cityHistoricalTemplate, cairoParams);
  console.log('埃及提示词 (前200字符):');
  console.log(cairoPrompt.substring(0, 200) + '...');
  
  // 测试JSON格式提示词生成
  console.log('\n3. 测试JSON格式提示词生成:');
  const jsonPrompt = PromptGenerator.generateJsonPrompt(cityHistoricalTemplate, romeParams);
  console.log('JSON结构提示词:');
  console.log(JSON.stringify(jsonPrompt, null, 2).substring(0, 500) + '...');
  
  // 测试联动参数解析
  console.log('\n4. 测试联动参数解析:');
  const resolvedParams = PromptGenerator.resolveLinkedParameters(cityHistoricalTemplate, romeParams);
  console.log('解析后的参数数量:', Object.keys(resolvedParams).length);
  console.log('city_name:', resolvedParams.city_name);
  console.log('landmark_1:', resolvedParams.landmark_1);
  console.log('lighting_description:', resolvedParams.lighting_description?.substring(0, 100) + '...');
  
  // 测试巴黎
  console.log('\n5. 测试巴黎模板生成:');
  const parisParams = { city: 'paris', makePublic: true };
  const parisResolvedParams = PromptGenerator.resolveLinkedParameters(cityHistoricalTemplate, parisParams);
  console.log('巴黎参数解析:');
  console.log('city_display_name:', parisResolvedParams.city_display_name);
  console.log('landmark_1:', parisResolvedParams.landmark_1);
  console.log('cultural_style:', parisResolvedParams.cultural_style);
  
  console.log('\n✅ 城市历史演变模板测试完成');
}

// 运行测试
testCityHistoricalTemplate().catch(console.error);