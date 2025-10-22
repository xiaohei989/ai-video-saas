/**
 * 测试 SEO 图片生成服务
 *
 * 使用方法:
 * npx tsx scripts/test-seo-image-generation.ts
 */

import { seoImageGenerationService } from '../src/services/seoImageGenerationService'

// 测试用的 Markdown 内容
const testMarkdown = `
# How to Create Amazing TikTok ASMR Videos in 2025

## Introduction

TikTok ASMR videos have become incredibly popular...

![TikTok ASMR video creator setting up professional microphone and lighting equipment in home studio](image-placeholder-1.jpg)

## Equipment Setup

To create high-quality ASMR content, you'll need proper equipment...

![Close-up of Blue Yeti USB microphone with pop filter and shock mount on desk](image-placeholder-2.jpg)

## Recording Techniques

The key to great ASMR is capturing clear, crisp sounds...

![Smartphone screen showing TikTok ASMR video editing interface with waveform timeline and sound effects panel](image-placeholder-3.jpg)

## Conclusion

With the right equipment and techniques, you can create engaging ASMR content...
`

async function testImageGeneration() {
  console.log('🧪 开始测试 SEO 图片生成服务...\n')

  try {
    const result = await seoImageGenerationService.generateImagesForArticle({
      pageVariantId: 'test-id-12345',
      markdown: testMarkdown,
      slug: 'tiktok-asmr-videos-test',
      targetKeyword: 'TikTok ASMR videos'
    })

    console.log('\n✅ 测试完成!')
    console.log('📊 结果统计:')
    console.log(`   总数: ${result.totalCount}`)
    console.log(`   成功: ${result.generatedCount}`)
    console.log(`   失败: ${result.failedCount}`)

    console.log('\n🖼️  生成的图片:')
    result.images.forEach(img => {
      console.log(`   [${img.index}] ${img.status.toUpperCase()}`)
      console.log(`       Alt: ${img.alt.substring(0, 60)}...`)
      if (img.status === 'success') {
        console.log(`       URL: ${img.url}`)
      } else {
        console.log(`       Error: ${img.error}`)
      }
    })

    if (result.updatedMarkdown) {
      console.log('\n📝 更新后的 Markdown (前500字符):')
      console.log(result.updatedMarkdown.substring(0, 500))
      console.log('...')
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

testImageGeneration()
