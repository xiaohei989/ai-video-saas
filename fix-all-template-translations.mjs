#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🌍 开始全量模板多语言选项修复...');

// 多语言翻译数据库
const translationDatabase = {
  // 水果类
  "apple": {
    "en": "Apple 🍎",
    "zh": "苹果 🍎", 
    "ja": "リンゴ 🍎",
    "ko": "사과 🍎",
    "es": "Manzana 🍎",
    "de": "Apfel 🍎",
    "fr": "Pomme 🍎",
    "ar": "تفاحة 🍎"
  },
  "strawberry": {
    "en": "Strawberry 🍓",
    "zh": "草莓 🍓",
    "ja": "イチゴ 🍓", 
    "ko": "딸기 🍓",
    "es": "Fresa 🍓",
    "de": "Erdbeere 🍓",
    "fr": "Fraise 🍓",
    "ar": "فراولة 🍓"
  },
  "cherry": {
    "en": "Cherry 🍑",
    "zh": "樱桃 🍑",
    "ja": "チェリー 🍑",
    "ko": "체리 🍑", 
    "es": "Cereza 🍑",
    "de": "Kirsche 🍑",
    "fr": "Cerise 🍑",
    "ar": "كرز 🍑"
  },
  "grape": {
    "en": "Grape 🍇",
    "zh": "葡萄 🍇",
    "ja": "ぶどう 🍇",
    "ko": "포도 🍇",
    "es": "Uva 🍇", 
    "de": "Traube 🍇",
    "fr": "Raisin 🍇",
    "ar": "عنب 🍇"
  },
  "kiwi": {
    "en": "Kiwi 🥝",
    "zh": "猕猴桃 🥝",
    "ja": "キウイ 🥝",
    "ko": "키위 🥝",
    "es": "Kiwi 🥝",
    "de": "Kiwi 🥝",
    "fr": "Kiwi 🥝", 
    "ar": "كيوي 🥝"
  },
  "orange": {
    "en": "Orange 🍊",
    "zh": "橙子 🍊",
    "ja": "オレンジ 🍊",
    "ko": "오렌지 🍊",
    "es": "Naranja 🍊",
    "de": "Orange 🍊",
    "fr": "Orange 🍊",
    "ar": "برتقالة 🍊"
  },
  "lemon": {
    "en": "Lemon 🍋",
    "zh": "柠檬 🍋",
    "ja": "レモン 🍋",
    "ko": "레몬 🍋",
    "es": "Limón 🍋",
    "de": "Zitrone 🍋",
    "fr": "Citron 🍋",
    "ar": "ليمونة 🍋"
  },
  "mango": {
    "en": "Mango 🥭",
    "zh": "芒果 🥭",
    "ja": "マンゴー 🥭",
    "ko": "망고 🥭",
    "es": "Mango 🥭",
    "de": "Mango 🥭",
    "fr": "Mangue 🥭",
    "ar": "مانجو 🥭"
  },
  "watermelon": {
    "en": "Watermelon 🍉",
    "zh": "西瓜 🍉",
    "ja": "スイカ 🍉",
    "ko": "수박 🍉",
    "es": "Sandía 🍉",
    "de": "Wassermelone 🍉",
    "fr": "Pastèque 🍉",
    "ar": "بطيخ 🍉"
  },
  "grapes": {
    "en": "Grapes 🍇",
    "zh": "葡萄 🍇",
    "ja": "ぶどう 🍇",
    "ko": "포도 🍇",
    "es": "Uvas 🍇",
    "de": "Trauben 🍇",
    "fr": "Raisins 🍇",
    "ar": "عنب 🍇"
  },
  "peach": {
    "en": "Peach 🍑",
    "zh": "桃子 🍑",
    "ja": "桃 🍑",
    "ko": "복숭아 🍑",
    "es": "Durazno 🍑",
    "de": "Pfirsich 🍑",
    "fr": "Pêche 🍑",
    "ar": "خوخ 🍑"
  },
  "pear": {
    "en": "Pear 🍐",
    "zh": "梨 🍐",
    "ja": "梨 🍐",
    "ko": "배 🍐",
    "es": "Pera 🍐",
    "de": "Birne 🍐",
    "fr": "Poire 🍐",
    "ar": "كمثرى 🍐"
  },

  // 颜色类
  "translucent pink": {
    "en": "Translucent Pink 💗",
    "zh": "半透明粉色 💗",
    "ja": "半透明ピンク 💗",
    "ko": "반투명 분홍 💗",
    "es": "Rosa Translúcido 💗", 
    "de": "Transluzentes Rosa 💗",
    "fr": "Rose Translucide 💗",
    "ar": "وردي شفاف 💗"
  },
  "translucent blue": {
    "en": "Translucent Blue 💙",
    "zh": "半透明蓝色 💙",
    "ja": "半透明ブルー 💙",
    "ko": "반투명 파랑 💙",
    "es": "Azul Translúcido 💙",
    "de": "Transluzentes Blau 💙", 
    "fr": "Bleu Translucide 💙",
    "ar": "أزرق شفاف 💙"
  },
  "translucent green": {
    "en": "Translucent Green 💚",
    "zh": "半透明绿色 💚",
    "ja": "半透明グリーン 💚",
    "ko": "반투명 초록 💚",
    "es": "Verde Translúcido 💚",
    "de": "Transluzentes Grün 💚",
    "fr": "Vert Translucide 💚",
    "ar": "أخضر شفاف 💚"
  },
  "translucent yellow": {
    "en": "Translucent Yellow 💛",
    "zh": "半透明黄色 💛",
    "ja": "半透明イエロー 💛",
    "ko": "반투명 노랑 💛",
    "es": "Amarillo Translúcido 💛",
    "de": "Transluzentes Gelb 💛",
    "fr": "Jaune Translucide 💛",
    "ar": "أصفر شفاف 💛"
  },
  "translucent purple": {
    "en": "Translucent Purple 💜",
    "zh": "半透明紫色 💜",
    "ja": "半透明パープル 💜",
    "ko": "반투명 보라 💜",
    "es": "Púrpura Translúcido 💜",
    "de": "Transluzentes Lila 💜",
    "fr": "Violet Translucide 💜",
    "ar": "بنفسجي شفاف 💜"
  },
  "translucent white": {
    "en": "Translucent White 🤍",
    "zh": "半透明白色 🤍",
    "ja": "半透明ホワイト 🤍",
    "ko": "반투명 흰색 🤍",
    "es": "Blanco Translúcido 🤍",
    "de": "Transluzentes Weiß 🤍",
    "fr": "Blanc Translucide 🤍",
    "ar": "أبيض شفاف 🤍"
  },
  "translucent orange": {
    "en": "Translucent Orange 🧡",
    "zh": "半透明橙色 🧡",
    "ja": "半透明オレンジ 🧡",
    "ko": "반투명 주황 🧡",
    "es": "Naranja Translúcido 🧡",
    "de": "Transluzentes Orange 🧡",
    "fr": "Orange Translucide 🧡",
    "ar": "برتقالي شفاف 🧡"
  },
  "translucent red": {
    "en": "Translucent Red ❤️",
    "zh": "半透明红色 ❤️",
    "ja": "半透明レッド ❤️",
    "ko": "반투명 빨강 ❤️",
    "es": "Rojo Translúcido ❤️",
    "de": "Transluzentes Rot ❤️",
    "fr": "Rouge Translucide ❤️",
    "ar": "أحمر شفاف ❤️"
  },

  // 材质类
  "crystal": {
    "en": "Crystal 💎",
    "zh": "水晶 💎",
    "ja": "クリスタル 💎",
    "ko": "크리스탈 💎",
    "es": "Cristal 💎",
    "de": "Kristall 💎",
    "fr": "Cristal 💎",
    "ar": "كريستال 💎"
  },
  "ice": {
    "en": "Ice 🧊",
    "zh": "冰块 🧊",
    "ja": "氷 🧊",
    "ko": "얼음 🧊", 
    "es": "Hielo 🧊",
    "de": "Eis 🧊",
    "fr": "Glace 🧊",
    "ar": "ثلج 🧊"
  },
  "glass": {
    "en": "Glass 🪟",
    "zh": "玻璃 🪟",
    "ja": "ガラス 🪟",
    "ko": "유리 🪟",
    "es": "Vidrio 🪟",
    "de": "Glas 🪟",
    "fr": "Verre 🪟",
    "ar": "زجاج 🪟"
  },
  "amber": {
    "en": "Amber 🍯",
    "zh": "琥珀 🍯",
    "ja": "アンバー 🍯",
    "ko": "호박 🍯",
    "es": "Ámbar 🍯",
    "de": "Bernstein 🍯",
    "fr": "Ambre 🍯",
    "ar": "عنبر 🍯"
  },
  "hydrogel": {
    "en": "Hydrogel 💧",
    "zh": "水凝胶 💧",
    "ja": "ハイドロゲル 💧",
    "ko": "하이드로겔 💧",
    "es": "Hidrogel 💧",
    "de": "Hydrogel 💧",
    "fr": "Hydrogel 💧",
    "ar": "هيدروجيل 💧"
  },
  "soap": {
    "en": "Soap 🧼",
    "zh": "肥皂 🧼",
    "ja": "石鹸 🧼",
    "ko": "비누 🧼",
    "es": "Jabón 🧼",
    "de": "Seife 🧼",
    "fr": "Savon 🧼",
    "ar": "صابون 🧼"
  },

  // 动物类
  "cat": {
    "en": "Cat 🐱",
    "zh": "猫 🐱",
    "ja": "猫 🐱",
    "ko": "고양이 🐱",
    "es": "Gato 🐱",
    "de": "Katze 🐱",
    "fr": "Chat 🐱",
    "ar": "قطة 🐱"
  },
  "dog": {
    "en": "Dog 🐶",
    "zh": "狗 🐶",
    "ja": "犬 🐶",
    "ko": "개 🐶",
    "es": "Perro 🐶",
    "de": "Hund 🐶",
    "fr": "Chien 🐶",
    "ar": "كلب 🐶"
  },
  "rabbit": {
    "en": "Rabbit 🐰",
    "zh": "兔子 🐰",
    "ja": "ウサギ 🐰",
    "ko": "토끼 🐰",
    "es": "Conejo 🐰",
    "de": "Kaninchen 🐰",
    "fr": "Lapin 🐰",
    "ar": "أرنب 🐰"
  },
  "hamster": {
    "en": "Hamster 🐹",
    "zh": "仓鼠 🐹",
    "ja": "ハムスター 🐹",
    "ko": "햄스터 🐹",
    "es": "Hámster 🐹",
    "de": "Hamster 🐹",
    "fr": "Hamster 🐹",
    "ar": "هامستر 🐹"
  },
  "panda": {
    "en": "Panda 🐼",
    "zh": "熊猫 🐼",
    "ja": "パンダ 🐼",
    "ko": "판다 🐼",
    "es": "Panda 🐼",
    "de": "Panda 🐼",
    "fr": "Panda 🐼",
    "ar": "باندا 🐼"
  },
  "bear": {
    "en": "Bear 🐻",
    "zh": "熊 🐻",
    "ja": "クマ 🐻",
    "ko": "곰 🐻",
    "es": "Oso 🐻",
    "de": "Bär 🐻",
    "fr": "Ours 🐻",
    "ar": "دب 🐻"
  },
  "lion": {
    "en": "Lion 🦁",
    "zh": "狮子 🦁",
    "ja": "ライオン 🦁",
    "ko": "사자 🦁",
    "es": "León 🦁",
    "de": "Löwe 🦁",
    "fr": "Lion 🦁",
    "ar": "أسد 🦁"
  },
  "elephant": {
    "en": "Elephant 🐘",
    "zh": "大象 🐘",
    "ja": "ゾウ 🐘",
    "ko": "코끼리 🐘",
    "es": "Elefante 🐘",
    "de": "Elefant 🐘",
    "fr": "Éléphant 🐘",
    "ar": "فيل 🐘"
  },

  // 职业类
  "doctor": {
    "en": "Doctor 👨‍⚕️",
    "zh": "医生 👨‍⚕️",
    "ja": "医者 👨‍⚕️",
    "ko": "의사 👨‍⚕️",
    "es": "Doctor 👨‍⚕️",
    "de": "Arzt 👨‍⚕️",
    "fr": "Docteur 👨‍⚕️",
    "ar": "طبيب 👨‍⚕️"
  },
  "teacher": {
    "en": "Teacher 👨‍🏫",
    "zh": "老师 👨‍🏫",
    "ja": "先生 👨‍🏫",
    "ko": "선생님 👨‍🏫",
    "es": "Profesor 👨‍🏫",
    "de": "Lehrer 👨‍🏫",
    "fr": "Professeur 👨‍🏫",
    "ar": "معلم 👨‍🏫"
  },
  "chef": {
    "en": "Chef 👨‍🍳",
    "zh": "厨师 👨‍🍳",
    "ja": "シェフ 👨‍🍳",
    "ko": "요리사 👨‍🍳",
    "es": "Chef 👨‍🍳",
    "de": "Koch 👨‍🍳",
    "fr": "Chef 👨‍🍳",
    "ar": "طباخ 👨‍🍳"
  },
  "police": {
    "en": "Police 👮‍♂️",
    "zh": "警察 👮‍♂️",
    "ja": "警察 👮‍♂️",
    "ko": "경찰 👮‍♂️",
    "es": "Policía 👮‍♂️",
    "de": "Polizist 👮‍♂️",
    "fr": "Policier 👮‍♂️",
    "ar": "شرطي 👮‍♂️"
  },
  "firefighter": {
    "en": "Firefighter 👨‍🚒",
    "zh": "消防员 👨‍🚒",
    "ja": "消防士 👨‍🚒",
    "ko": "소방관 👨‍🚒",
    "es": "Bombero 👨‍🚒",
    "de": "Feuerwehrmann 👨‍🚒",
    "fr": "Pompier 👨‍🚒",
    "ar": "رجل إطفاء 👨‍🚒"
  },

  // 表面/材料类
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
  },

  // 常用参数标签
  "Color": {
    "en": "Color",
    "zh": "颜色",
    "ja": "色",
    "ko": "색상",
    "es": "Color",
    "de": "Farbe",
    "fr": "Couleur",
    "ar": "اللون"
  },
  "Material": {
    "en": "Material",
    "zh": "材质",
    "ja": "材質",
    "ko": "재질",
    "es": "Material",
    "de": "Material",
    "fr": "Matériau",
    "ar": "المادة"
  },
  "Size": {
    "en": "Size",
    "zh": "尺寸",
    "ja": "サイズ",
    "ko": "크기",
    "es": "Tamaño",
    "de": "Größe",
    "fr": "Taille",
    "ar": "الحجم"
  },
  "Style": {
    "en": "Style",
    "zh": "风格",
    "ja": "スタイル",
    "ko": "스타일",
    "es": "Estilo",
    "de": "Stil",
    "fr": "Style",
    "ar": "النمط"
  },
  "Fruit Type": {
    "en": "Fruit Type",
    "zh": "水果类型",
    "ja": "フルーツの種類",
    "ko": "과일 종류",
    "es": "Tipo de Fruta",
    "de": "Frucht Art",
    "fr": "Type de Fruit",
    "ar": "نوع الفاكهة"
  },
  "Knife Type": {
    "en": "Knife Type",
    "zh": "刀具类型",
    "ja": "ナイフの種類",
    "ko": "칼 종류",
    "es": "Tipo de Cuchillo",
    "de": "Messer Art",
    "fr": "Type de Couteau",
    "ar": "نوع السكين"
  },
  "Cutting Style": {
    "en": "Cutting Style",
    "zh": "切割风格",
    "ja": "切り方",
    "ko": "자르기 스타일",
    "es": "Estilo de Corte",
    "de": "Schnitt Stil",
    "fr": "Style de Coupe",
    "ar": "نمط القطع"
  },
  "Lighting": {
    "en": "Lighting",
    "zh": "照明",
    "ja": "照明",
    "ko": "조명",
    "es": "Iluminación",
    "de": "Beleuchtung",
    "fr": "Éclairage",
    "ar": "الإضاءة"
  },
  "Surface": {
    "en": "Surface",
    "zh": "表面",
    "ja": "表面",
    "ko": "표면",
    "es": "Superficie",
    "de": "Oberfläche",
    "fr": "Surface",
    "ar": "السطح"
  },
  "Slice Thickness (mm)": {
    "en": "Slice Thickness (mm)",
    "zh": "切片厚度 (毫米)",
    "ja": "スライスの厚さ (mm)",
    "ko": "슬라이스 두께 (mm)",
    "es": "Grosor de Rebanada (mm)",
    "de": "Scheiben Dicke (mm)",
    "fr": "Épaisseur de Tranche (mm)",
    "ar": "سمك الشريحة (مم)"
  },

  // 刀具类型翻译
  "stainless steel kitchen": {
    "en": "Stainless Steel Kitchen",
    "zh": "不锈钢厨刀",
    "ja": "ステンレス包丁",
    "ko": "스테인리스 주방칼",
    "es": "Cuchillo de Acero Inoxidable",
    "de": "Edelstahl-Küchenmesser",
    "fr": "Couteau de Cuisine Inox",
    "ar": "سكين مطبخ من الستانلس ستيل"
  },
  "matte black blade": {
    "en": "Matte Black Blade",
    "zh": "哑光黑刀片",
    "ja": "マットブラック刃",
    "ko": "무광 검은 칼날",
    "es": "Hoja Negra Mate",
    "de": "Matte Schwarze Klinge",
    "fr": "Lame Noire Mate",
    "ar": "نصل أسود غير لامع"
  },
  "white ceramic": {
    "en": "White Ceramic",
    "zh": "白色陶瓷刀",
    "ja": "白いセラミック",
    "ko": "하얀 세라믹",
    "es": "Cerámica Blanca",
    "de": "Weiße Keramik",
    "fr": "Céramique Blanche",
    "ar": "سيراميك أبيض"
  },
  "damascus steel": {
    "en": "Damascus Steel",
    "zh": "大马士革钢刀",
    "ja": "ダマスカス鋼",
    "ko": "다마스커스 강철",
    "es": "Acero Damasco",
    "de": "Damaszenerstahl",
    "fr": "Acier de Damas",
    "ar": "فولاذ دمشقي"
  },
  "Japanese santoku": {
    "en": "Japanese Santoku",
    "zh": "日式三德刀",
    "ja": "日本の三徳包丁",
    "ko": "일본식 산토쿠",
    "es": "Santoku Japonés",
    "de": "Japanisches Santoku",
    "fr": "Santoku Japonais",
    "ar": "سانتوكو ياباني"
  },

  // 切割风格翻译
  "a single clean slice": {
    "en": "Single Clean Slice",
    "zh": "单次干净切片",
    "ja": "一回のきれいなスライス",
    "ko": "한 번의 깔끔한 절단",
    "es": "Corte Limpio Simple",
    "de": "Ein Sauberer Schnitt",
    "fr": "Une Tranche Nette",
    "ar": "شريحة واحدة نظيفة"
  },
  "multiple thin slices": {
    "en": "Multiple Thin Slices",
    "zh": "多片薄切",
    "ja": "複数の薄いスライス",
    "ko": "여러 개의 얇은 조각",
    "es": "Múltiples Rebanadas Finas",
    "de": "Mehrere Dünne Scheiben",
    "fr": "Multiples Tranches Fines",
    "ar": "شرائح رفيعة متعددة"
  },
  "a halving cut": {
    "en": "Cut in Half",
    "zh": "对半切",
    "ja": "半分に切る",
    "ko": "반으로 자르기",
    "es": "Cortar por la Mitad",
    "de": "Halbierung",
    "fr": "Couper en Deux",
    "ar": "قطع إلى نصفين"
  },
  "quarter cuts": {
    "en": "Cut in Quarters",
    "zh": "四等分切",
    "ja": "四分割",
    "ko": "4등분으로 자르기",
    "es": "Cortar en Cuartos",
    "de": "Vierteln",
    "fr": "Couper en Quartiers",
    "ar": "تقطيع إلى أرباع"
  },

  // 照明类型翻译
  "soft diffuse": {
    "en": "Soft Diffuse",
    "zh": "柔和漫射",
    "ja": "ソフト拡散",
    "ko": "부드러운 확산",
    "es": "Difuso Suave",
    "de": "Weiche Streuung",
    "fr": "Diffusion Douce",
    "ar": "انتشار ناعم"
  },
  "studio": {
    "en": "Studio",
    "zh": "工作室照明",
    "ja": "スタジオ",
    "ko": "스튜디오",
    "es": "Estudio",
    "de": "Studio",
    "fr": "Studio",
    "ar": "استوديو"
  },

  // 表面材质翻译
  "neutral marble countertop": {
    "en": "Marble Countertop",
    "zh": "大理石台面",
    "ja": "大理石カウンター",
    "ko": "대리석 조리대",
    "es": "Encimera de Mármol",
    "de": "Marmor-Arbeitsplatte",
    "fr": "Plan de Travail en Marbre",
    "ar": "سطح رخامي"
  },
  "white ceramic plate": {
    "en": "White Ceramic Plate",
    "zh": "白色陶瓷盘",
    "ja": "白いセラミックプレート",
    "ko": "흰색 세라믹 접시",
    "es": "Plato de Cerámica Blanca",
    "de": "Weißer Keramikteller",
    "fr": "Assiette en Céramique Blanche",
    "ar": "طبق سيراميك أبيض"
  },
  "black slate surface": {
    "en": "Black Slate Surface",
    "zh": "黑色石板表面",
    "ja": "黒いスレート表面",
    "ko": "검은 슬레이트 표면",
    "es": "Superficie de Pizarra Negra",
    "de": "Schwarze Schieferoberfläche",
    "fr": "Surface en Ardoise Noire",
    "ar": "سطح حجر أردوازي أسود"
  },

  // 玻璃切割模板缺失翻译
  "vivid red": {
    "en": "Vivid Red",
    "zh": "鲜艳红色",
    "ja": "鮮やかな赤",
    "ko": "선명한 빨강",
    "es": "Rojo Vívido",
    "de": "Lebhaftes Rot",
    "fr": "Rouge Vif",
    "ar": "أحمر زاهي"
  },
  "deep ruby": {
    "en": "Deep Ruby",
    "zh": "深红宝石色",
    "ja": "深いルビー色",
    "ko": "깊은 루비색",
    "es": "Rubí Profundo",
    "de": "Tiefes Rubinrot",
    "fr": "Rubis Profond",
    "ar": "ياقوت أحمر عميق"
  },
  "bright orange": {
    "en": "Bright Orange",
    "zh": "明亮橙色",
    "ja": "明るいオレンジ",
    "ko": "밝은 주황색",
    "es": "Naranja Brillante",
    "de": "Helles Orange",
    "fr": "Orange Vif",
    "ar": "برتقالي مشرق"
  },
  "golden yellow": {
    "en": "Golden Yellow",
    "zh": "金黄色",
    "ja": "金色の黄色",
    "ko": "황금색",
    "es": "Amarillo Dorado",
    "de": "Goldgelb",
    "fr": "Jaune Doré",
    "ar": "أصفر ذهبي"
  },
  "emerald green": {
    "en": "Emerald Green",
    "zh": "翡翠绿",
    "ja": "エメラルドグリーン",
    "ko": "에메랄드 그린",
    "es": "Verde Esmeralda",
    "de": "Smaragdgrün",
    "fr": "Vert Émeraude",
    "ar": "أخضر زمردي"
  },
  "ocean blue": {
    "en": "Ocean Blue",
    "zh": "海洋蓝",
    "ja": "オーシャンブルー",
    "ko": "바다 블루",
    "es": "Azul Océano",
    "de": "Ozeanblau",
    "fr": "Bleu Océan",
    "ar": "أزرق المحيط"
  },
  "royal purple": {
    "en": "Royal Purple",
    "zh": "皇室紫",
    "ja": "ロイヤルパープル",
    "ko": "로열 퍼플",
    "es": "Púrpura Real",
    "de": "Königsviolett",
    "fr": "Violet Royal",
    "ar": "بنفسجي ملكي"
  },
  "crystal clear": {
    "en": "Crystal Clear",
    "zh": "水晶透明",
    "ja": "クリスタルクリア",
    "ko": "수정처럼 맑은",
    "es": "Cristalino",
    "de": "Kristallklar",
    "fr": "Cristallin",
    "ar": "شفاف كالكريستال"
  },
  "rose pink": {
    "en": "Rose Pink",
    "zh": "玫瑰粉",
    "ja": "ローズピンク",
    "ko": "로즈 핑크",
    "es": "Rosa Rosa",
    "de": "Rosenrosa",
    "fr": "Rose",
    "ar": "وردي الورد"
  },
  "turquoise": {
    "en": "Turquoise",
    "zh": "绿松石色",
    "ja": "ターコイズ",
    "ko": "터키석색",
    "es": "Turquesa",
    "de": "Türkis",
    "fr": "Turquoise",
    "ar": "فيروزي"
  },
  "rainbow gradient": {
    "en": "Rainbow Gradient",
    "zh": "彩虹渐变",
    "ja": "レインボーグラデーション",
    "ko": "무지개 그라데이션",
    "es": "Gradiente Arcoíris",
    "de": "Regenbogen-Verlauf",
    "fr": "Dégradé Arc-en-ciel",
    "ar": "تدرج قوس قزح"
  },
  "diamond": {
    "en": "Diamond",
    "zh": "钻石",
    "ja": "ダイヤモンド",
    "ko": "다이아몬드",
    "es": "Diamante",
    "de": "Diamant",
    "fr": "Diamant",
    "ar": "ماس"
  },
  "frosted glass": {
    "en": "Frosted Glass",
    "zh": "磨砂玻璃",
    "ja": "すりガラス",
    "ko": "서리 유리",
    "es": "Vidrio Esmerilado",
    "de": "Milchglas",
    "fr": "Verre Dépoli",
    "ar": "زجاج مصنفر"
  },
  "jade": {
    "en": "Jade",
    "zh": "翡翠",
    "ja": "翡翠",
    "ko": "옥",
    "es": "Jade",
    "de": "Jade",
    "fr": "Jade",
    "ar": "اليشم"
  },
  "wax": {
    "en": "Wax",
    "zh": "蜡",
    "ja": "ワックス",
    "ko": "왁스",
    "es": "Cera",
    "de": "Wachs",
    "fr": "Cire",
    "ar": "شمع"
  },
  "jelly": {
    "en": "Jelly",
    "zh": "果冻",
    "ja": "ゼリー",
    "ko": "젤리",
    "es": "Gelatina",
    "de": "Gelee",
    "fr": "Gelée",
    "ar": "جيلي"
  },
  "hard candy": {
    "en": "Hard Candy",
    "zh": "硬糖",
    "ja": "ハードキャンディ",
    "ko": "하드캔디",
    "es": "Caramelo Duro",
    "de": "Hartbonbon",
    "fr": "Bonbon Dur",
    "ar": "حلوى صلبة"
  },

  // 活书风暴模板缺失翻译
  "viking_longship": {
    "en": "⚔️ Viking Longship",
    "zh": "⚔️ 维京长船",
    "ja": "⚔️ バイキング船",
    "ko": "⚔️ 바이킹 롱쉽",
    "es": "⚔️ Drakkar Vikingo",
    "de": "⚔️ Wikinger Langschiff",
    "fr": "⚔️ Drakkar Viking",
    "ar": "⚔️ سفينة الفايكنغ الطويلة"
  },
  "pirate_frigate": {
    "en": "🏴‍☠️ Pirate Frigate",
    "zh": "🏴‍☠️ 海盗护卫舰",
    "ja": "🏴‍☠️ 海賊フリゲート艦",
    "ko": "🏴‍☠️ 해적 프리깃",
    "es": "🏴‍☠️ Fragata Pirata",
    "de": "🏴‍☠️ Piraten-Fregatte",
    "fr": "🏴‍☠️ Frégate Pirate",
    "ar": "🏴‍☠️ فرقاطة القراصنة"
  },
  "spanish_galleon": {
    "en": "🇪🇸 Spanish Galleon",
    "zh": "🇪🇸 西班牙大帆船",
    "ja": "🇪🇸 スペインのガレオン船",
    "ko": "🇪🇸 스페인 갤리온",
    "es": "🇪🇸 Galeón Español",
    "de": "🇪🇸 Spanische Galeone",
    "fr": "🇪🇸 Galion Espagnol",
    "ar": "🇪🇸 جاليون إسباني"
  },
  "chinese_treasure_ship": {
    "en": "🏮 Chinese Treasure Ship",
    "zh": "🏮 中国宝船",
    "ja": "🏮 中国の宝船",
    "ko": "🏮 중국 보물선",
    "es": "🏮 Barco del Tesoro Chino",
    "de": "🏮 Chinesisches Schatzschiff",
    "fr": "🏮 Bateau-Trésor Chinois",
    "ar": "🏮 سفينة الكنز الصينية"
  },
  "british_man_of_war": {
    "en": "🇬🇧 British Man-of-War",
    "zh": "🇬🇧 英国战舰",
    "ja": "🇬🇧 イギリス戦艦",
    "ko": "🇬🇧 영국 전함",
    "es": "🇬🇧 Navío de Guerra Británico",
    "de": "🇬🇧 Britisches Kriegsschiff",
    "fr": "🇬🇧 Vaisseau de Guerre Britannique",
    "ar": "🇬🇧 سفينة حربية بريطانية"
  },
  "missile_destroyer": {
    "en": "🚀 Modern Destroyer",
    "zh": "🚀 现代驱逐舰",
    "ja": "🚀 現代駆逐艦",
    "ko": "🚀 현대 구축함",
    "es": "🚀 Destructor Moderno",
    "de": "🚀 Moderner Zerstörer",
    "fr": "🚀 Destroyer Moderne",
    "ar": "🚀 مدمرة حديثة"
  },
  "aircraft_carrier": {
    "en": "✈️ Aircraft Carrier",
    "zh": "✈️ 航空母舰",
    "ja": "✈️ 航空母艦",
    "ko": "✈️ 항공모함",
    "es": "✈️ Portaaviones",
    "de": "✈️ Flugzeugträger",
    "fr": "✈️ Porte-Avions",
    "ar": "✈️ حاملة طائرات"
  },
  "attack_submarine": {
    "en": "🔱 Submarine",
    "zh": "🔱 潜水艇",
    "ja": "🔱 潜水艦",
    "ko": "🔱 잠수함",
    "es": "🔱 Submarino",
    "de": "🔱 U-Boot",
    "fr": "🔱 Sous-Marin",
    "ar": "🔱 غواصة"
  },
  "guided_missile_cruiser": {
    "en": "⚡ Missile Cruiser",
    "zh": "⚡ 导弹巡洋舰",
    "ja": "⚡ ミサイル巡洋艦",
    "ko": "⚡ 미사일 순양함",
    "es": "⚡ Crucero de Misiles",
    "de": "⚡ Raketenkreuzer",
    "fr": "⚡ Croiseur à Missiles",
    "ar": "⚡ طراد صاروخي"
  },
  "stealth_frigate": {
    "en": "🌊 Stealth Frigate",
    "zh": "🌊 隐身护卫舰",
    "ja": "🌊 ステルスフリゲート",
    "ko": "🌊 스텔스 프리깃",
    "es": "🌊 Fragata Furtiva",
    "de": "🌊 Tarnkappen-Fregatte",
    "fr": "🌊 Frégate Furtive",
    "ar": "🌊 فرقاطة شبح"
  },

  // 蓝图变产品模板缺失翻译
  "luxury_watch": {
    "en": "⌚ Luxury Watch",
    "zh": "⌚ 豪华手表",
    "ja": "⌚ 高級腕時計",
    "ko": "⌚ 명품 시계",
    "es": "⌚ Reloj de Lujo",
    "de": "⌚ Luxusuhr",
    "fr": "⌚ Montre de Luxe",
    "ar": "⌚ ساعة فاخرة"
  },
  "sports_car": {
    "en": "🏎️ Sports Car",
    "zh": "🏎️ 跑车",
    "ja": "🏎️ スポーツカー",
    "ko": "🏎️ 스포츠카",
    "es": "🏎️ Auto Deportivo",
    "de": "🏎️ Sportwagen",
    "fr": "🏎️ Voiture de Sport",
    "ar": "🏎️ سيارة رياضية"
  },
  "smartphone": {
    "en": "📱 Smartphone",
    "zh": "📱 智能手机",
    "ja": "📱 スマートフォン",
    "ko": "📱 스마트폰",
    "es": "📱 Smartphone",
    "de": "📱 Smartphone",
    "fr": "📱 Smartphone",
    "ar": "📱 هاتف ذكي"
  },
  "transformer": {
    "en": "🤖 Transformer Robot",
    "zh": "🤖 变形金刚",
    "ja": "🤖 トランスフォーマー",
    "ko": "🤖 트랜스포머",
    "es": "🤖 Robot Transformer",
    "de": "🤖 Transformer-Roboter",
    "fr": "🤖 Robot Transformer",
    "ar": "🤖 روبوت المحولات"
  },
  "time_machine": {
    "en": "🔮 Time Machine",
    "zh": "🔮 时光机器",
    "ja": "🔮 タイムマシン",
    "ko": "🔮 타임머신",
    "es": "🔮 Máquina del Tiempo",
    "de": "🔮 Zeitmaschine",
    "fr": "🔮 Machine à Remonter le Temps",
    "ar": "🔮 آلة الزمن"
  },
  "dna_robot": {
    "en": "🧬 DNA Robot",
    "zh": "🧬 DNA机器人",
    "ja": "🧬 DNAロボット",
    "ko": "🧬 DNA 로봇",
    "es": "🧬 Robot ADN",
    "de": "🧬 DNA-Roboter",
    "fr": "🧬 Robot ADN",
    "ar": "🧬 روبوت الحمض النووي"
  },
  "mechanical_dragon": {
    "en": "🐉 Mechanical Dragon",
    "zh": "🐉 机械龙",
    "ja": "🐉 機械ドラゴン",
    "ko": "🐉 기계 용",
    "es": "🐉 Dragón Mecánico",
    "de": "🐉 Mechanischer Drache",
    "fr": "🐉 Dragon Mécanique",
    "ar": "🐉 تنين آلي"
  },

  // 海洋自拍惊喜模板缺失翻译
  "megalodon": {
    "en": "🦈 Megalodon",
    "zh": "🦈 巨齿鲨",
    "ja": "🦈 メガロドン",
    "ko": "🦈 메갈로돈",
    "es": "🦈 Megalodón",
    "de": "🦈 Megalodon",
    "fr": "🦈 Mégalodon",
    "ar": "🦈 ميجالودون"
  },
  "great_white": {
    "en": "🦈 Great White Shark",
    "zh": "🦈 大白鲨",
    "ja": "🦈 ホオジロザメ",
    "ko": "🦈 백상아리",
    "es": "🦈 Tiburón Blanco",
    "de": "🦈 Weißer Hai",
    "fr": "🦈 Grand Requin Blanc",
    "ar": "🦈 قرش أبيض كبير"
  },
  "shark": {
    "en": "🦈 Shark",
    "zh": "🦈 鲨鱼",
    "ja": "🦈 サメ",
    "ko": "🦈 상어",
    "es": "🦈 Tiburón",
    "de": "🦈 Hai",
    "fr": "🦈 Requin",
    "ar": "🦈 قرش"
  },
  "giant_crocodile": {
    "en": "🐊 Giant Crocodile",
    "zh": "🐊 巨型鳄鱼",
    "ja": "🐊 巨大ワニ",
    "ko": "🐊 거대 악어",
    "es": "🐊 Cocodrilo Gigante",
    "de": "🐊 Riesenkrokodil",
    "fr": "🐊 Crocodile Géant",
    "ar": "🐊 تمساح عملاق"
  },
  "giant_squid": {
    "en": "🦑 Giant Squid",
    "zh": "🦑 巨型乌贼",
    "ja": "🦑 ダイオウイカ",
    "ko": "🦑 대왕오징어",
    "es": "🦑 Calamar Gigante",
    "de": "🦑 Riesenkalmar",
    "fr": "🦑 Calmar Géant",
    "ar": "🦑 حبار عملاق"
  },
  "female_influencer": {
    "en": "💃 Female Influencer",
    "zh": "💃 女性网红",
    "ja": "💃 女性インフルエンサー",
    "ko": "💃 여성 인플루언서",
    "es": "💃 Influencer Femenina",
    "de": "💃 Weibliche Influencerin",
    "fr": "💃 Influenceuse",
    "ar": "💃 مؤثرة أنثى"
  },
  "male_influencer": {
    "en": "🕺 Male Influencer",
    "zh": "🕺 男性网红",
    "ja": "🕺 男性インフルエンサー",
    "ko": "🕺 남성 인플루언서",
    "es": "🕺 Influencer Masculino",
    "de": "🕺 Männlicher Influencer",
    "fr": "🕺 Influenceur",
    "ar": "🕺 مؤثر ذكر"
  },
  "bigfoot": {
    "en": "🦶 Bigfoot",
    "zh": "🦶 大脚怪",
    "ja": "🦶 ビッグフット",
    "ko": "🦶 빅풋",
    "es": "🦶 Pie Grande",
    "de": "🦶 Bigfoot",
    "fr": "🦶 Bigfoot",
    "ar": "🦶 بيغ فوت"
  },
  "yeti": {
    "en": "❄️ Yeti",
    "zh": "❄️ 雪人",
    "ja": "❄️ イエティ",
    "ko": "❄️ 예티",
    "es": "❄️ Yeti",
    "de": "❄️ Yeti",
    "fr": "❄️ Yéti",
    "ar": "❄️ يتي"
  },
  "tourist": {
    "en": "📸 Tourist",
    "zh": "📸 游客",
    "ja": "📸 観光客",
    "ko": "📸 관광객",
    "es": "📸 Turista",
    "de": "📸 Tourist",
    "fr": "📸 Touriste",
    "ar": "📸 سائح"
  },

  // 额外的标签翻译
  "Product Type": {
    "en": "Product Type",
    "zh": "产品类型",
    "ja": "製品タイプ",
    "ko": "제품 유형",
    "es": "Tipo de Producto",
    "de": "Produkttyp",
    "fr": "Type de Produit",
    "ar": "نوع المنتج"
  },
  "Ship Type": {
    "en": "Ship Type",
    "zh": "船舶类型",
    "ja": "船の種類",
    "ko": "선박 유형",
    "es": "Tipo de Barco",
    "de": "Schiffstyp",
    "fr": "Type de Navire",
    "ar": "نوع السفينة"
  },
  "Marine Predator": {
    "en": "Marine Predator",
    "zh": "海洋捕食者",
    "ja": "海洋捕食者",
    "ko": "바다 포식자",
    "es": "Depredador Marino",
    "de": "Meeresraubtier",
    "fr": "Prédateur Marin",
    "ar": "مفترس بحري"
  },
  "Character Style": {
    "en": "Character Style",
    "zh": "角色风格",
    "ja": "キャラクタースタイル",
    "ko": "캐릭터 스타일",
    "es": "Estilo de Personaje",
    "de": "Charakterstil",
    "fr": "Style de Personnage",
    "ar": "نمط الشخصية"
  },
  "Dialogue Content": {
    "en": "Dialogue Content",
    "zh": "对话内容",
    "ja": "対話内容",
    "ko": "대화 내용",
    "es": "Contenido del Diálogo",
    "de": "Dialog-Inhalt",
    "fr": "Contenu du Dialogue",
    "ar": "محتوى الحوار"
  },
  "Ending Text": {
    "en": "Ending Text",
    "zh": "结尾文字",
    "ja": "エンディングテキスト",
    "ko": "엔딩 텍스트",
    "es": "Texto Final",
    "de": "Abschlusstext",
    "fr": "Texte de Fin",
    "ar": "النص النهائي"
  },
  "Custom Text": {
    "en": "Custom Text",
    "zh": "自定义文字",
    "ja": "カスタムテキスト",
    "ko": "맞춤 텍스트",
    "es": "Texto Personalizado",
    "de": "Benutzerdefinierter Text",
    "fr": "Texte Personnalisé",
    "ar": "نص مخصص"
  },

  // 其他常用词汇
  "fast": {
    "en": "Fast ⚡",
    "zh": "快速 ⚡",
    "ja": "高速 ⚡",
    "ko": "빠름 ⚡",
    "es": "Rápido ⚡",
    "de": "Schnell ⚡",
    "fr": "Rapide ⚡",
    "ar": "سريع ⚡"
  },
  "slow": {
    "en": "Slow 🐌",
    "zh": "缓慢 🐌",
    "ja": "遅い 🐌",
    "ko": "느림 🐌",
    "es": "Lento 🐌",
    "de": "Langsam 🐌",
    "fr": "Lent 🐌",
    "ar": "بطيء 🐌"
  },
  "small": {
    "en": "Small",
    "zh": "小",
    "ja": "小さい",
    "ko": "작은",
    "es": "Pequeño",
    "de": "Klein",
    "fr": "Petit",
    "ar": "صغير"
  },
  "medium": {
    "en": "Medium",
    "zh": "中等",
    "ja": "中程度",
    "ko": "보통",
    "es": "Mediano",
    "de": "Mittel",
    "fr": "Moyen",
    "ar": "متوسط"
  },
  "large": {
    "en": "Large",
    "zh": "大",
    "ja": "大きい",
    "ko": "큰",
    "es": "Grande",
    "de": "Groß",
    "fr": "Grand",
    "ar": "كبير"
  }
};

// 智能翻译生成函数
function generateTranslation(value, originalLabel) {
  // 首先检查翻译数据库
  if (translationDatabase[value]) {
    return translationDatabase[value];
  }
  
  // 检查是否为已知的英文标签（原始label）
  if (translationDatabase[originalLabel]) {
    return translationDatabase[originalLabel];
  }
  
  // 如果翻译数据库中没有，输出警告并跳过
  console.warn(`⚠️  翻译缺失: "${value}" (标签: "${originalLabel}")`);
  console.warn(`   请在翻译数据库中添加此项的翻译`);
  
  // 返回null表示需要手动添加翻译，不生成无效占位符
  return null;
}

// 处理单个选项
function processOption(option) {
  if (typeof option.label === 'object') {
    // 已经是多语言格式，检查是否需要修复错误的翻译
    const correctTranslation = generateTranslation(option.value, option.label.en || option.value);
    
    if (correctTranslation) {
      // 检查是否有错误的翻译（比如中文位置显示英文）
      const needsUpdate = Object.keys(correctTranslation).some(lang => {
        if (lang === 'en') return false;
        const currentTranslation = option.label[lang];
        const correctValue = correctTranslation[lang];
        // 检查是否包含英文单词或者是不正确的翻译
        return currentTranslation && (
          currentTranslation.includes(option.value + ' ') || 
          currentTranslation === option.value + ' ' + (currentTranslation.match(/\p{Emoji}/u)?.[0] || '') ||
          currentTranslation.trim() === option.value
        );
      });
      
      if (needsUpdate) {
        return {
          ...option,
          label: correctTranslation
        };
      }
    }
    
    return option;
  }
  
  // 转换为多语言格式
  const translation = generateTranslation(option.value, option.label);
  
  if (!translation) {
    return option; // 如果没有翻译，保持原样
  }
  
  return {
    ...option,
    label: translation
  };
}

