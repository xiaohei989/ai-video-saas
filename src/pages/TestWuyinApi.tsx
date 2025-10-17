import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getWuyinApiService } from '@/services/veo/WuyinApiService'
import type { IVeoApiService } from '@/services/veo/VeoApiAbstraction'

interface LogEntry {
  time: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

export default function TestWuyinApi() {
  const [model, setModel] = useState<string>('veo3-fast')
  const [prompt, setPrompt] = useState('A beautiful sunset over the ocean with waves crashing on the beach')
  const [imageUrl, setImageUrl] = useState('')
  const [ratio, setRatio] = useState<'16:9' | '9:16'>('16:9')
  const [status, setStatus] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [taskId, setTaskId] = useState<string>('')
  const [result, setResult] = useState<any>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pollingInterval, setPollingInterval] = useState<number | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const wuyinServiceRef = useRef<IVeoApiService | null>(null)

  // 日志记录函数
  const addLog = (level: LogEntry['level'], message: string) => {
    const logEntry: LogEntry = {
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      level,
      message
    }
    setLogs(prev => [...prev, logEntry])
    console.log(`[${level.toUpperCase()}] ${message}`)
  }

  // 初始化Wuyin服务
  useEffect(() => {
    addLog('info', '=== 初始化 Wuyin API 测试页面 ===')
    addLog('info', '检查环境变量配置...')

    const apiKey = import.meta.env.VITE_WUYIN_API_KEY
    const endpoint = import.meta.env.VITE_WUYIN_ENDPOINT || 'https://api.wuyinkeji.com'

    if (!apiKey) {
      addLog('error', '❌ Wuyin: 未配置 VITE_WUYIN_API_KEY')
      setStatus('❌ Wuyin API key not configured')
      return
    }

    addLog('success', '✅ Wuyin: API Key 已配置')
    addLog('info', `  Wuyin Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`)
    addLog('info', `  Wuyin端点: ${endpoint}`)

    // 初始化服务
    try {
      wuyinServiceRef.current = getWuyinApiService({ apiKey, endpoint })
      addLog('success', '✅ Wuyin服务初始化成功')
    } catch (error) {
      addLog('error', `❌ Wuyin服务初始化失败: ${error}`)
    }

    addLog('info', '=== 初始化完成 ===')
  }, [])

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [])

  // 测试连接
  const testConnection = async () => {
    addLog('info', '开始测试 Wuyin API 连接...')
    setStatus('Testing Wuyin API connection...')

    if (!wuyinServiceRef.current) {
      addLog('error', '❌ Wuyin服务未初始化')
      setStatus('❌ Wuyin service not initialized')
      return
    }

    try {
      addLog('info', '发送测试请求...')

      // 使用最简单的prompt测试
      const testParams = {
        endpoint_url: import.meta.env.VITE_WUYIN_ENDPOINT || 'https://api.wuyinkeji.com',
        key: import.meta.env.VITE_WUYIN_API_KEY,
        model_name: 'veo3-fast',
        prompt: 'Test connection',
        type: 'text2video' as const,
        ratio: '16:9' as const
      }

      const response = await wuyinServiceRef.current.generateVideo(testParams)

      addLog('success', '✅ Wuyin 连接成功！')
      addLog('info', `任务ID: ${response.taskId}`)
      addLog('info', `状态: ${response.status}`)
      setStatus(`✅ Wuyin Connection successful! Task ID: ${response.taskId}`)

    } catch (error) {
      addLog('error', `❌ Wuyin 连接失败: ${error}`)
      setStatus(`❌ Wuyin Connection failed: ${error}`)
    }
  }

  // 开始视频生成
  const startGeneration = async () => {
    if (!wuyinServiceRef.current) {
      addLog('error', '❌ Wuyin服务未初始化')
      return
    }

    addLog('info', '=== 开始 Wuyin API 视频生成测试 ===')
    addLog('info', `模型: ${model}`)
    addLog('info', `提示词: "${prompt}"`)
    addLog('info', `宽高比: ${ratio}`)
    if (imageUrl) {
      addLog('info', `参考图片: ${imageUrl}`)
    }

    setStatus('Starting Wuyin video generation...')
    setIsGenerating(true)
    setResult(null)

    try {
      const startTime = Date.now()

      const params = {
        endpoint_url: import.meta.env.VITE_WUYIN_ENDPOINT || 'https://api.wuyinkeji.com',
        key: import.meta.env.VITE_WUYIN_API_KEY,
        model_name: model,
        prompt: prompt,
        type: (imageUrl ? 'img2video' : 'text2video') as 'text2video' | 'img2video',
        ratio: ratio,
        ...(imageUrl ? { img_url: [imageUrl] } : {})
      }

      addLog('info', '发送生成请求...')
      addLog('info', `请求参数: ${JSON.stringify(params, null, 2)}`)

      const response = await wuyinServiceRef.current.generateVideo(params)

      const requestTime = Date.now() - startTime
      addLog('success', `✅ 请求创建成功 (耗时: ${requestTime}ms)`)
      addLog('info', `任务 ID: ${response.taskId}`)
      addLog('info', `初始状态: ${response.status}`)

      setTaskId(response.taskId)
      setStatus(`✅ Video generation started! Task ID: ${response.taskId}`)

      // 开始轮询
      startPolling(response.taskId)

    } catch (error) {
      addLog('error', `❌ 错误: ${error}`)
      addLog('error', `错误堆栈: ${error instanceof Error ? error.stack : 'N/A'}`)
      setStatus(`❌ Error: ${error}`)
      setIsGenerating(false)
    }
  }

  // 开始轮询任务状态
  const startPolling = (tid: string) => {
    addLog('info', '开始轮询任务状态...')

    let pollCount = 0
    const pollStartTime = Date.now()

    const poll = async () => {
      if (!wuyinServiceRef.current) return

      try {
        pollCount++
        const elapsed = Math.floor((Date.now() - pollStartTime) / 1000)

        addLog('info', `[轮询 #${pollCount}] 已用时: ${elapsed}秒`)

        const status = await wuyinServiceRef.current.queryStatus(tid)

        addLog('info', `状态: ${status.status}, 进度: ${status.progress || 0}%`)

        setResult(status)
        setStatus(`Progress: ${status.progress || 0}% - Status: ${status.status}`)

        if (status.status === 'completed') {
          const totalTime = Math.floor((Date.now() - pollStartTime) / 1000)
          addLog('success', `✅ 视频生成成功！总耗时: ${totalTime}秒`)
          addLog('info', `视频 URL: ${status.video_url}`)
          setStatus('✅ Video generated successfully!')
          setIsGenerating(false)

          // 停止轮询
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
            setPollingInterval(null)
          }
        } else if (status.status === 'failed') {
          addLog('error', `❌ 生成失败: ${status.fail_reason || 'Unknown error'}`)
          setStatus(`❌ Generation failed: ${status.fail_reason || 'Unknown error'}`)
          setIsGenerating(false)

          // 停止轮询
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
            setPollingInterval(null)
          }
        }
      } catch (error) {
        addLog('error', `轮询错误: ${error}`)

        // 轮询错误不停止，继续尝试
        pollCount--
      }
    }

    // 立即执行一次
    poll()

    // 每5秒轮询一次
    pollingIntervalRef.current = setInterval(poll, 5000)
    setPollingInterval(5000)
  }

  // 手动查询状态
  const queryStatus = async () => {
    if (!taskId) {
      addLog('warn', '⚠️ 请先生成视频获取任务ID')
      return
    }

    if (!wuyinServiceRef.current) {
      addLog('error', '❌ Wuyin服务未初始化')
      return
    }

    addLog('info', `查询任务状态: ${taskId}`)

    try {
      const status = await wuyinServiceRef.current.queryStatus(taskId)

      addLog('info', `状态: ${status.status}`)
      addLog('info', `进度: ${status.progress || 0}%`)
      if (status.video_url) {
        addLog('info', `视频URL: ${status.video_url}`)
      }
      if (status.fail_reason) {
        addLog('warn', `失败原因: ${status.fail_reason}`)
      }

      setResult(status)
      setStatus(`Status: ${status.status}, Progress: ${status.progress || 0}%`)

    } catch (error) {
      addLog('error', `❌ 查询失败: ${error}`)
      setStatus(`❌ Query failed: ${error}`)
    }
  }

  // 停止轮询
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      setPollingInterval(null)
      addLog('info', '已停止轮询')
      setIsGenerating(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
    addLog('info', '日志已清空')
  }

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-400'
      case 'warn': return 'text-yellow-400'
      case 'success': return 'text-green-400'
      default: return 'text-gray-300'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wuyin API 测试页面</h1>

      <Card>
        <CardHeader>
          <CardTitle>API 配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">模型选择</label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="veo3">veo3 (标准)</SelectItem>
                <SelectItem value="veo3-fast">veo3-fast (快速)</SelectItem>
                <SelectItem value="veo3.1-fast">veo3.1-fast (新快速)</SelectItem>
                <SelectItem value="veo3-pro">veo3-pro (专业)</SelectItem>
                <SelectItem value="veo3.1-pro">veo3.1-pro (新专业)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">宽高比</label>
            <Select value={ratio} onValueChange={(v) => setRatio(v as '16:9' | '9:16')}>
              <SelectTrigger>
                <SelectValue placeholder="选择宽高比" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (横屏)</SelectItem>
                <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">提示词</label>
            <textarea
              className="w-full min-h-[100px] px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-vertical"
              placeholder="输入视频生成提示词"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <label className="text-sm font-medium">参考图片 URL (可选，用于图生视频)</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={testConnection} variant="outline">
              测试连接
            </Button>
            <Button onClick={startGeneration} disabled={isGenerating}>
              开始生成
            </Button>
            <Button onClick={queryStatus} variant="outline" disabled={!taskId}>
              查询状态
            </Button>
            {pollingInterval && (
              <Button onClick={stopPolling} variant="destructive">
                停止轮询
              </Button>
            )}
          </div>

          {pollingInterval && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
              <div className="font-medium text-blue-900 dark:text-blue-100">
                ⏱️ 正在轮询中... (每{pollingInterval / 1000}秒)
              </div>
              <div className="text-blue-700 dark:text-blue-300 mt-1">
                任务ID: {taskId}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>当前状态</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="p-4 bg-muted rounded-md text-sm overflow-auto">
            {status || '准备测试...'}
          </pre>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>返回结果</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted rounded-md text-sm overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>

            {result.video_url && (
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">生成的视频:</div>
                <video
                  src={result.video_url}
                  controls
                  className="w-full max-w-2xl rounded-lg border"
                  onError={(e) => {
                    addLog('error', `视频加载失败: ${e.currentTarget.error?.message}`)
                  }}
                >
                  您的浏览器不支持视频播放
                </video>
                <div className="mt-2">
                  <a
                    href={result.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    在新标签页打开视频
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>环境配置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>VITE_WUYIN_API_KEY: {import.meta.env.VITE_WUYIN_API_KEY ? '✅ 已配置' : '❌ 未配置'}</div>
            <div>VITE_WUYIN_ENDPOINT: {import.meta.env.VITE_WUYIN_ENDPOINT || 'https://api.wuyinkeji.com'}</div>
            <div>VITE_PRIMARY_VIDEO_API: {import.meta.env.VITE_PRIMARY_VIDEO_API || 'not set'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>API 调用日志</CardTitle>
          <Button onClick={clearLogs} variant="outline" size="sm">
            清空日志
          </Button>
        </CardHeader>
        <CardContent>
          <div className="h-96 overflow-y-auto bg-black text-white p-4 rounded font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-gray-500">等待日志...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`mb-1 ${getLogColor(log.level)}`}>
                  <span className="text-gray-500">[{log.time}]</span>
                  <span className="font-bold">[{log.level.toUpperCase()}]</span>
                  {log.message}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
