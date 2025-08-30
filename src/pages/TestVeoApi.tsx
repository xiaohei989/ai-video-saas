import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import veo3Service from '@/services/veo3Service'
// 移除已删除的 Google API 相关服务

interface LogEntry {
  time: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

export default function TestVeoApi() {
  const [provider, setProvider] = useState<'google' | 'qingyun'>(process.env.VEO_API_PROVIDER as 'google' | 'qingyun' || 'google')
  const [prompt, setPrompt] = useState('A super-realistic 8K close-up: showing a hand gently pouring out many miniature cans of drinks from a transparent glass jar, including miniature Coca-Cola, miniature Pepsi, and miniature Sprite, pouring the canned drinks onto a thick golden slice of freshly baked toast with a crispy surface, and then using a knife to spread the miniature cans on the toast. The cans are spread on the toast like butter, and the knife slowly and smoothly cuts across the toast, leaving a soft texture on the toast as the shining butter is evenly spread. The whole scene has the crisp sound of metal hitting glass, the sound of metal and bread rubbing against each other, and the scene is softly illuminated by warm studio lights. The shallow depth of field blurs the background, focusing on the texture of the toast and the shining diamond butter. Shot from top to bottom, ASMR cooking video perspective - no interference, only pure visual enjoyment.')
  const [status, setStatus] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])

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

  // 启动时验证环境变量
  useEffect(() => {
    addLog('info', '=== 初始化 Veo API 测试页面 ===')
    addLog('info', '检查环境变量配置...')
    
    // 显示当前API提供商
    addLog('info', `当前API提供商: ${provider.toUpperCase()}`)
    addLog('info', `VEO_API_PROVIDER: ${process.env.VEO_API_PROVIDER || 'not set'}`)
    
    // 检查Google配置
    if (process.env.VEO_API_KEYS) {
      const keys = process.env.VEO_API_KEYS.split(',')
      addLog('success', `✅ Google: 找到 ${keys.length} 个 API Key`)
      keys.forEach((key, index) => {
        addLog('info', `  Google Key ${index + 1}: ${key.substring(0, 10)}...${key.substring(key.length - 4)}`)
      })
    } else {
      addLog('warn', '⚠️ Google: 未配置 VEO_API_KEYS')
    }
    
    // 检查青云配置
    if (process.env.QINGYUN_API_KEY) {
      addLog('success', `✅ 青云: API Key 已配置`)
      const key = process.env.QINGYUN_API_KEY
      addLog('info', `  青云 Key: ${key.substring(0, 10)}...${key.substring(key.length - 4)}`)
      addLog('info', `  青云端点: ${process.env.QINGYUN_API_ENDPOINT || 'https://api.qingyuntop.top'}`)
      addLog('info', `  默认质量: ${process.env.QINGYUN_DEFAULT_QUALITY || 'fast'}`)
    } else {
      addLog('warn', '⚠️ 青云: 未配置 QINGYUN_API_KEY')
    }
    
    addLog('info', `VEO_USE_REAL_API: ${process.env.VEO_USE_REAL_API || 'not set'}`)
    addLog('info', '=== 初始化完成 ===')
  }, [])

  // 监听 API 调用日志
  useEffect(() => {
    const handleApiLog = (event: MessageEvent) => {
      if (event.data?.type === 'VEO_API_LOG') {
        const { method, url, body, response } = event.data.data
        addLog('info', `[API ${method}] ${url}`)
        if (body) addLog('info', `[API Body] ${body}`)
        if (response) addLog('info', `[API Response] ${response}`)
      }
    }
    
    window.addEventListener('message', handleApiLog)
    return () => window.removeEventListener('message', handleApiLog)
  }, [])

  const testConnection = async () => {
    addLog('info', `开始测试 ${provider.toUpperCase()} API 连接...`)
    setStatus(`Testing ${provider.toUpperCase()} API connection...`)
    
    try {
      // 临时设置提供商
      const originalProvider = process.env.VEO_API_PROVIDER
      process.env.VEO_API_PROVIDER = provider
      
      if (provider === 'google') {
        const apiKey = process.env.VEO_API_KEYS?.split(',')[0]
        if (apiKey) {
          addLog('info', `使用 Google API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`)
        }
      } else {
        const apiKey = process.env.QINGYUN_API_KEY
        if (apiKey) {
          addLog('info', `使用青云 API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`)
        }
      }
      
      const health = await veo3Service.checkAccountHealth()
      
      addLog('success', `✅ ${provider.toUpperCase()} 连接成功！`)
      addLog('info', `可用配额: ${health.availableQuota}`)
      addLog('info', `健康账户: ${health.healthy}/${health.total}`)
      setStatus(`✅ ${provider.toUpperCase()} Connection successful! Available quota: ${health.availableQuota}`)
      
      // 恢复原始提供商
      process.env.VEO_API_PROVIDER = originalProvider
      
    } catch (error) {
      addLog('error', `❌ ${provider.toUpperCase()} 连接失败: ${error}`)
      setStatus(`❌ ${provider.toUpperCase()} Connection failed: ${error}`)
    }
  }

  const testMockGeneration = async () => {
    addLog('info', '=== 开始模拟视频生成测试 ===')
    addLog('info', `提示词: "${prompt}"`)
    setStatus('Starting mock video generation...')
    setIsGenerating(true)
    
    try {
      // Force mock mode
      const originalEnv = process.env.VEO_USE_REAL_API
      process.env.VEO_USE_REAL_API = 'false'
      addLog('info', '已切换到模拟模式 (VEO_USE_REAL_API=false)')
      
      addLog('info', '调用 veo3Service.generateVideo()...')
      const response = await veo3Service.generateVideo({
        prompt,
        template: 'test-template',
        parameters: {},
        credits: 1,
        model: 'fast'
      })
      
      addLog('success', `✅ 生成请求已创建，ID: ${response.id}`)
      setResult(response)
      setStatus('✅ Mock generation started!')
      
      // Subscribe to status updates
      addLog('info', '订阅状态更新...')
      const unsubscribe = veo3Service.subscribeToStatus(response.id, (update) => {
        addLog('info', `状态更新: ${JSON.stringify(update)}`)
        setStatus(`Progress: ${update.progress || 0}%`)
        
        if (update.status === 'completed') {
          addLog('success', '✅ 模拟视频生成成功！')
          setStatus('✅ Mock video generated successfully!')
          setIsGenerating(false)
        } else if (update.status === 'failed') {
          addLog('error', `❌ 生成失败: ${update.error}`)
          setStatus(`❌ Generation failed: ${update.error}`)
          setIsGenerating(false)
        }
      })
      
      // Restore env
      process.env.VEO_USE_REAL_API = originalEnv
      
      // Cleanup after 1 minute
      setTimeout(unsubscribe, 60000)
      
    } catch (error) {
      setStatus(`❌ Error: ${error}`)
      setIsGenerating(false)
    }
  }

  const testRealGeneration = async () => {
    // 检查API Key配置
    if (provider === 'google' && !process.env.VEO_API_KEYS) {
      addLog('error', '❌ 请先配置 Google API Key (VEO_API_KEYS)')
      setStatus('❌ Please configure Google API key first')
      return
    }
    if (provider === 'qingyun' && !process.env.QINGYUN_API_KEY) {
      addLog('error', '❌ 请先配置青云 API Key (QINGYUN_API_KEY)')
      setStatus('❌ Please configure Qingyun API key first')
      return
    }
    
    addLog('info', `=== 开始 ${provider.toUpperCase()} API 视频生成测试 ===`)
    addLog('info', `API 提供商: ${provider.toUpperCase()}`)
    addLog('info', `提示词: "${prompt}"`)
    addLog('info', '模型: veo-3.0-fast (快速模式)')
    addLog('info', '宽高比: 16:9')
    
    setStatus(`Starting ${provider.toUpperCase()} video generation...`)
    setIsGenerating(true)
    
    try {
      // 临时设置提供商
      const originalProvider = process.env.VEO_API_PROVIDER
      process.env.VEO_API_PROVIDER = provider
      process.env.VEO_USE_REAL_API = 'true'
      addLog('info', `已切换到 ${provider.toUpperCase()} 真实 API 模式`)
      
      addLog('info', '创建生成请求...')
      const startTime = Date.now()
      
      const response = await veo3Service.generateVideo({
        prompt,
        template: 'test-template',
        parameters: {},
        credits: 1,
        aspectRatio: '16:9',
        model: 'fast'  // 使用快速模式
      })
      
      const requestTime = Date.now() - startTime
      addLog('success', `✅ 请求创建成功 (耗时: ${requestTime}ms)`)
      addLog('info', `任务 ID: ${response.id}`)
      
      setResult(response)
      setStatus('✅ Video generation started!')
      
      // Subscribe to status updates
      addLog('info', '订阅状态更新...')
      const pollStartTime = Date.now()
      let pollCount = 0
      
      const unsubscribe = veo3Service.subscribeToStatus(response.id, (update) => {
        pollCount++
        const elapsed = Math.floor((Date.now() - pollStartTime) / 1000)
        
        addLog('info', `[轮询 #${pollCount}] 已用时: ${elapsed}秒`)
        addLog('info', `状态更新: ${JSON.stringify(update, null, 2)}`)
        setStatus(`Progress: ${update.data.progress || 0}%`)
        
        if (update.type === 'complete') {
          const totalTime = Math.floor((Date.now() - pollStartTime) / 1000)
          addLog('success', `✅ 视频生成成功！总耗时: ${totalTime}秒`)
          addLog('info', `视频 URL: ${update.data.videoUrl}`)
          setStatus('✅ Video generated successfully!')
          setResult(update.data)
          setIsGenerating(false)
        } else if (update.type === 'error') {
          addLog('error', `❌ 生成失败: ${update.data.error}`)
          setStatus(`❌ Generation failed: ${update.data.error}`)
          setIsGenerating(false)
        }
      })
      
      // Cleanup after 10 minutes
      setTimeout(unsubscribe, 600000)
      
      // 恢复原始提供商
      process.env.VEO_API_PROVIDER = originalProvider
      
    } catch (error) {
      addLog('error', `❌ 错误: ${error}`)
      addLog('error', `错误堆栈: ${error instanceof Error ? error.stack : 'N/A'}`)
      setStatus(`❌ Error: ${error}`)
      setIsGenerating(false)
    }
  }

  const checkQueueStatus = () => {
    addLog('info', '检查队列状态...')
    const queueStatus = veo3Service.getQueueStatus()
    const stats = veo3Service.getStatistics()
    
    addLog('info', `队列状态: ${JSON.stringify(queueStatus, null, 2)}`)
    addLog('info', `统计信息: ${JSON.stringify(stats, null, 2)}`)
    
    setStatus(JSON.stringify({ queue: queueStatus, stats }, null, 2))
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
      <h1 className="text-3xl font-bold">Video Generation API Test</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">API Provider</label>
            <Select value={provider} onValueChange={(value) => setProvider(value as 'google' | 'qingyun')}>
              <SelectTrigger>
                <SelectValue placeholder="选择API提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Veo3</SelectItem>
                <SelectItem value="qingyun">青云 API</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-2 p-3 bg-muted rounded-md text-sm">
              {provider === 'google' ? (
                <div className="space-y-1">
                  <div className="font-medium">Google Veo3 配置状态：</div>
                  <div>API Key: {process.env.VEO_API_KEYS ? '✅ 已配置' : '❌ 未配置'}</div>
                  <div className="text-xs text-muted-foreground">获取 API Key: https://aistudio.google.com/</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="font-medium">青云 API 配置状态：</div>
                  <div>API Key: {process.env.QINGYUN_API_KEY ? '✅ 已配置' : '❌ 未配置'}</div>
                  <div>端点: {process.env.QINGYUN_API_ENDPOINT || 'https://api.qingyuntop.top'}</div>
                  <div>默认质量: {process.env.QINGYUN_DEFAULT_QUALITY || 'fast'}</div>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium">Test Prompt</label>
            <textarea
              className="w-full min-h-[150px] px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-vertical"
              placeholder="Enter a video prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
            />
          </div>
          
          <div className="flex gap-2">
            <Button onClick={testConnection}>Test Connection</Button>
            <Button onClick={testRealGeneration} disabled={isGenerating}>
              Test Real API
            </Button>
            <Button onClick={checkQueueStatus} variant="outline">
              Check Queue Status
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="p-4 bg-muted rounded-md text-sm overflow-auto">
            {status || 'Ready to test...'}
          </pre>
        </CardContent>
      </Card>
      
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted rounded-md text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Environment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>当前提供商: {provider.toUpperCase()}</div>
            <div>VEO_API_PROVIDER: {process.env.VEO_API_PROVIDER || 'not set'}</div>
            <div>VEO_USE_REAL_API: {process.env.VEO_USE_REAL_API || 'not set'}</div>
            <div className="pt-2 border-t">
              <div className="font-medium mb-1">Google 配置:</div>
              <div className="pl-4">API Keys: {process.env.VEO_API_KEYS ? '✅ 已配置' : '❌ 未配置'}</div>
              <div className="pl-4">Model: {process.env.VEO_MODEL_VERSION || 'not set'}</div>
            </div>
            <div className="pt-2 border-t">
              <div className="font-medium mb-1">青云配置:</div>
              <div className="pl-4">API Key: {process.env.QINGYUN_API_KEY ? '✅ 已配置' : '❌ 未配置'}</div>
              <div className="pl-4">端点: {process.env.QINGYUN_API_ENDPOINT || 'default'}</div>
              <div className="pl-4">质量: {process.env.QINGYUN_DEFAULT_QUALITY || 'fast'}</div>
            </div>
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