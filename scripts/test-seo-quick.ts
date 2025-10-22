/**
 * SEO评分系统快速测试
 * 仅测试算法层，不依赖浏览器环境
 */

// 导入核心函数和类型
import { calculateSEOFacts, type SEOContent } from '../src/services/seoFactsCalculator'

// 测试内容
const testContent: SEOContent = {
  meta_title: "Create ASMR Food Videos: Complete Guide for Beginners (2025)",
  meta_description: "Learn how to create relaxing ASMR food videos with our step-by-step tutorial. Discover the best equipment, techniques, and tips to start your ASMR channel today.",
  guide_intro: `ASMR food videos have become incredibly popular on platforms like YouTube and TikTok. These videos feature the soothing sounds of food preparation and consumption, triggering the relaxing ASMR response in viewers. If you're interested in creating your own ASMR food videos, this comprehensive guide will walk you through everything you need to know.`,
  guide_content: `## What Are ASMR Food Videos?

ASMR (Autonomous Sensory Meridian Response) food videos are a unique genre of content that combines the visual appeal of food with the relaxing sounds of cooking and eating. These videos typically feature close-up shots of food preparation, emphasizing sounds like chopping, stirring, and crunching. Creating ASMR food videos requires attention to audio quality and visual presentation.

## Essential Equipment for ASMR Food Videos

To create high-quality ASMR food videos, you'll need the right equipment:

### Camera Setup
- High-resolution camera (4K recommended)
- Macro lens for close-up food shots
- Stable tripod or gimbal

### Audio Equipment
- Sensitive microphone (condenser mic recommended)
- Pop filter to reduce unwanted sounds
- Audio interface for better sound quality

### Lighting
- Soft box lights for even illumination
- Ring light for overhead shots
- Natural lighting can work well too

## Step-by-Step Tutorial

### 1. Choose Your Food
Select foods that create interesting sounds and visuals. Popular choices include:
- Crunchy vegetables
- Crispy fried foods
- Honeycomb and other sticky foods

### 2. Set Up Your Equipment
Position your camera to capture close-up shots. Place the microphone close to the food source without blocking the view. Ensure proper lighting to make the food look appetizing.

### 3. Record Multiple Takes
Don't expect perfection on the first try. Record multiple takes to capture the best sounds and visuals. Experiment with different angles and distances.

### 4. Edit Carefully
When editing ASMR food videos, focus on:
- Enhancing audio quality
- Removing background noise
- Creating smooth transitions
- Maintaining consistent pacing

### 5. Optimize for Your Platform
Different platforms have different requirements. For YouTube, longer videos (15-30 minutes) work well. For TikTok, keep it under 60 seconds.

## Best Practices

1. **Minimize Background Noise**: Record in a quiet environment
2. **Use Quality Ingredients**: Fresh food looks and sounds better
3. **Be Patient**: Good ASMR food videos take time to perfect
4. **Stay Consistent**: Regular uploads help build an audience
5. **Engage with Viewers**: Respond to comments and take suggestions

## Common Challenges

### Audio Issues
Poor audio quality is the most common problem. Invest in a good microphone and learn basic audio editing.

### Lighting Problems
Inconsistent lighting can ruin the visual appeal. Use multiple light sources and test different setups.

### Viewer Engagement
Building an audience takes time. Focus on quality over quantity and be patient with growth.

## Conclusion

Creating ASMR food videos is a rewarding creative pursuit that combines artistry with technical skill. By following this guide and practicing regularly, you'll be able to produce professional-quality content that viewers love. Remember to experiment with different foods, sounds, and techniques to find your unique style. Start creating your ASMR food videos today and share the relaxing experience with others!`,
  faq_items: [
    {
      question: "What is the best microphone for ASMR food videos?",
      answer: "A condenser microphone is ideal for ASMR food videos because it captures subtle sounds with great detail. Popular choices include the Blue Yeti, Rode NT1-A, and Audio-Technica AT2020. Position the microphone 6-12 inches from the food for optimal sound capture."
    },
    {
      question: "How long should ASMR food videos be?",
      answer: "The ideal length depends on your platform. For YouTube, 15-30 minutes works well as viewers often use these videos for relaxation. For TikTok and Instagram, keep videos under 60 seconds. Always prioritize quality over length."
    },
    {
      question: "Do I need expensive equipment to start?",
      answer: "No, you can start with a smartphone camera and a basic external microphone. Many successful ASMR creators began with minimal equipment. As you grow, gradually invest in better gear. Focus on learning techniques first."
    },
    {
      question: "What foods work best for ASMR videos?",
      answer: "Foods that create distinct sounds work best. Crunchy vegetables like cucumbers and carrots, crispy fried foods, sticky foods like honeycomb, and foods with interesting textures all work well. Experiment to find what sounds best with your equipment."
    },
    {
      question: "How do I reduce background noise in my recordings?",
      answer: "Record in a quiet room away from traffic and appliances. Use acoustic foam panels on walls to dampen sound reflections. Turn off fans and air conditioning during recording. In post-production, use noise reduction software to clean up the audio."
    }
  ],
  target_keyword: "ASMR food videos",
  language: "en"
}

