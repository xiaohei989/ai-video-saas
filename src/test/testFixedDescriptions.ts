import { PromptGenerator } from '@/services/promptGenerator';
import cityHistoricalTemplate from '@/features/video-creator/data/templates/city-historical-evolution.json';

// 测试修正后的城市描述
async function testFixedDescriptions() {
  console.log('=== 测试修正后的城市描述 ===\n');
  
  const testCities = ['sydney', 'moscow', 'beijing', 'new_york', 'rome'];
  
  for (const city of testCities) {
    console.log(`\n🔍 测试 ${city.toUpperCase()}:`);
    console.log('='.repeat(50));
    
    const params = { city, makePublic: false };
    const jsonPrompt = PromptGenerator.generateJsonPrompt(cityHistoricalTemplate, params) as any;
    
    // 显示第一段时间轴描述
    console.log(`[0-1.5s] ${jsonPrompt.timeline[0].action}`);
    console.log(`🎵 音频: ${jsonPrompt.audio.music}`);
    
    // 检查是否还有重复问题
    const firstAction = jsonPrompt.timeline[0].action.toLowerCase();
    const words = firstAction.split(/\s+/);
    const duplicates = words.filter((word, i) => words.indexOf(word) !== i && word.length > 3);
    
    if (duplicates.length > 0) {
      console.log(`   ⚠️  仍有重复词汇: ${duplicates.join(', ')}`);
    } else {
      console.log(`   ✅ 无重复词汇问题`);
    }
    
    // 检查音频是否有重复
    const musicText = jsonPrompt.audio.music;
    const buildingCount = (musicText.match(/building/g) || []).length;
    if (buildingCount > 1) {
      console.log(`   ⚠️  音频描述中"building"重复 ${buildingCount} 次`);
    } else {
      console.log(`   ✅ 音频描述无重复问题`);
    }
  }
  
  console.log('\n✅ 所有修正效果测试完成');
}

testFixedDescriptions().catch(console.error);