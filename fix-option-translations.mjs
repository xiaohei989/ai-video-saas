import { promises as fs } from 'fs';
import { join } from 'path';

// 所有选项的完整翻译数据
const optionTranslations = {
  // Energy Object Cutting ASMR 模板选项翻译
  "energy-object-cutting-asmr": {
    "cutting_object": {
      "plasma ball": {
        "en": "Plasma Ball 🔮",
        "zh": "等离子球 🔮", 
        "ja": "プラズマボール 🔮",
        "ko": "플라즈마 볼 🔮",
        "es": "Bola de Plasma 🔮",
        "de": "Plasma-Kugel 🔮",
        "fr": "Boule de Plasma 🔮",
        "ar": "كرة البلازما 🔮"
      },
      "lightning sphere": {
        "en": "Lightning Sphere ⚡",
        "zh": "闪电球 ⚡",
        "ja": "雷の球体 ⚡", 
        "ko": "번개 구체 ⚡",
        "es": "Esfera de Rayo ⚡",
        "de": "Blitzkugel ⚡",
        "fr": "Sphère de Foudre ⚡",
        "ar": "كرة البرق ⚡"
      },
      "storm cloud": {
        "en": "Storm Cloud ⛈️",
        "zh": "风暴云 ⛈️",
        "ja": "嵐雲 ⛈️",
        "ko": "폭풍 구름 ⛈️", 
        "es": "Nube de Tormenta ⛈️",
        "de": "Gewitterwolke ⛈️",
        "fr": "Nuage d'Orage ⛈️",
        "ar": "سحابة العاصفة ⛈️"
      },
      "nebula cloud": {
        "en": "Nebula Cloud 🌌",
        "zh": "星云 🌌",
        "ja": "星雲雲 🌌",
        "ko": "성운 구름 🌌",
        "es": "Nube de Nebulosa 🌌", 
        "de": "Nebel-Wolke 🌌",
        "fr": "Nuage de Nébuleuse 🌌",
        "ar": "سحابة السديم 🌌"
      },
      "fire orb": {
        "en": "Fire Orb 🔥",
        "zh": "火球 🔥",
        "ja": "火の玉 🔥",
        "ko": "불 구체 🔥",
        "es": "Orbe de Fuego 🔥",
        "de": "Feuer-Orb 🔥", 
        "fr": "Orbe de Feu 🔥",
        "ar": "كرة النار 🔥"
      },
      "water sphere": {
        "en": "Water Sphere 💧",
        "zh": "水球 💧",
        "ja": "水の球体 💧",
        "ko": "물 구체 💧",
        "es": "Esfera de Agua 💧",
        "de": "Wasserkugel 💧",
        "fr": "Sphère d'Eau 💧", 
        "ar": "كرة الماء 💧"
      },
      "crystal core": {
        "en": "Crystal Core 💎",
        "zh": "水晶核心 💎",
        "ja": "クリスタルコア 💎",
        "ko": "크리스탈 코어 💎",
        "es": "Núcleo de Cristal 💎",
        "de": "Kristallkern 💎",
        "fr": "Noyau de Cristal 💎",
        "ar": "نواة الكريستال 💎"
      },
      "energy shield": {
        "en": "Energy Shield 🌐",
        "zh": "能量护盾 🌐", 
        "ja": "エネルギーシールド 🌐",
        "ko": "에너지 실드 🌐",
        "es": "Escudo de Energía 🌐",
        "de": "Energie-Schild 🌐",
        "fr": "Bouclier d'Énergie 🌐",
        "ar": "درع الطاقة 🌐"
      },
      "antimatter orb": {
        "en": "Antimatter Orb 🛸",
        "zh": "反物质球 🛸",
        "ja": "反物質オーブ 🛸",
        "ko": "반물질 구체 🛸",
        "es": "Orbe de Antimateria 🛸",
        "de": "Antimaterie-Orb 🛸",
        "fr": "Orbe d'Antimatière 🛸",
        "ar": "كرة المضاد للمادة 🛸"
      },
      "black hole": {
        "en": "Black Hole 🕳️",
        "zh": "黑洞 🕳️",
        "ja": "ブラックホール 🕳️",
        "ko": "블랙홀 🕳️", 
        "es": "Agujero Negro 🕳️",
        "de": "Schwarzes Loch 🕳️",
        "fr": "Trou Noir 🕳️",
        "ar": "الثقب الأسود 🕳️"
      },
      "aurora field": {
        "en": "Aurora Field 🌅",
        "zh": "极光场 🌅",
        "ja": "オーロラ場 🌅",
        "ko": "오로라 필드 🌅",
        "es": "Campo de Aurora 🌅", 
        "de": "Aurora-Feld 🌅",
        "fr": "Champ d'Aurore 🌅",
        "ar": "حقل الشفق القطبي 🌅"
      }
    },
    "cutting_surface": {
      "wooden cutting board": {
        "en": "Wooden Cutting Board",
        "zh": "木制砧板",
        "ja": "木製まな板",
        "ko": "나무 도마",
        "es": "Tabla de Cortar de Madera",
        "de": "Holzschneidebrett", 
        "fr": "Planche à Découper en Bois",
        "ar": "لوح تقطيع خشبي"
      },
      "marble countertop": {
        "en": "Marble Countertop",
        "zh": "大理石台面",
        "ja": "大理石カウンタートップ",
        "ko": "대리석 조리대",
        "es": "Encimera de Mármol",
        "de": "Marmor-Arbeitsplatte",
        "fr": "Plan de Travail en Marbre",
        "ar": "سطح رخامي"
      },
      "glass surface": {
        "en": "Glass Surface",
        "zh": "玻璃表面",
        "ja": "ガラス表面", 
        "ko": "유리 표면",
        "es": "Superficie de Vidrio",
        "de": "Glasoberfläche",
        "fr": "Surface en Verre",
        "ar": "سطح زجاجي"
      },
      "metal platform": {
        "en": "Metal Platform",
        "zh": "金属平台",
        "ja": "金属プラットフォーム",
        "ko": "금속 플랫폼",
        "es": "Plataforma de Metal",
        "de": "Metall-Plattform",
        "fr": "Plateforme Métallique",
        "ar": "منصة معدنية"
      },
      "stone slate": {
        "en": "Stone Slate",
        "zh": "石板",
        "ja": "石製スレート",
        "ko": "석판",
        "es": "Pizarra de Piedra", 
        "de": "Steinschiefer",
        "fr": "Ardoise de Pierre",
        "ar": "لوح حجري"
      }
    }
  }
};

