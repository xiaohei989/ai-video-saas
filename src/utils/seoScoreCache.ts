/**
 * SEO评分缓存工具
 * 基于内容哈希缓存AI评分结果，避免重复评分相同内容
 */

import type { SEOScoreResult, SEOGuideData } from '@/services/seoScoreCalculator'

interface CacheEntry {
  score: SEOScoreResult
  timestamp: number
  contentHash: string
}

// 内存缓存（生产环境可改为 Redis）
const scoreCache = new Map<string, CacheEntry>()

// 缓存有效期：24小时
const CACHE_TTL = 24 * 60 * 60 * 1000

/**
 * 生成内容哈希（浏览器兼容版本）
 * 使用简单的字符串哈希算法
 */
export function generateContentHash(data: SEOGuideData): string {
  const content = JSON.stringify({
    meta_title: data.meta_title,
    meta_description: data.meta_description,
    meta_keywords: data.meta_keywords,
    guide_content: data.guide_content,
    guide_intro: data.guide_intro,
    target_keyword: data.target_keyword,
    long_tail_keywords: data.long_tail_keywords,
    secondary_keywords: data.secondary_keywords,
    faq_items: data.faq_items
    // 不包含 page_views 等动态数据
  })

  // 简单的字符串哈希算法（浏览器兼容）
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36)
}

/**
 * 获取缓存的评分
 */
export function getCachedScore(contentHash: string): SEOScoreResult | null {
  const entry = scoreCache.get(contentHash)

  if (!entry) {
    return null
  }

  // 检查是否过期
  const now = Date.now()
  if (now - entry.timestamp > CACHE_TTL) {
    scoreCache.delete(contentHash)
    return null
  }

  console.log('[SEO Cache] 命中缓存:', contentHash)
  return entry.score
}

/**
 * 保存评分到缓存
 */
export function setCachedScore(contentHash: string, score: SEOScoreResult): void {
  scoreCache.set(contentHash, {
    score,
    timestamp: Date.now(),
    contentHash
  })

  console.log('[SEO Cache] 保存缓存:', contentHash)
}

/**
 * 清理过期缓存
 */
export function cleanExpiredCache(): number {
  const now = Date.now()
  let removed = 0

  for (const [hash, entry] of scoreCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      scoreCache.delete(hash)
      removed++
    }
  }

  if (removed > 0) {
    console.log(`[SEO Cache] 清理了 ${removed} 个过期缓存`)
  }

  return removed
}

/**
 * 清空所有缓存
 */
export function clearAllCache(): void {
  const size = scoreCache.size
  scoreCache.clear()
  console.log(`[SEO Cache] 清空了 ${size} 个缓存`)
}

/**
 * 获取缓存统计
 */
export function getCacheStats(): {
  size: number
  entries: Array<{ hash: string; age: number }>
} {
  const now = Date.now()
  const entries = Array.from(scoreCache.entries()).map(([hash, entry]) => ({
    hash,
    age: Math.floor((now - entry.timestamp) / 1000) // 秒
  }))

  return {
    size: scoreCache.size,
    entries
  }
}

// 定期清理过期缓存（每小时）
if (typeof window !== 'undefined') {
  setInterval(cleanExpiredCache, 60 * 60 * 1000)
}
