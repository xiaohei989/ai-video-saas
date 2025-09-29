/**
 * 视频调试信息组件
 * 分别显示缩略图和视频文件的缓存信息和IndexedDB缓存详情
 */

import React, { useState } from 'react'
import { Info, Loader2, Copy, ChevronDown, ChevronUp, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { clearSingleImageCache } from '@/utils/newImageCache'
import { repairThumbnail } from '@/services/thumbnailRepairService'
import type { ThumbnailDebugInfo } from '@/types/video.types'

interface VideoDebugInfoProps {
  videoId: string
  thumbnailDebugInfo?: ThumbnailDebugInfo
  videoDebugInfo?: ThumbnailDebugInfo // 复用同一个类型，因为结构相似
  isVisible: boolean
  onToggle: (videoId: string) => void
  onCacheCleared?: (videoId: string) => void
  onThumbnailRepaired?: (videoId: string) => void
}

export function VideoDebugInfo({ videoId, thumbnailDebugInfo, videoDebugInfo, isVisible, onToggle, onCacheCleared, onThumbnailRepaired }: VideoDebugInfoProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRepairing, setIsRepairing] = useState(false)

  if (!isVisible) {
    return null
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`已复制${label}到剪贴板`)
    } catch (error) {
      toast.error('复制失败')
    }
  }

  const handleClearCache = async (debugInfo: ThumbnailDebugInfo, cacheType: 'thumbnail' | 'video') => {
    if (!debugInfo?.remoteUrl) {
      toast.error('无法清除缓存：缺少远程URL')
      return
    }

    setIsDeleting(true)
    try {
      await clearSingleImageCache(debugInfo.remoteUrl)
      toast.success(`${cacheType === 'thumbnail' ? '缩略图' : '视频'}缓存已清除成功`)
      onCacheCleared?.(videoId)
    } catch (error) {
      console.error('清除缓存失败:', error)
      toast.error('清除缓存失败')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRepairThumbnail = async () => {
    setIsRepairing(true)

    try {
      toast.loading('正在修复缩略图缓存...', { id: 'repair-thumbnail' })

      // 修复缩略图缓存
      const result = await repairThumbnail(videoId, {
        frameTime: 1.5,
        forceRegenerate: true
      })

      if (result.success) {
        toast.success(result.message, { id: 'repair-thumbnail' })

        // 清理本地缓存（包括旧的和新的URL）
        if (thumbnailDebugInfo?.remoteUrl) {
          try {
            await clearSingleImageCache(thumbnailDebugInfo.remoteUrl)
            console.log('[VideoDebugInfo] ✅ 旧URL缓存清理成功')
          } catch (error) {
            console.warn('[VideoDebugInfo] 旧URL缓存清理失败:', error)
          }
        }

        // 如果新URL与旧URL不同，也清理新URL的缓存
        if (result.newUrl && result.newUrl !== thumbnailDebugInfo?.remoteUrl) {
          try {
            await clearSingleImageCache(result.newUrl)
            console.log('[VideoDebugInfo] ✅ 新URL缓存清理成功')
          } catch (error) {
            console.warn('[VideoDebugInfo] 新URL缓存清理失败:', error)
          }
        }

        // 等待一小段时间确保缓存清理完成
        await new Promise(resolve => setTimeout(resolve, 100))

        // 强制重新缓存新的缩略图
        if (result.newUrl) {
          try {
            console.log('[VideoDebugInfo] 🔄 强制重新加载新缓存:', result.newUrl)
            const { cacheImage } = await import('@/utils/newImageCache')
            await cacheImage(result.newUrl, { compress: false })
            console.log('[VideoDebugInfo] ✅ 新缓存加载完成')
          } catch (error) {
            console.warn('[VideoDebugInfo] 新缓存加载失败:', error)
          }
        }

        // 通知父组件更新
        onThumbnailRepaired?.(videoId)
        onCacheCleared?.(videoId)

        // 显示成功消息
        const actualSize = result.fileSize ? `${(result.fileSize/1024).toFixed(1)}KB` : '未知大小'
        toast.success(`缩略图缓存修复完成！新文件大小: ${actualSize}`, {
          id: 'repair-complete',
          duration: 5000
        })
      } else {
        toast.error(`修复失败: ${result.error || result.message}`, { id: 'repair-thumbnail' })
      }

    } catch (error) {
      console.error('修复缩略图缓存失败:', error)
      toast.error('修复缩略图缓存时发生错误', { id: 'repair-thumbnail' })
    } finally {
      setIsRepairing(false)
    }
  }

  // 渲染单个缓存信息部分
  const renderCacheInfo = (debugInfo: ThumbnailDebugInfo | undefined, title: string, cacheType: 'thumbnail' | 'video') => {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">{title}</h4>
          {debugInfo?.isLoading && (
            <Loader2 className="h-2 w-2 animate-spin" />
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 flex-wrap">
          {debugInfo?.hasCachedThumbnail && (
            <button
              onClick={() => handleClearCache(debugInfo, cacheType)}
              disabled={isDeleting || isRepairing}
              className="flex items-center gap-0.5 px-1 py-0.5 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors disabled:opacity-50"
              title={`清除${cacheType === 'thumbnail' ? '缩略图' : '视频'}缓存`}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  <span>清除中...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-2.5 w-2.5" />
                  <span>清除缓存</span>
                </>
              )}
            </button>
          )}

          {cacheType === 'thumbnail' && (
            <button
              onClick={handleRepairThumbnail}
              disabled={isRepairing || isDeleting}
              className="flex items-center gap-0.5 px-1 py-0.5 text-xs bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-700 dark:text-orange-300 rounded transition-colors disabled:opacity-50"
              title="修复缩略图缓存 - 重新生成并更新缩略图缓存文件"
            >
              {isRepairing ? (
                <>
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  <span>修复中...</span>
                </>
              ) : (
                <>
                  <Wrench className="h-2.5 w-2.5" />
                  <span>修复缓存</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 加载状态 */}
        {debugInfo?.isLoading && (
          <div className="flex items-center gap-0.5">
            <span>检查{cacheType === 'thumbnail' ? '缩略图' : '视频'}缓存...</span>
          </div>
        )}

        {/* 无调试信息 */}
        {!debugInfo && (
          <div className="text-orange-600 text-xs">
            点击重新分析{cacheType === 'thumbnail' ? '缩略图' : '视频'}缓存状态
          </div>
        )}

        {/* 缓存信息展示 */}
        {debugInfo && !debugInfo.isLoading && (
          <div className="space-y-2">
            {/* 基本信息 */}
            <div className="space-y-0.5 p-1 bg-gray-50 dark:bg-gray-800 rounded text-xs">
              {/* 缓存状态 */}
              <div className="flex items-center gap-0.5">
                <span className="text-gray-600 dark:text-gray-400">缓存状态:</span>
                <span className={`${debugInfo.hasCachedThumbnail ? "text-green-600" : "text-red-600"} text-xs`}>
                  {debugInfo.hasCachedThumbnail ? "✅ 已缓存" : "❌ 未缓存"}
                </span>
              </div>

              {/* 缓存类型 */}
              {debugInfo.cacheType && (
                <div className="flex items-center gap-0.5">
                  <span className="text-gray-600 dark:text-gray-400">缓存类型:</span>
                  <span className="text-blue-600 text-xs">{debugInfo.cacheType}</span>
                </div>
              )}

              {/* 缓存大小 */}
              {debugInfo.cacheSize && (
                <div className="flex items-center gap-0.5">
                  <span className="text-gray-600 dark:text-gray-400">缓存大小:</span>
                  <span className="text-purple-600 text-xs">{debugInfo.cacheSize}</span>
                </div>
              )}

              {/* 缓存位置 */}
              {debugInfo.cacheLocation && (
                <div className="flex items-center gap-0.5">
                  <span className="text-gray-600 dark:text-gray-400">缓存位置:</span>
                  <span className="text-indigo-600 text-xs break-all">{debugInfo.cacheLocation}</span>
                </div>
              )}

              {/* 远程文件大小 */}
              {debugInfo.remoteFileSize && (
                <div className="flex items-center gap-0.5">
                  <span className="text-gray-600 dark:text-gray-400">远程文件大小:</span>
                  <span className="text-gray-500 text-xs">{debugInfo.remoteFileSize}</span>
                </div>
              )}
              {/* 模糊图标记 */}
              {debugInfo.isBlurImage && (
                <div className="flex justify-center">
                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                    ⚠️ 模糊图
                  </span>
                </div>
              )}
            </div>

            {/* IndexedDB真实缓存信息 */}
            {debugInfo.indexedDBCacheInfo && debugInfo.indexedDBCacheInfo.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400 text-xs">
                    本地{cacheType === 'thumbnail' ? '缩略图' : '视频'}缓存信息 ({debugInfo.indexedDBCacheInfo.length}项):
                  </span>
                  <button
                    onClick={() => toggleSection(`${cacheType}-indexedDB`)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title={expandedSections[`${cacheType}-indexedDB`] ? `收起${cacheType === 'thumbnail' ? '缩略图' : '视频'}缓存详情` : `展开${cacheType === 'thumbnail' ? '缩略图' : '视频'}缓存详情`}
                  >
                    {expandedSections[`${cacheType}-indexedDB`] ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                  </button>
                </div>

                {expandedSections[`${cacheType}-indexedDB`] && (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {debugInfo.indexedDBCacheInfo.map((cache, index) => (
                      <CacheItemInfo key={index} cache={cache} />
                    ))}
                  </div>
                )}

                {!expandedSections[`${cacheType}-indexedDB`] && (
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded border text-xs text-gray-600 dark:text-gray-300">
                    点击展开按钮查看详细{cacheType === 'thumbnail' ? '缩略图' : '视频'}缓存信息
                  </div>
                )}
              </div>
            )}

            {/* 远程URL信息 */}
            {debugInfo.remoteUrl && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400 text-xs">远程URL:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyToClipboard(debugInfo.remoteUrl!, '远程URL')}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title="复制远程URL"
                    >
                      <Copy className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => toggleSection(`${cacheType}-remoteUrl`)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title={expandedSections[`${cacheType}-remoteUrl`] ? "收起" : "展开"}
                    >
                      {expandedSections[`${cacheType}-remoteUrl`] ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                    </button>
                  </div>
                </div>
                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 border rounded">
                  <div className="text-xs text-gray-600 dark:text-gray-300 break-all font-mono">
                    {expandedSections[`${cacheType}-remoteUrl`] ? debugInfo.remoteUrl : `${debugInfo.remoteUrl.substring(0, 60)}...`}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pt-2 mt-2 border-t border-muted-foreground/20">
      <div className="flex items-start gap-1 text-xs text-muted-foreground/70">
        <Info className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" />
        <div className="flex flex-col gap-2 w-full min-w-0">
          {/* 关闭按钮 */}
          <div className="flex justify-end">
            <button
              onClick={() => onToggle(videoId)}
              className="text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors text-xs"
            >
              ×
            </button>
          </div>

          {/* 缩略图缓存信息 */}
          {thumbnailDebugInfo && (
            <div className="border-l-2 border-blue-200 pl-2">
              {renderCacheInfo(thumbnailDebugInfo, '🖼️ 缩略图缓存', 'thumbnail')}
            </div>
          )}

          {/* 视频缓存信息 */}
          {videoDebugInfo && (
            <div className="border-l-2 border-green-200 pl-2">
              {renderCacheInfo(videoDebugInfo, '🎬 视频缓存', 'video')}
            </div>
          )}

          {/* 当没有任何调试信息时 */}
          {!thumbnailDebugInfo && !videoDebugInfo && (
            <div className="text-orange-600 text-xs text-center py-4">
              暂无缓存调试信息
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 单个缓存项信息组件
 */
interface CacheItemInfoProps {
  cache: any // IndexedDBCacheInfo
}

function CacheItemInfo({ cache }: CacheItemInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`已复制${label}到剪贴板`)
    } catch (error) {
      toast.error('复制失败')
    }
  }

  // 智能大小显示函数
  const getSmartSize = (sizeInfo: { bytes: number, kb: string, mb: string }) => {
    if (sizeInfo.bytes < 1024) {
      return `${sizeInfo.bytes}B`
    } else if (sizeInfo.bytes < 1024 * 1024) {
      return sizeInfo.kb
    } else {
      return sizeInfo.mb
    }
  }

  return (
    <div className="space-y-0.5 p-1.5 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
      {/* 基本信息网格 */}
      <div className="grid grid-cols-2 gap-0.5 text-xs">
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400 text-xs">大小:</span>
          <span className="text-blue-600 text-xs">{getSmartSize(cache.size)}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400 text-xs">类型:</span>
          <span className="text-green-600 text-xs">{cache.dataType}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400 text-xs">时间:</span>
          <span className="text-purple-600 text-xs">{cache.timestamp}</span>
        </div>

        {cache.category && (
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400 text-xs">分类:</span>
            <span className="text-indigo-600 text-xs">{cache.category}</span>
          </div>
        )}
      </div>

      {cache.expiry && (
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400 text-xs">过期时间:</span>
          <span className="text-orange-600 text-xs">{cache.expiry}</span>
        </div>
      )}

    </div>
  )
}

export default VideoDebugInfo