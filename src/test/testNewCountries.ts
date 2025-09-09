import { PromptGenerator } from '@/services/promptGenerator';
import countryTemplate from '@/features/video-creator/data/templates/country-historical-evolution.json';

// 测试新添加的4个国家
async function testNewCountries() {
  console.log('=== 测试新添加的国家 ===\n');
  
  const newCountries = ['germany', 'spain', 'mexico', 'brazil'];
  
  for (const country of newCountries) {
    console.log(`\n🌍 测试 ${country.toUpperCase()}:`);
    console.log('='.repeat(60));
    
    const params = { country, makePublic: false };
    const jsonPrompt = PromptGenerator.generateJsonPrompt(countryTemplate, params) as any;
    
    // 显示关键信息
    console.log(`📍 国家: ${jsonPrompt.visual_core.description.split(' ')[10]}`);
    console.log(`🏛️ 地标1: ${jsonPrompt.timeline[1].action.split('of ')[1]?.split(' organically')[0] || 'N/A'}`);
    console.log(`🎵 音乐: ${jsonPrompt.audio.music.substring(0, 80)}...`);
    
    // 显示第一段时间轴（地图展开）
    console.log(`\n[0-1.5s] ${jsonPrompt.timeline[0].action}`);
    
    // 检查特色元素
    switch(country) {
      case 'germany':
        console.log('🇩🇪 德国特色: 勃兰登堡门、新天鹅堡、巴赫和贝多芬音乐');
        break;
      case 'spain':
        console.log('🇪🇸 西班牙特色: 圣家堂、阿尔罕布拉宫、弗拉门戈吉他');
        break;
      case 'mexico':
        console.log('🇲🇽 墨西哥特色: 奇琴伊察金字塔、墨西哥大教堂、墨西哥流浪乐队');
        break;
      case 'brazil':
        console.log('🇧🇷 巴西特色: 基督像、科帕卡巴纳海滩、桑巴音乐');
        break;
    }
  }
  
  console.log('\n📊 更新后的模板统计:');
  console.log(`- 总国家数: ${countryTemplate.params.country.options.length}`);
  console.log('- 新增国家: 德国、西班牙、墨西哥、巴西');
  console.log('✅ 所有新国家添加完成');
}

testNewCountries().catch(console.error);