import { PromptGenerator } from '@/services/promptGenerator';
import cityHistoricalTemplate from '@/features/video-creator/data/templates/city-historical-evolution.json';

// 检查所有城市的描述
async function reviewAllCityDescriptions() {
  console.log('=== 检查所有城市模板描述 ===\n');
  
  const cities = [
    'rome', 'cairo', 'paris', 'tokyo', 'london', 
    'new_york', 'beijing', 'istanbul', 'moscow', 'sydney'
  ];
  
  for (const city of cities) {
    console.log(`\n🔍 检查 ${city.toUpperCase()}:`);
    console.log('='.repeat(50));
    
    const params = { city, makePublic: false };
    const jsonPrompt = PromptGenerator.generateJsonPrompt(cityHistoricalTemplate, params) as any;
    
    // 检查时间轴中的关键描述
    jsonPrompt.timeline.forEach((segment: any, index: number) => {
      console.log(`[${segment.time}] ${segment.action}`);
      
      // 检查是否有潜在问题
      const action = segment.action.toLowerCase();
      
      // 检查是否有重复词汇
      const words = action.split(/\s+/);
      const duplicates = words.filter((word, i) => words.indexOf(word) !== i && word.length > 3);
      if (duplicates.length > 0) {
        console.log(`   ⚠️  发现重复词汇: ${duplicates.join(', ')}`);
      }
      
      // 检查"ancient"是否合适
      if (action.includes('ancient') && (city === 'new_york' || city === 'tokyo' || city === 'sydney')) {
        console.log(`   ⚠️  现代城市使用"ancient"可能不合适`);
      }
    });
    
    // 检查音频描述
    console.log(`\n🎵 音频: ${jsonPrompt.audio.music}`);
    if (jsonPrompt.audio.music.includes('building') && jsonPrompt.audio.music.includes('building')) {
      const buildingCount = (jsonPrompt.audio.music.match(/building/g) || []).length;
      if (buildingCount > 1) {
        console.log(`   ⚠️  音频描述中"building"重复 ${buildingCount} 次`);
      }
    }
  }
  
  console.log('\n✅ 所有城市描述检查完成');
}

reviewAllCityDescriptions().catch(console.error);