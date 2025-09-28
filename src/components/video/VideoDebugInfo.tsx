/**
 * 视频调试信息组件
 * 显示缩略图缓存信息和IndexedDB缓存详情
 */

import React, { useState } from 'react'
import { Info, Loader2, Copy, ChevronDown, ChevronUp, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { clearSingleImageCache } from '@/utils/newImageCache'
import { repairThumbnail } from '@/services/thumbnailRepairService'
import type { ThumbnailDebugInfo } from '@/types/video.types'

interface VideoDebugInfoProps {
  videoId: string
  debugInfo?: ThumbnailDebugInfo
  isVisible: boolean
  onToggle: (videoId: string) => void
  onCacheCleared?: (videoId: string) => void
  onThumbnailRepaired?: (videoId: string) => void
}

export function VideoDebugInfo({ videoId, debugInfo, isVisible, onToggle, onCacheCleared, onThumbnailRepaired }: VideoDebugInfoProps) {
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

  const handleClearCache = async () => {
    if (!debugInfo?.remoteUrl) {
      toast.error('无法清除缓存：缺少远程URL')
      return
    }

    setIsDeleting(true)
    try {
      await clearSingleImageCache(debugInfo.remoteUrl)
      toast.success('缓存已清除成功')
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
      toast.loading('正在修复缩略图...', { id: 'repair-thumbnail' })

      // 修复缩略图
      const result = await repairThumbnail(videoId, {
        frameTime: 1.5,
        forceRegenerate: true
      })

      if (result.success) {
        toast.success(result.message, { id: 'repair-thumbnail' })

        // 清理本地缓存（包括旧的和新的URL）
        if (debugInfo?.remoteUrl) {
          try {
            await clearSingleImageCache(debugInfo.remoteUrl)
            console.log('[VideoDebugInfo] ✅ 旧URL缓存清理成功')
          } catch (error) {
            console.warn('[VideoDebugInfo] 旧URL缓存清理失败:', error)
          }
        }

        // 如果新URL与旧URL不同，也清理新URL的缓存
        if (result.newUrl && result.newUrl !== debugInfo?.remoteUrl) {
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
        toast.success(`缩略图修复完成！新文件大小: ${actualSize}`, {
          id: 'repair-complete',
          duration: 5000
        })
      } else {
        toast.error(`修复失败: ${result.error || result.message}`, { id: 'repair-thumbnail' })
      }

    } catch (error) {
      console.error('修复缩略图失败:', error)
      toast.error('修复缩略图时发生错误', { id: 'repair-thumbnail' })
    } finally {
      setIsRepairing(false)
    }
  }

  return (
    <div className="pt-3 mt-3 border-t border-muted-foreground/20">
      <div className="flex items-start gap-2 text-xs text-muted-foreground/70">
        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
        <div className="flex flex-col gap-2 w-full min-w-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 flex-wrap">
              {debugInfo?.hasCachedThumbnail && (
                <button
                  onClick={handleClearCache}
                  disabled={isDeleting || isRepairing}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors disabled:opacity-50"
                  title="清除缓存"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>清除中...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3 w-3" />
                      <span>清除缓存</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleRepairThumbnail}
                disabled={isRepairing || isDeleting}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-700 dark:text-orange-300 rounded transition-colors disabled:opacity-50"
                title="修复缩略图 - 重新生成并上传新的缩略图文件"
              >
                {isRepairing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>修复中...</span>
                  </>
                ) : (
                  <>
                    <Wrench className="h-3 w-3" />
                    <span>修复缩略图</span>
                  </>
                )}
              </button>
            </div>
            <button
              onClick={() => onToggle(videoId)}
              className="text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors text-sm"
            >
              ×
            </button>
          </div>

          {/* 加载状态 */}
          {debugInfo?.isLoading && (
            <div className="flex items-center gap-1">
              <Loader2 className="h-2 w-2 animate-spin" />
              <span>检查缩略图缓存...</span>
            </div>
          )}

          {/* 无调试信息 */}
          {!debugInfo && !debugInfo?.isLoading && (
            <div className="text-orange-600">
              点击重新分析缩略图状态
            </div>
          )}

          {/* 缓存信息展示 */}
          {debugInfo && !debugInfo.isLoading && (
            <div className="space-y-3">
              {/* 基本信息 */}
              <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">缓存状态:</span>
                    <span className={`${debugInfo.hasCachedThumbnail ? "text-green-600" : "text-red-600"} font-medium`}>
                      {debugInfo.hasCachedThumbnail ? "✅ 已缓存" : "❌ 未缓存"}
                    </span>
                  </div>

                  {debugInfo.cacheType && (
                    <div className="flex flex-col">
                      <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">缓存类型:</span>
                      <span className="text-blue-600 font-medium">{debugInfo.cacheType}</span>
                    </div>
                  )}

                  {debugInfo.cacheSize && (
                    <div className="flex flex-col">
                      <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">缓存大小:</span>
                      <span className="text-purple-600 font-medium">{debugInfo.cacheSize}</span>
                    </div>
                  )}

                  {debugInfo.cacheLocation && (
                    <div className="flex flex-col">
                      <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">缓存位置:</span>
                      <span className="text-indigo-600 text-xs break-all">{debugInfo.cacheLocation}</span>
                    </div>
                  )}

                  {debugInfo.remoteFileSize && (
                    <div className="flex flex-col">
                      <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">远程文件大小:</span>
                      <span className="text-gray-500 font-medium">{debugInfo.remoteFileSize}</span>
                    </div>
                  )}
                </div>

                {debugInfo.isBlurImage && (
                  <div className="flex justify-center mt-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                      ⚠️ 模糊图
                    </span>
                  </div>
                )}
              </div>

              {/* 缓存Key信息 */}
              {debugInfo.cacheKey && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">缓存Key:</span>
                    <button
                      onClick={() => copyToClipboard(debugInfo.cacheKey!, '缓存Key')}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title="复制缓存Key"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="p-2 bg-white dark:bg-gray-900 border rounded text-xs font-mono break-all">
                    {debugInfo.cacheKey}
                  </div>
                </div>
              )}
              {/* IndexedDB真实缓存信息 */}
              {debugInfo.indexedDBCacheInfo && debugInfo.indexedDBCacheInfo.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                      本地缓存信息 ({debugInfo.indexedDBCacheInfo.length}项):
                    </span>
                    <button
                      onClick={() => toggleSection('indexedDB')}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title={expandedSections.indexedDB ? "收起缓存详情" : "展开缓存详情"}
                    >
                      {expandedSections.indexedDB ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>

                  {expandedSections.indexedDB && (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {debugInfo.indexedDBCacheInfo.map((cache, index) => (
                        <CacheItemInfo key={index} cache={cache} />
                      ))}
                    </div>
                  )}

                  {!expandedSections.indexedDB && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border text-xs text-gray-600 dark:text-gray-300">
                      点击展开按钮查看详细缓存信息
                    </div>
                  )}
                </div>
              )}

              {/* 远程URL信息 */}
              {debugInfo.remoteUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">远程URL:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyToClipboard(debugInfo.remoteUrl!, '远程URL')}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="复制远程URL"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => toggleSection('remoteUrl')}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title={expandedSections.remoteUrl ? "收起" : "展开"}
                      >
                        {expandedSections.remoteUrl ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border rounded">
                    <div className="text-xs text-gray-600 dark:text-gray-300 break-all font-mono">
                      {expandedSections.remoteUrl ? debugInfo.remoteUrl : `${debugInfo.remoteUrl.substring(0, 60)}...`}
                    </div>
                  </div>
                </div>
              )}

              {/* 缓存URL信息 */}
              {debugInfo.thumbnailUrl && debugInfo.thumbnailUrl !== debugInfo.remoteUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">缓存URL:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyToClipboard(debugInfo.thumbnailUrl!, '缓存URL')}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="复制缓存URL"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => toggleSection('thumbnailUrl')}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title={expandedSections.thumbnailUrl ? "收起" : "展开"}
                      >
                        {expandedSections.thumbnailUrl ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 border rounded">
                    <div className="text-xs text-gray-600 dark:text-gray-300 break-all font-mono">
                      {expandedSections.thumbnailUrl ? debugInfo.thumbnailUrl : `${debugInfo.thumbnailUrl.substring(0, 60)}...`}
                    </div>
                  </div>
                </div>
              )}
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

  return (
    <div className="space-y-2 p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
      {/* 基本信息网格 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400 font-medium">大小:</span>
          <span className="text-blue-600 font-medium">{cache.size.mb}</span>
          <span className="text-gray-400 text-xs">({cache.size.bytes.toLocaleString()} bytes)</span>
        </div>

        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400 font-medium">类型:</span>
          <span className="text-green-600 font-medium">{cache.dataType}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400 font-medium">时间:</span>
          <span className="text-purple-600 font-medium text-xs">{cache.timestamp}</span>
        </div>

        {cache.category && (
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400 font-medium">分类:</span>
            <span className="text-indigo-600 font-medium">{cache.category}</span>
          </div>
        )}
      </div>

      {cache.expiry && (
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400 font-medium text-xs">过期时间:</span>
          <span className="text-orange-600 font-medium text-xs">{cache.expiry}</span>
        </div>
      )}

      {/* 缓存Key */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400 font-medium text-xs">缓存Key:</span>
          <button
            onClick={() => copyToClipboard(cache.key, '缓存Key')}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="复制Key"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs font-mono break-all">
          {cache.key}
        </div>
      </div>

      {/* 数据预览 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400 font-medium text-xs">
            数据预览 ({cache.dataLength.toLocaleString()} 字符):
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => copyToClipboard(cache.dataPreview, '数据预览')}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="复制预览数据"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title={isExpanded ? "收起" : "展开"}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>
        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-xs text-gray-600 dark:text-gray-300 break-all font-mono">
            {isExpanded ? cache.dataPreview : `${cache.dataPreview.substring(0, 100)}...`}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoDebugInfo