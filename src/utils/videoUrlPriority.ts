/**
 * 视频URL优先级选择工具
 * 根据用户反馈"优先使用r2，不行再用第三方的url"实现URL选择逻辑
 */

import { getProxyVideoUrl } from './videoUrlProxy'
import { getR2PublicDomain } from '@/config/cdnConfig'

export interface VideoUrlData {
  video_url?: string | null
  r2_url?: string | null
  original_video_url?: string | null
  migration_status?: string | null
}

export interface VideoUrlResult {
  /** 选择的最佳URL */
  url: string
  /** URL来源类型 */
  source: 'r2' | 'video_url' | 'original' | 'proxy'
  /** 是否需要代理 */
  needsProxy: boolean
  /** 回退URL（如果主URL失败时使用） */
  fallbackUrl?: string
  /** 回退URL来源 */
  fallbackSource?: 'video_url' | 'original' | 'proxy'
}

/**
 * 根据优先级选择最佳的视频URL
 * 优先级：R2 URL > video_url > original_video_url > proxy fallback
 */
export function getBestVideoUrl(videoData: VideoUrlData): VideoUrlResult | null {
  if (!videoData) {
    return null
  }

  const { r2_url, video_url, original_video_url } = videoData

  // 1. 优先使用R2 URL（最佳选择：CDN，快速，无CORS问题）
  if (r2_url && isValidUrl(r2_url)) {
    const fallback = getBestFallbackUrl(video_url, original_video_url)
    return {
      url: r2_url,
      source: 'r2',
      needsProxy: false, // R2 URL不需要代理
      fallbackUrl: fallback?.url,
      fallbackSource: fallback?.source
    }
  }

  // 2. 使用video_url（通常是当前使用的URL）
  if (video_url && isValidUrl(video_url)) {
    const fallback = getBestFallbackUrl(original_video_url)
    
    // 检查是否是R2 URL（有时候video_url就是R2 URL）
    const r2Domain = getR2PublicDomain()
    if (video_url.includes(r2Domain)) {
      return {
        url: video_url,
        source: 'r2',
        needsProxy: false,
        fallbackUrl: fallback?.url,
        fallbackSource: fallback?.source
      }
    }
    
    return {
      url: video_url,
      source: 'video_url',
      needsProxy: shouldUseProxy(video_url),
      fallbackUrl: fallback?.url,
      fallbackSource: fallback?.source
    }
  }

  // 3. 回退到原始URL
  if (original_video_url && isValidUrl(original_video_url)) {
    return {
      url: original_video_url,
      source: 'original',
      needsProxy: shouldUseProxy(original_video_url),
      fallbackUrl: undefined,
      fallbackSource: undefined
    }
  }

  return null
}

/**
 * 获取用于播放器的最终URL（考虑代理）
 */
export function getPlayerUrl(videoData: VideoUrlData): string | null {
  const result = getBestVideoUrl(videoData)
  if (!result) {
    return null
  }

  // 如果需要代理，则使用代理URL
  if (result.needsProxy) {
    return getProxyVideoUrl(result.url)
  }

  return result.url
}

/**
 * 获取回退URL
 */
function getBestFallbackUrl(
  primaryUrl?: string | null, 
  secondaryUrl?: string | null
): { url: string; source: 'video_url' | 'original' | 'proxy' } | null {
  if (primaryUrl && isValidUrl(primaryUrl)) {
    return {
      url: shouldUseProxy(primaryUrl) ? getProxyVideoUrl(primaryUrl) : primaryUrl,
      source: 'video_url'
    }
  }
  
  if (secondaryUrl && isValidUrl(secondaryUrl)) {
    return {
      url: shouldUseProxy(secondaryUrl) ? getProxyVideoUrl(secondaryUrl) : secondaryUrl,
      source: 'original'
    }
  }
  
  return null
}

/**
 * 检查URL是否有效
 */
function isValidUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return false
  }
  
  try {
    new URL(url)
    return url.startsWith('http://') || url.startsWith('https://')
  } catch {
    return false
  }
}

/**
 * 检查URL是否需要代理
 */
function shouldUseProxy(url: string): boolean {
  // 开发环境下，R2 URL需要代理
  if (import.meta.env.DEV) {
    const r2Domain = getR2PublicDomain()
    return url.includes(r2Domain) || url.includes('.r2.dev')
  }
  
  // 生产环境通常不需要代理（通过Cloudflare处理CORS）
  return false
}

/**
 * 获取URL的显示信息（用于调试）
 */
export function getUrlInfo(videoData: VideoUrlData): {
  selected: string
  source: string
  fallback?: string
  migration: string
} | null {
  const result = getBestVideoUrl(videoData)
  if (!result) {
    return null
  }

  return {
    selected: result.url.substring(0, 60) + (result.url.length > 60 ? '...' : ''),
    source: result.source,
    fallback: result.fallbackUrl?.substring(0, 60) + (result.fallbackUrl && result.fallbackUrl.length > 60 ? '...' : ''),
    migration: videoData.migration_status || 'unknown'
  }
}