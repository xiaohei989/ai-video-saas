import React from 'react'
import { useSearchParams } from 'react-router-dom'
import supabaseVideoService from '@/services/supabaseVideoService'
import { CDN_CONFIG } from '@/config/cdnConfig'

/**
 * 管理工具：强制重生成缩略图（覆盖同名，并用于后续CDN Purge）
 * 使用方式：访问 /admin/force-thumbnail?id=<videoId>&t=<optional-seconds>
 * - id: 必填，视频ID
 * - t: 可选，截帧时间（秒），默认1.5s
 */
export default function ForceThumbnailPage() {
  const [sp] = useSearchParams()
  const videoId = sp.get('id') || ''
  const tParam = sp.get('t')
  const frameTime = tParam ? Number(tParam) : 1.5

  const [running, setRunning] = React.useState(false)
  const [result, setResult] = React.useState<{success: boolean; url?: string; message?: string} | null>(null)

  const handleRun = async () => {
    if (!videoId) {
      setResult({ success: false, message: '缺少参数 id（视频ID）' })
      return
    }
    setRunning(true)
    setResult(null)
    const r = await supabaseVideoService.regenerateThumbnail(videoId, { frameTime })
    setResult(r)
    setRunning(false)
  }

  const purgeTip = React.useMemo(() => {
    if (!videoId) return ''
    const webpUrl = `https://${CDN_CONFIG.r2.domain}/thumbnails/${videoId}.webp`
    const jpgUrl = `https://${CDN_CONFIG.r2.domain}/thumbnails/${videoId}.jpg`
    return `建议在Cloudflare面板执行单文件Purge（至少对以下URL）：\n- ${webpUrl}\n- ${jpgUrl}\n如使用API请参考脚本 scripts/purge-cloudflare-cache.js`
  }, [videoId])

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">强制重生成缩略图</h1>
      <div className="text-sm text-muted-foreground">视频ID: <span className="font-mono">{videoId || '(请在URL指定?id=)'}</span></div>
      <div className="text-sm text-muted-foreground">截帧时间: {frameTime}s（可用?t=秒自定义）</div>

      <button
        disabled={!videoId || running}
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:bg-gray-400"
        onClick={handleRun}
      >
        {running ? '处理中…' : '一键重生成（覆盖上传）'}
      </button>

      {result && (
        <div className="mt-4 p-3 rounded border">
          {result.success ? (
            <div>
              <div className="text-green-600 font-semibold">✅ 重生成成功</div>
              <div className="text-sm break-all">新URL（可能仍需Purge后生效）：{result.url}</div>
            </div>
          ) : (
            <div>
              <div className="text-red-600 font-semibold">❌ 失败</div>
              <div className="text-sm">{result.message}</div>
            </div>
          )}
        </div>
      )}

      {videoId && (
        <div className="mt-4 p-3 rounded border bg-yellow-50">
          <div className="font-semibold">⚠️ CDN缓存提示</div>
          <pre className="text-xs whitespace-pre-wrap mt-2">{purgeTip}</pre>
        </div>
      )}
    </div>
  )
}