async function main() {
  console.log('='.repeat(80))
  console.log('测试SEO评分系统 - 算法层')
  console.log('='.repeat(80))
  console.log()

  const startTime = Date.now()

  console.log('⚡ 计算SEO事实数据...')
  const facts = calculateSEOFacts(testContent)

  const elapsed = Date.now() - startTime

  console.log(`✅ 计算完成（${elapsed}ms）`)
  console.log()

  // Meta信息分析
  console.log('📊 Meta信息分析:')
  console.log('  标题长度:', facts.meta.titleLength, '字符')
  console.log('  标题包含关键词:', facts.meta.titleHasKeyword ? '是' : '否')
  console.log('  关键词在标题位置:', facts.meta.titleKeywordPosition === -1 ? '不包含' : facts.meta.titleKeywordPosition)
  console.log('  描述长度:', facts.meta.descLength, '字符')
  console.log('  描述包含关键词:', facts.meta.descHasKeyword ? '是' : '否')
  console.log('  描述包含CTA:', facts.meta.descHasCTA ? '是' : '否')
  if (facts.meta.ctaType) {
    console.log('  CTA类型:', facts.meta.ctaType)
  }
  console.log()

  // 内容统计
  console.log('📝 内容统计:')
  console.log('  总字数:', facts.content.totalWords)
  console.log('  段落数:', facts.content.paragraphCount)
  console.log('  H2标题数:', facts.content.h2Count)
  console.log('  H3标题数:', facts.content.h3Count)
  console.log('  列表数:', facts.content.listCount)
  console.log('  代码块数:', facts.content.codeBlockCount)
  console.log()

  // 关键词分析
  console.log('🔑 关键词分析:')
  console.log('  主关键词:', facts.keywords.primary.keyword)
  console.log('  出现次数:', facts.keywords.primary.count)
  console.log('  密度:', facts.keywords.primary.density, '%')
  console.log('  在标题中:', facts.keywords.primary.inTitle ? '是' : '否')
  console.log('  在首段:', facts.keywords.primary.inFirstParagraph ? '是' : '否')
  console.log('  在末段:', facts.keywords.primary.inLastParagraph ? '是' : '否')
  console.log('  在H2标题中:', facts.keywords.primary.inH2Count, '次')
  console.log('  在H3标题中:', facts.keywords.primary.inH3Count, '次')
  console.log()

  // 可读性
  console.log('📖 可读性:')
  console.log('  Flesch分数:', facts.readability.fleschScore.toFixed(1))
  console.log('  总句子数:', facts.readability.totalSentences)
  console.log('  平均句子长度:', facts.readability.avgSentenceLength.toFixed(1), '单词')
  console.log('  平均单词长度:', facts.readability.avgWordLength.toFixed(1), '字符')
  console.log('  复杂词数量:', facts.readability.complexWordCount)
  console.log('  复杂词比例:', (facts.readability.complexWordRatio * 100).toFixed(1), '%')
  console.log()

  // 用户体验
  console.log('👥 用户体验:')
  console.log('  FAQ数量:', facts.ux.faqCount)
  console.log('  内部链接:', facts.ux.internalLinkCount)
  console.log('  外部链接:', facts.ux.externalLinkCount)
  console.log()

  // 生成简单评分（基于算法事实）
  // Meta (20分): 标题长度理想50-60 + 描述长度理想150-160 + 关键词位置
  const metaScore = Math.min(20,
    (facts.meta.titleLength >= 50 && facts.meta.titleLength <= 60 ? 7 : 3) +
    (facts.meta.descLength >= 150 && facts.meta.descLength <= 160 ? 7 : 3) +
    (facts.meta.titleHasKeyword ? 3 : 0) +
    (facts.meta.descHasKeyword ? 3 : 0)
  )

  // Content (30分): 字数理想≥1500
  const contentScore = Math.min(30, Math.floor(facts.content.totalWords / 50))

  // Keyword (20分): 密度理想1-2%
  const keywordScore = Math.min(20,
    (facts.keywords.primary.density >= 1 && facts.keywords.primary.density <= 2 ? 15 : 5) +
    (facts.keywords.primary.inTitle ? 2 : 0) +
    (facts.keywords.primary.inH2Count > 0 ? 3 : 0)
  )

  // Readability (20分): Flesch≥60
  const readabilityScore = Math.min(20, Math.floor(facts.readability.fleschScore / 5))

  // UX (10分): FAQ≥5
  const uxScore = Math.min(10, facts.ux.faqCount * 2)

  const totalScore = metaScore + contentScore + keywordScore + readabilityScore + uxScore

  console.log('='.repeat(80))
  console.log('📊 算法评分结果:')
  console.log('  Meta信息质量:', metaScore, '/20')
  console.log('  内容质量:', contentScore, '/30')
  console.log('  关键词优化:', keywordScore, '/20')
  console.log('  可读性:', readabilityScore, '/20')
  console.log('  用户体验:', uxScore, '/10')
  console.log()
  console.log('  总分:', totalScore, '/100')
  console.log('='.repeat(80))
  console.log()

  console.log('✅ 算法层测试完成！')
  console.log()
  console.log('说明:')
  console.log('- 这是纯算法评分（不使用AI）')
  console.log('- 100%确定性结果，相同输入总是相同输出')
  console.log('- 速度快（<200ms），零成本')
  console.log('- 完整的三层评分系统请参考文档 docs/SEO_SCORING_SYSTEM_V2.md')
}

main().catch(console.error)
