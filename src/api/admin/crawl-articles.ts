/**
 * API端点: 触发外部文章爬取
 *
 * 路径: /api/admin/crawl-articles
 * 方法: POST
 * 权限: 需要Service Role Key
 */

import type { Request, Response } from 'express'
import { PlaywrightArticleCrawler } from '../../services/playwrightArticleCrawler'

// 爬取来源配置
const CRAWL_SOURCES = [
  {
    name: 'Social Media Examiner - TikTok',
    url: 'https://www.socialmediaexaminer.com/category/tiktok/',
    keywords: ['tiktok', 'viral-video', 'social-media', 'short-video'],
    platform: 'tiktok',
    maxArticles: 10
  },
  {
    name: 'Neil Patel Blog - Social Media',
    url: 'https://neilpatel.com/blog/category/social-media/',
    keywords: ['viral-video', 'video-marketing', 'seo', 'content-strategy'],
    platform: 'general',
    maxArticles: 10
  },
  {
    name: 'HubSpot - Video Marketing',
    url: 'https://blog.hubspot.com/marketing/topic/video-marketing',
    keywords: ['video-marketing', 'ai-video', 'content-strategy', 'engagement'],
    platform: 'general',
    maxArticles: 10
  },
  {
    name: 'Buffer Blog - TikTok',
    url: 'https://buffer.com/library/category/tiktok/',
    keywords: ['tiktok', 'short-video', 'social-media-strategy', 'analytics'],
    platform: 'tiktok',
    maxArticles: 10
  },
  {
    name: 'Hootsuite Blog - YouTube Shorts',
    url: 'https://blog.hootsuite.com/youtube-shorts/',
    keywords: ['youtube-shorts', 'video-creation', 'viral', 'youtube'],
    platform: 'youtube',
    maxArticles: 10
  }
]

export async function POST(req: Request, res: Response) {
  try {
    // 验证权限（简单检查，生产环境需要更严格的验证）
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    console.log('🚀 开始爬取外部文章...')

    const crawler = new PlaywrightArticleCrawler()
    const allArticles = await crawler.crawlMultipleSources(CRAWL_SOURCES)

    // 统计结果
    const platformStats = allArticles.reduce((acc, article) => {
      acc[article.platform] = (acc[article.platform] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const authorityStats = {
      high: allArticles.filter(a => a.authority_score >= 80).length,
      medium: allArticles.filter(a => a.authority_score >= 60 && a.authority_score < 80).length,
      low: allArticles.filter(a => a.authority_score < 60).length
    }

    return res.status(200).json({
      success: true,
      data: {
        totalArticles: allArticles.length,
        platformStats,
        authorityStats,
        articles: allArticles.map(a => ({
          title: a.title,
          url: a.url,
          platform: a.platform,
          authorityScore: a.authority_score
        }))
      }
    })

  } catch (error) {
    console.error('❌ 爬取失败:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
