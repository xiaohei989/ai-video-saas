/**
 * SEO 图片生成服务
 *
 * 功能:
 * 1. 解析 Markdown 内容,提取图片占位符和 alt 文本
 * 2. 使用 Gemini 2.5 Flash Image VIP 生成高质量图片
 * 3. PNG → JPG 转换,压缩优化
 * 4. 上传到 Cloudflare R2 存储
 * 5. 更新数据库 Markdown 内容
 */

import { supabase } from '@/lib/supabase'

// 环境变量获取
const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || ''
  }
  return process.env[key] || ''
}

interface ImagePlaceholder {
  index: number           // 1, 2, 3...
  alt: string             // 完整的 alt 文本
  placeholder: string     // "image-placeholder-1.jpg"
  fullMatch: string       // 完整的 Markdown 语法 "![alt](placeholder)"
}

interface GenerateImagesRequest {
  pageVariantId: string   // seo_page_variants 表的 ID
  markdown: string        // 原始 Markdown 内容
  slug: string            // 关键词 slug (用于文件命名)
  targetKeyword: string   // 目标关键词 (用于提示词)
}

interface GenerateImagesResult {
  success: boolean
  totalCount: number      // 总共需要生成的图片数
  generatedCount: number  // 成功生成的图片数
  failedCount: number     // 失败的图片数
  images: Array<{
    index: number
    alt: string
    url: string
    status: 'success' | 'failed'
    error?: string
  }>
  updatedMarkdown?: string  // 更新后的 Markdown 内容
}

class SEOImageGenerationService {
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly timeout = 30000 // 30秒超时 (图片生成需要时间)

  constructor() {
    this.apiKey = getEnv('VITE_APICORE_API_KEY') || ''
    this.endpoint = getEnv('VITE_APICORE_ENDPOINT') || 'https://api.apicore.ai'

    if (!this.apiKey) {
      console.warn('[SEOImageGen] 警告: 未配置 VITE_APICORE_API_KEY')
    }
  }

  /**
   * 主入口: 为 SEO 文章生成所有图片
   */
  async generateImagesForArticle(request: GenerateImagesRequest): Promise<GenerateImagesResult> {
    console.log(`\n[SEOImageGen] 🎨 开始为文章生成图片...`)
    console.log(`[SEOImageGen] 页面ID: ${request.pageVariantId}`)
    console.log(`[SEOImageGen] 关键词: ${request.targetKeyword}`)

    // 1. 提取图片占位符
    const placeholders = this.extractImagePlaceholders(request.markdown)
    console.log(`[SEOImageGen] 📋 找到 ${placeholders.length} 个图片占位符`)

    if (placeholders.length === 0) {
      console.log(`[SEOImageGen] ⚠️  没有找到图片占位符,跳过生成`)
      return {
        success: true,
        totalCount: 0,
        generatedCount: 0,
        failedCount: 0,
        images: []
      }
    }

    // 2. 逐个生成图片
    const results: GenerateImagesResult['images'] = []
    let successCount = 0
    let failedCount = 0

    for (const placeholder of placeholders) {
      console.log(`\n[SEOImageGen] 🖼️  处理图片 ${placeholder.index}/${placeholders.length}`)
      console.log(`[SEOImageGen] Alt: "${placeholder.alt}"`)

      try {
        // 生成图片并上传到 R2
        const imageUrl = await this.generateAndUploadImage(
          placeholder.alt,
          request.targetKeyword,
          request.slug,
          placeholder.index
        )

        console.log(`[SEOImageGen] ✅ 生成成功: ${imageUrl}`)
        results.push({
          index: placeholder.index,
          alt: placeholder.alt,
          url: imageUrl,
          status: 'success'
        })
        successCount++

      } catch (error) {
        console.error(`[SEOImageGen] ❌ 生成失败:`, error)
        results.push({
          index: placeholder.index,
          alt: placeholder.alt,
          url: '',
          status: 'failed',
          error: error instanceof Error ? error.message : '未知错误'
        })
        failedCount++
      }

      // 避免频繁调用 API,添加 1 秒延迟
      if (placeholder.index < placeholders.length) {
        await this.sleep(1000)
      }
    }

    // 3. 更新 Markdown 内容 (替换占位符为真实 URL)
    let updatedMarkdown = request.markdown
    for (const result of results) {
      if (result.status === 'success') {
        const placeholder = placeholders.find(p => p.index === result.index)
        if (placeholder) {
          updatedMarkdown = updatedMarkdown.replace(
            placeholder.fullMatch,
            `![${result.alt}](${result.url})`
          )
        }
      }
    }

    // 4. 保存到数据库
    if (successCount > 0) {
      console.log(`\n[SEOImageGen] 💾 更新数据库 Markdown 内容...`)
      await this.updateMarkdownInDatabase(request.pageVariantId, updatedMarkdown)
      console.log(`[SEOImageGen] ✅ 数据库已更新`)
    }

    console.log(`\n[SEOImageGen] 🎉 图片生成完成!`)
    console.log(`[SEOImageGen] 成功: ${successCount}, 失败: ${failedCount}`)

    return {
      success: successCount > 0,
      totalCount: placeholders.length,
      generatedCount: successCount,
      failedCount: failedCount,
      images: results,
      updatedMarkdown: updatedMarkdown
    }
  }