// 处理单个模板文件
async function processTemplateFile(filePath) {
  try {
    console.log(`📄 处理模板文件: ${path.basename(filePath)}`);
    
    const content = await fs.readFile(filePath, 'utf8');
    const template = JSON.parse(content);
    
    let hasChanges = false;
    
    // 检查是否有params
    if (template.params) {
      for (const [paramKey, param] of Object.entries(template.params)) {
        // 处理参数标签的多语言化
        if (typeof param.label === 'string' && translationDatabase[param.label]) {
          param.label = translationDatabase[param.label];
          hasChanges = true;
        }
        
        // 只处理select类型的参数选项
        if (param.type === 'select' && param.options) {
          for (let i = 0; i < param.options.length; i++) {
            const originalOption = param.options[i];
            const processedOption = processOption(originalOption);
            
            // 检查是否有变化
            if (JSON.stringify(originalOption) !== JSON.stringify(processedOption)) {
              param.options[i] = processedOption;
              hasChanges = true;
            }
          }
        }
      }
    }
    
    // 如果有变化，写回文件
    if (hasChanges) {
      // 更新lastModified字段
      template.lastModified = new Date().toISOString();
      
      // 格式化JSON并写回文件
      const formattedContent = JSON.stringify(template, null, 2);
      await fs.writeFile(filePath, formattedContent, 'utf8');
      
      console.log(`✅ 已更新: ${path.basename(filePath)}`);
      return true;
    } else {
      console.log(`⏭️  跳过 (已是多语言): ${path.basename(filePath)}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error.message);
    return false;
  }
}

// 主处理函数
async function processAllTemplates() {
  const templatesDir = path.join(__dirname, 'src/features/video-creator/data/templates');
  
  try {
    const files = await fs.readdir(templatesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`📁 找到 ${jsonFiles.length} 个模板文件`);
    
    let processedCount = 0;
    let updatedCount = 0;
    
    for (const file of jsonFiles) {
      const filePath = path.join(templatesDir, file);
      const wasUpdated = await processTemplateFile(filePath);
      
      processedCount++;
      if (wasUpdated) {
        updatedCount++;
      }
    }
    
    console.log('\n🎉 处理完成!');
    console.log(`📊 统计: 处理了 ${processedCount} 个文件，更新了 ${updatedCount} 个文件`);
    
    return { processedCount, updatedCount };
    
  } catch (error) {
    console.error('❌ 批量处理失败:', error);
    throw error;
  }
}

// 执行主流程
if (import.meta.url === `file://${process.argv[1]}`) {
  processAllTemplates()
    .then((result) => {
      console.log('\n✨ 全量模板多语言选项修复完成!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 处理过程中出现错误:', error);
      process.exit(1);
    });
}

export { processAllTemplates, translationDatabase };