async function applyOptionTranslations() {
  console.log('🔄 开始修复模板选项的多语言翻译...\n');

  const templatesDir = join(process.cwd(), 'src/features/video-creator/data/templates');
  
  for (const [templateSlug, templateTranslations] of Object.entries(optionTranslations)) {
    console.log(`📝 处理模板: ${templateSlug}`);
    
    const templatePath = join(templatesDir, `${templateSlug}.json`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = JSON.parse(templateContent);
    
    let modified = false;
    
    // 为每个参数的选项添加多语言翻译
    for (const [paramKey, paramTranslations] of Object.entries(templateTranslations)) {
      if (template.params[paramKey] && template.params[paramKey].options) {
        console.log(`  🎯 处理参数: ${paramKey}`);
        
        for (const option of template.params[paramKey].options) {
          const optionValue = option.value;
          
          if (paramTranslations[optionValue]) {
            console.log(`    ✅ 翻译选项: ${optionValue}`);
            option.label = paramTranslations[optionValue];
            modified = true;
          }
        }
      }
    }
    
    if (modified) {
      // 更新 lastModified 时间戳
      template.lastModified = new Date().toISOString();
      
      // 写回文件
      await fs.writeFile(templatePath, JSON.stringify(template, null, 2), 'utf-8');
      console.log(`  💾 已保存: ${templateSlug}.json\n`);
    } else {
      console.log(`  ⚠️ 未找到需要修改的选项\n`);
    }
  }
  
  console.log('🎉 选项翻译修复完成！');
}

applyOptionTranslations().catch(console.error);