  /**
   * 提取 Markdown 中的图片占位符
   * 匹配格式: ![alt text](image-placeholder-1.jpg)
   */
  private extractImagePlaceholders(markdown: string): ImagePlaceholder[] {
    const regex = /!\[(.*?)\]\((image-placeholder-(\d+)\.jpg)\)/g
    const placeholders: ImagePlaceholder[] = []
    let match

    while ((match = regex.exec(markdown)) !== null) {
      placeholders.push({
        index: parseInt(match[3], 10),
        alt: match[1],
        placeholder: match[2],
        fullMatch: match[0]
      })
    }

    // 按 index 排序
    return placeholders.sort((a, b) => a.index - b.index)
  }

  /**
   * 生成图片并上传到 R2
   */
  private async generateAndUploadImage(
    alt: string,
    targetKeyword: string,
    slug: string,
    index: number
  ): Promise<string> {
    // 1. 构建 Gemini 提示词
    const prompt = this.buildImagePrompt(alt, targetKeyword)

    // 2. 调用 Gemini API 生成图片
    const pngUrl = await this.callGeminiImageAPI(prompt)

    // 3. 下载 PNG 图片
    const pngBlob = await this.downloadImage(pngUrl)

    // 4. 转换为 JPG (压缩优化)
    const jpgBlob = await this.convertToJPG(pngBlob, 80)

    // 5. 标准化文件名 (移除空格和特殊字符)
    const sanitizedSlug = this.sanitizeFilename(slug)
    const r2Key = `seo-images/${sanitizedSlug}-${index}.jpg`
    const r2Url = await this.uploadToR2(jpgBlob, r2Key)

    return r2Url
  }

  /**
   * 标准化文件名 (移除空格和特殊字符)
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .toLowerCase()
      .replace(/\s+/g, '-')           // 空格 → 连字符
      .replace(/[^a-z0-9-]/g, '')     // 移除非字母数字和连字符
      .replace(/-+/g, '-')            // 多个连字符 → 单个
      .replace(/^-|-$/g, '')          // 移除首尾连字符
  }

  /**
   * 构建 Gemini 图片生成提示词
   */
  private buildImagePrompt(alt: string, targetKeyword: string): string {
    return `Create a photorealistic, high-quality image for an educational SEO article.

**Scene Description (MUST follow exactly):**
${alt}

**Photography Style:**
- Type: Professional product photography / documentary style photograph
- Lighting: ${this.inferLighting(alt)}
- Composition: ${this.inferComposition(alt)}
- Focus: Sharp focus on main subject, natural depth of field
- Quality: 8K quality, high detail, professional camera

**Visual Requirements:**
- Colors: Natural, vibrant but realistic (avoid oversaturation)
- Perspective: ${this.inferPerspective(alt)}
- **Image Dimensions: MUST be 16:9 landscape format (wider than tall)**
- Target resolution: 640x360 pixels or similar 16:9 ratio
- Frame: Horizontal landscape orientation, NOT square or vertical
- Atmosphere: Clean, professional, educational

**Strict Rules:**
- NO text, watermarks, logos, or UI elements
- NO abstract concepts - show real, tangible objects
- NO square (1:1) or portrait (9:16) formats - ONLY 16:9 landscape
- MUST include every detail mentioned in the scene description
- Every object, color, and position mentioned MUST be visible
- Recreate the exact scene described above in WIDE HORIZONTAL FORMAT

**Context:**
This image illustrates a tutorial about "${targetKeyword}".
The image must be informative, accurate, and help readers understand the topic visually.

**Critical:** Follow the scene description EXACTLY. If it mentions "Blue Yeti microphone", show that specific microphone. If it says "wooden desk", use a wooden desk. Every detail matters.`
  }

  /**
   * 根据 alt 文本推断光线类型
   */
  private inferLighting(alt: string): string {
    const lower = alt.toLowerCase()
    if (lower.includes('natural') || lower.includes('daylight') || lower.includes('window')) {
      return 'Natural daylight from window, soft and balanced'
    }
    if (lower.includes('studio') || lower.includes('ring light') || lower.includes('led')) {
      return 'Professional studio lighting, soft diffused LED panels'
    }
    if (lower.includes('dark') || lower.includes('night') || lower.includes('ambient')) {
      return 'Warm ambient lighting, low key with controlled shadows'
    }
    return 'Bright, even lighting with soft shadows'
  }

  /**
   * 根据 alt 文本推断构图类型
   */
  private inferComposition(alt: string): string {
    const lower = alt.toLowerCase()
    if (lower.includes('close-up') || lower.includes('closeup') || lower.includes('macro')) {
      return 'Close-up shot, tight framing with shallow depth of field'
    }
    if (lower.includes('overhead') || lower.includes('flat lay') || lower.includes('top view')) {
      return 'Overhead flat lay composition, symmetrical arrangement'
    }
    if (lower.includes('side view') || lower.includes('profile')) {
      return 'Side profile view, clear subject separation from background'
    }
    if (lower.includes('setup') || lower.includes('workspace') || lower.includes('wide')) {
      return 'Wide angle environmental shot showing full context'
    }
    return 'Balanced composition with clear focal point, rule of thirds'
  }

