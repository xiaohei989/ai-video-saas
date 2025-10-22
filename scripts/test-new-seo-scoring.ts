/**
 * 测试新的SEO评分系统
 * 验证算法+AI+验证三层架构是否正常工作
 */

import { quickScoreSEO, fullScoreSEO } from '../src/services/seoScoringEngine'
import type { SEOContent } from '../src/services/seoFactsCalculator'

// 测试内容：一个中等质量的ASMR视频指南
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
  console.log('测试新的SEO评分系统')
  console.log('='.repeat(80))
  console.log()

  // ==================== 测试1：快速评分（仅算法） ====================
  console.log('📊 测试1：快速评分（仅算法，约150ms）')
  console.log('-'.repeat(80))

  const quickStart = Date.now()
  const quickResult = await quickScoreSEO(testContent)
  const quickTime = Date.now() - quickStart

  console.log(`✅ 快速评分完成（${quickTime}ms）`)
  console.log()
  console.log('总分:', quickResult.total_score, '/100')
  console.log()
  console.log('各维度分数:')
  console.log('  Meta信息质量:', quickResult.dimension_scores.meta_quality, '/20')
  console.log('  内容质量:', quickResult.dimension_scores.content_quality, '/30')
  console.log('  关键词优化:', quickResult.dimension_scores.keyword_optimization, '/20')
  console.log('  可读性:', quickResult.dimension_scores.readability, '/20')
  console.log('  用户体验:', quickResult.dimension_scores.ux, '/10')
  console.log()
  console.log('关键算法事实:')
  console.log('  总字数:', quickResult.facts.content.totalWords)
  console.log('  关键词密度:', quickResult.facts.keywords.primary.density, '%')
  console.log('  Flesch可读性:', quickResult.facts.readability.fleschScore)
  console.log('  FAQ数量:', quickResult.facts.ux.faqCount)
  console.log()
  console.log('性能数据:')
  console.log('  算法计算:', quickResult.performance.facts_calculation_ms, 'ms')
  console.log('  AI分析:', quickResult.performance.ai_analysis_ms, 'ms (已跳过)')
  console.log('  交叉验证:', quickResult.performance.validation_ms, 'ms')
  console.log('  总耗时:', quickResult.performance.total_ms, 'ms')
  console.log()

  // ==================== 测试2：完整评分（算法+AI+验证） ====================
  console.log()
  console.log('='.repeat(80))
  console.log('🤖 测试2：完整评分（算法+AI+验证，约20-40秒）')
  console.log('-'.repeat(80))
  console.log()
  console.log('⏳ 正在调用AI进行深度分析...')
  console.log('   （这需要20-40秒，请稍候）')
  console.log()

  try {
    const fullStart = Date.now()
    const fullResult = await fullScoreSEO(testContent, 'claude')
    const fullTime = Date.now() - fullStart

    console.log(`✅ 完整评分完成（${(fullTime / 1000).toFixed(1)}秒）`)
    console.log()
    console.log('总分:', fullResult.total_score, '/100')
    console.log('置信度:', fullResult.confidence.overall, '%')
    console.log('需要人工复核:', fullResult.requires_manual_review ? '是' : '否')
    console.log()
    console.log('各维度分数 & 置信度:')
    console.log('  Meta信息质量:', fullResult.dimension_scores.meta_quality, '/20', `(置信度: ${fullResult.confidence.meta_quality}%)`)
    console.log('  内容质量:', fullResult.dimension_scores.content_quality, '/30', `(置信度: ${fullResult.confidence.content_quality}%)`)
    console.log('  关键词优化:', fullResult.dimension_scores.keyword_optimization, '/20', `(置信度: ${fullResult.confidence.keyword_optimization}%)`)
    console.log('  可读性:', fullResult.dimension_scores.readability, '/20', `(置信度: ${fullResult.confidence.readability}%)`)
    console.log('  用户体验:', fullResult.dimension_scores.ux, '/10', `(置信度: ${fullResult.confidence.ux}%)`)
    console.log()

    if (fullResult.top_strengths.length > 0) {
      console.log('💪 内容优势:')
      fullResult.top_strengths.forEach((strength, i) => {
        console.log(`  ${i + 1}. ${strength}`)
      })
      console.log()
    }

    if (fullResult.critical_issues.length > 0) {
      console.log('⚠️  关键问题:')
      fullResult.critical_issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.issue}`)
        console.log(`      影响: ${issue.impact}`)
        console.log(`      修复: ${issue.fix}`)
      })
      console.log()
    }

    if (fullResult.conflicts.length > 0) {
      console.log('🔍 检测到的冲突:')
      fullResult.conflicts.forEach((conflict, i) => {
        console.log(`  ${i + 1}. ${conflict.dimension}`)
        console.log(`      算法建议: ${conflict.algorithm_suggests}分`)
        console.log(`      AI评分: ${conflict.ai_score}分`)
        console.log(`      原因: ${conflict.reason}`)
        console.log(`      自动解决: ${conflict.auto_resolved ? '是' : '否'}`)
        if (conflict.resolution) {
          console.log(`      解决方案: ${conflict.resolution}`)
        }
      })
      console.log()
    }

    if (fullResult.validation_warnings.length > 0) {
      console.log('⚠️  验证警告:')
      fullResult.validation_warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`)
      })
      console.log()
    }

    console.log('📈 性能数据:')
    console.log('  算法计算:', fullResult.performance.facts_calculation_ms, 'ms')
    console.log('  AI分析:', fullResult.performance.ai_analysis_ms, 'ms')
    console.log('  交叉验证:', fullResult.performance.validation_ms, 'ms')
    console.log('  总耗时:', fullResult.performance.total_ms, 'ms')
    console.log()

    // ==================== 对比快速评分和完整评分 ====================
    console.log()
    console.log('='.repeat(80))
    console.log('📊 快速评分 vs 完整评分对比')
    console.log('-'.repeat(80))
    console.log()
    console.log('总分差异:', fullResult.total_score - quickResult.total_score, '分')
    console.log('耗时差异:', (fullResult.performance.total_ms - quickResult.performance.total_ms) / 1000, '秒')
    console.log()
    console.log('各维度差异:')
    console.log('  Meta信息:', fullResult.dimension_scores.meta_quality - quickResult.dimension_scores.meta_quality, '分')
    console.log('  内容质量:', fullResult.dimension_scores.content_quality - quickResult.dimension_scores.content_quality, '分')
    console.log('  关键词:', fullResult.dimension_scores.keyword_optimization - quickResult.dimension_scores.keyword_optimization, '分')
    console.log('  可读性:', fullResult.dimension_scores.readability - quickResult.dimension_scores.readability, '分')
    console.log('  用户体验:', fullResult.dimension_scores.ux - quickResult.dimension_scores.ux, '分')
    console.log()
    console.log('✅ 测试完成！新的SEO评分系统运行正常。')
    console.log()

  } catch (error) {
    console.error('❌ 完整评分测试失败:', error)
    console.error()
    console.error('可能的原因:')
    console.error('1. AI服务未配置或不可用')
    console.error('2. 网络连接问题')
    console.error('3. API密钥未设置')
    console.error()
    console.error('建议:')
    console.error('- 检查 .env 文件中的 VITE_APICORE_API_KEY')
    console.error('- 确保网络连接正常')
    console.error('- 或使用快速评分模式（skipAI: true）')
  }
}

// 运行测试
main().catch(console.error)
