import React from 'react'
import { supabase } from '@/lib/supabase'

async function generateBlurFromImage(thumbnailUrl: string, videoId: string): Promise<string> {
  // 通过 Edge Function 在服务端利用 Cloudflare Transform 拉取小图并上传，避免浏览器 CORS
  const { data, error } = await supabase.functions.invoke('generate-blur-thumbnail', {
    body: { videoId, thumbnailUrl, width: 48, quality: 30 }
  })
  if (error) throw error
  if (!data?.success) throw new Error(data?.error || '生成模糊图失败')
  return data.data.publicUrl as string
}

export default function BatchBlurThumbnailsPage() {
  const [rows, setRows] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [processing, setProcessing] = React.useState(false)
  const [logs, setLogs] = React.useState<string[]>([])

  const addLog = (m: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString('zh-CN')} ${m}`])

  const load = async () => {
    setLoading(true)
    setLogs([])
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, thumbnail_url, thumbnail_blur_url, status')
        .eq('status', 'completed')
        .not('thumbnail_url', 'is', null)
        .or('thumbnail_blur_url.is.null,thumbnail_blur_url.like.data:image/svg+xml%')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setRows(data || [])
      addLog(`加载待处理视频 ${data?.length || 0} 条`)
    } catch (e: any) {
      addLog(`加载失败：${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const run = async () => {
    if (!rows.length) return
    setProcessing(true)
    let ok = 0, fail = 0
    for (const v of rows) {
      try {
        const blur = await generateBlurFromImage(v.thumbnail_url, v.id)
        await supabase
          .from('videos')
          .update({ thumbnail_blur_url: blur, thumbnail_generated_at: new Date().toISOString() })
          .eq('id', v.id)
        ok++
        addLog(`✅ ${v.title || v.id} 生成模糊图成功`)
      } catch (e: any) {
        fail++
        addLog(`❌ ${v.title || v.id} 失败：${e.message}`)
      }
    }
    addLog(`完成：成功 ${ok}，失败 ${fail}`)
    setProcessing(false)
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">批量补齐模糊缩略图</h1>
      <div className="text-sm text-muted-foreground">扫描已完成且有高清缩略图、但缺少模糊图的视频，并生成 48px WebP 模糊占位。</div>
      <div className="flex gap-3">
        <button className="px-3 py-2 rounded bg-blue-600 text-white disabled:bg-gray-400" onClick={load} disabled={loading || processing}>
          {loading ? '加载中…' : '加载待处理'}
        </button>
        <button className="px-3 py-2 rounded bg-green-600 text-white disabled:bg-gray-400" onClick={run} disabled={processing || !rows.length}>
          {processing ? '处理中…' : '开始生成'}
        </button>
      </div>
      <div className="text-sm">待处理：{rows.length} 条</div>
      <div className="p-3 border rounded bg-white max-h-80 overflow-auto text-sm font-mono">
        {logs.length ? logs.map((l, i) => (<div key={i}>{l}</div>)) : '📋 就绪，点击“加载待处理”。'}
      </div>
    </div>
  )
}