  /**
   * 根据 alt 文本推断拍摄角度
   */
  private inferPerspective(alt: string): string {
    const lower = alt.toLowerCase()
    if (lower.includes('front') || lower.includes('straight')) {
      return 'Straight-on frontal perspective, eye-level view'
    }
    if (lower.includes('overhead') || lower.includes('top')) {
      return "Directly overhead, bird's eye view"
    }
    if (lower.includes('angle') || lower.includes('side')) {
      return '45-degree angle view showing depth and dimension'
    }
    if (lower.includes('low angle')) {
      return 'Low angle looking up, dramatic perspective'
    }
    return 'Natural eye-level perspective, slight angle for depth'
  }

  /**
   * 调用 Gemini Image API
   */
  private async callGeminiImageAPI(prompt: string): Promise<string> {
    console.log(`[SEOImageGen] 🤖 调用 Gemini API...`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash-image-vip',
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: 1000
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Gemini API 返回错误: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content

      // 提取图片 URL (格式: ![image](https://...))
      const imageUrlMatch = content.match(/!\[.*?\]\((https:\/\/.*?)\)/)
      if (!imageUrlMatch) {
        throw new Error('未能从响应中提取图片 URL')
      }

      return imageUrlMatch[1]

    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Gemini API 请求超时')
      }
      throw error
    }
  }

  /**
   * 下载图片
   */
  private async downloadImage(url: string): Promise<Blob> {
    console.log(`[SEOImageGen] 📥 下载图片: ${url.substring(0, 60)}...`)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`下载图片失败: ${response.status}`)
    }

    const blob = await response.blob()
    console.log(`[SEOImageGen] ✅ 下载完成: ${(blob.size / 1024).toFixed(1)} KB`)
    return blob
  }

  /**
   * 将 PNG 转换为 JPG (使用 Canvas API)
   */
  private async convertToJPG(pngBlob: Blob, quality: number = 80): Promise<Blob> {
    console.log(`[SEOImageGen] 🔄 PNG → JPG 转换中...`)

    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(pngBlob)

      img.onload = () => {
        try {
          // 创建 Canvas
          const canvas = document.createElement('canvas')

          // 计算目标尺寸 (最大 640x360, 16:9 宽高比)
          let width = img.width
          let height = img.height
          const maxWidth = 640
          const maxHeight = 360

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
          }

          canvas.width = width
          canvas.height = height

          // 绘制图片
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            throw new Error('无法获取 Canvas context')
          }
          ctx.drawImage(img, 0, 0, width, height)

          // 转换为 JPG Blob
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url)
              if (!blob) {
                reject(new Error('Canvas toBlob 失败'))
                return
              }
              console.log(`[SEOImageGen] ✅ 转换完成: ${(blob.size / 1024).toFixed(1)} KB (质量: ${quality}%)`)
              resolve(blob)
            },
            'image/jpeg',
            quality / 100
          )
        } catch (error) {
          URL.revokeObjectURL(url)
          reject(error)
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('图片加载失败'))
      }

      img.src = url
    })
  }

  /**
   * 上传到 Cloudflare R2 (通过 Supabase Edge Function)
   */
  private async uploadToR2(blob: Blob, key: string): Promise<string> {
    console.log(`[SEOImageGen] ☁️  上传到 R2: ${key}`)

    // 将 Blob 转换为 Base64
    const base64Data = await this.blobToBase64(blob)

    // 调用 Supabase Edge Function (upload-thumbnail)
    const supabaseUrl = getEnv('VITE_SUPABASE_URL')
    const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY')

    const response = await fetch(`${supabaseUrl}/functions/v1/upload-thumbnail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        videoId: key.replace('seo-images/', '').replace('.jpg', ''), // 使用 key 作为唯一标识
        contentType: 'image/jpeg',
        base64Data: base64Data,
        directUpload: true,
        customKey: key // 自定义 R2 key
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`上传失败: ${errorData.error || response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || '上传到 R2 失败')
    }

    const publicUrl = result.data.publicUrl
    console.log(`[SEOImageGen] ✅ 上传成功: ${publicUrl}`)
    return publicUrl
  }

  /**
   * 将 Blob 转换为 Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * 更新数据库中的 Markdown 内容
   */
  private async updateMarkdownInDatabase(pageVariantId: string, markdown: string): Promise<void> {
    const { error } = await supabase
      .from('seo_page_variants')
      .update({ guide_content: markdown })
      .eq('id', pageVariantId)

    if (error) {
      throw new Error(`更新数据库失败: ${error.message}`)
    }
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 导出单例
export const seoImageGenerationService = new SEOImageGenerationService()
export default seoImageGenerationService
