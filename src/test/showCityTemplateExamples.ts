import { PromptGenerator } from '@/services/promptGenerator';
import cityHistoricalTemplate from '@/features/video-creator/data/templates/city-historical-evolution.json';

// 展示城市历史演变模板的完整提示词示例
async function showCityTemplateExamples() {
  console.log('=== 城市历史演变模板完整提示词示例 ===\n');
  
  // 展示罗马完整提示词
  console.log('🇮🇹 罗马完整提示词:');
  console.log('====================');
  const romeParams = { city: 'rome', makePublic: false };
  const romePrompt = PromptGenerator.generatePromptForLocal(cityHistoricalTemplate, romeParams);
  console.log(romePrompt);
  console.log('\n' + '='.repeat(80) + '\n');
  
  // 展示埃及完整提示词
  console.log('🇪🇬 埃及完整提示词:');
  console.log('====================');
  const cairoParams = { city: 'cairo', makePublic: false };
  const cairoPrompt = PromptGenerator.generatePromptForLocal(cityHistoricalTemplate, cairoParams);
  console.log(cairoPrompt);
  console.log('\n' + '='.repeat(80) + '\n');
  
  // 展示巴黎JSON格式提示词
  console.log('🇫🇷 巴黎JSON格式提示词:');
  console.log('=========================');
  const parisParams = { city: 'paris', makePublic: true };
  const parisJsonPrompt = PromptGenerator.generateJsonPrompt(cityHistoricalTemplate, parisParams);
  console.log(JSON.stringify(parisJsonPrompt, null, 2));
  
  console.log('\n✅ 模板示例展示完成');
}

// 运行示例展示
showCityTemplateExamples().catch(console.error);