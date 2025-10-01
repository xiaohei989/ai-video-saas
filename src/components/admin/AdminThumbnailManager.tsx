import React from 'react'
import ThumbnailGenerator from '@/components/admin/ThumbnailGenerator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, ImageUp, Images } from '@/components/icons'
import supabaseVideoService from '@/services/supabaseVideoService'
import BatchBlurThumbnailsPage from '@/pages/admin/BatchBlurThumbnailsPage'

export default function AdminThumbnailManager() {
  const [showForce, setShowForce] = React.useState(false)
  const [showBatch, setShowBatch] = React.useState(false)
  const [videoId, setVideoId] = React.useState('')
  const [frameTime, setFrameTime] = React.useState('1.5')
  const [running, setRunning] = React.useState(false)
  const [msg, setMsg] = React.useState<string>('')

  const handleForce = async () => {
    if (!videoId) { setMsg('请输入视频ID'); return }
    setRunning(true); setMsg('')
    const t = Number(frameTime) || 1.5
    const res = await supabaseVideoService.regenerateThumbnail(videoId, { frameTime: t })
    setMsg(res.success ? `✅ 成功：${res.url}` : `❌ 失败：${res.message}`)
    setRunning(false)
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="w-5 h-5" /> 缩略图管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            管理与批量生成用户视频的高清/模糊缩略图。下方提供快捷入口：
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="flex items-center gap-2" onClick={() => setShowForce(v => !v)}>
              <RefreshCw className="w-4 h-4" /> 强制重生成
            </Button>
            <Button variant="outline" className="flex items-center gap-2" onClick={() => setShowBatch(v => !v)}>
              <ImageUp className="w-4 h-4" /> 批量补齐模糊图
            </Button>
          </div>

          {showForce && (
            <div className="mt-3 p-3 border rounded bg-white space-y-2">
              <div className="text-sm font-medium">强制重生成缩略图（覆盖同名，推荐配合 CDN Purge）</div>
              <div className="flex flex-col md:flex-row gap-2 items-center">
                <input className="w-full md:w-72 border rounded px-2 py-1" placeholder="视频ID" value={videoId} onChange={e => setVideoId(e.target.value)} />
                <input className="w-full md:w-32 border rounded px-2 py-1" placeholder="截帧秒数" value={frameTime} onChange={e => setFrameTime(e.target.value)} />
                <Button onClick={handleForce} disabled={running}>
                  {running ? '处理中…' : '执行'}
                </Button>
              </div>
              {msg && (<div className="text-xs text-muted-foreground break-all">{msg}</div>)}
            </div>
          )}

          {showBatch && (
            <div className="mt-3">
              <BatchBlurThumbnailsPage />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 直接嵌入“批量生成高清缩略图”工具（隐藏大标题，避免冲淡管理页标题） */}
      <ThumbnailGenerator hideHeader />
    </div>
  )
}
