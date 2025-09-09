import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Play, Settings, Activity, AlertCircle } from 'lucide-react'
import { getApicoreApiService } from '@/services/veo/ApicoreApiService'
import type { ApicoreCreateRequest } from '@/services/veo/ApicoreApiService'

interface TestResult {
  taskId?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  videoUrl?: string
  error?: string
  startTime: Date
  endTime?: Date
  logs: string[]
}

export default function TestApicoreApi() {
  const [apiKey, setApiKey] = useState(process.env.VITE_APICORE_API_KEY || '')
  const [endpoint, setEndpoint] = useState(import.meta.env.VITE_APICORE_ENDPOINT || 'https://api.apicore.ai')
  const [prompt, setPrompt] = useState('Generate a video of a monk playing basketball with a tomahawk dunk')
  const [quality, setQuality] = useState<'fast' | 'pro'>('fast')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9')
  const [hasImages, setHasImages] = useState(false)
  const [imageUrl, setImageUrl] = useState('https://filesystem.site/cdn/20250612/998IGmUiM2koBGZM3UnZeImbPBNIUL.png')
  const [enhancePrompt, setEnhancePrompt] = useState(true)
  
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [directQueryResult, setDirectQueryResult] = useState<string>('')
  const [isDirectTesting, setIsDirectTesting] = useState(false)

  // 按API官方示例直接查询任务
  const directQueryTest = async () => {
    if (!apiKey.trim()) {
      alert('请先输入API密钥')
      return
    }

    setIsDirectTesting(true)
    setDirectQueryResult('')

    try {
      console.log('[DIRECT QUERY] 开始按API官方示例测试...')
      
      // 完全按照API官方示例代码
      var myHeaders = new Headers();
      myHeaders.append("Authorization", `Bearer ${apiKey}`);

      var requestOptions = {
        method: 'GET' as const,
        headers: myHeaders,
        redirect: 'follow' as RequestRedirect
      };

      console.log('[DIRECT QUERY] 请求配置:', requestOptions)
      console.log('[DIRECT QUERY] Headers:', Array.from(myHeaders.entries()))
      
      const testTaskId = '1749557b-7087-41f1-8b5a-b8978e9b82d3' // 使用已知完成的任务
      const queryUrl = `https://api.apicore.ai/v1/video/generations/${testTaskId}`
      console.log('[DIRECT QUERY] 查询URL:', queryUrl)

      const response = await fetch(queryUrl, requestOptions)
      
      console.log('[DIRECT QUERY] 响应状态:', response.status)
      console.log('[DIRECT QUERY] 响应Headers:', Array.from(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[DIRECT QUERY] 请求失败:', response.status, errorText)
        setDirectQueryResult(`错误 (${response.status}): ${errorText}`)
        return
      }

      // 按API示例使用 response.text() 而不是 response.json()
      const result = await response.text()
      console.log('[DIRECT QUERY] 原始响应:', result)
      
      // 尝试解析JSON
      try {
        const jsonResult = JSON.parse(result)
        console.log('[DIRECT QUERY] 解析后JSON:', jsonResult)
        setDirectQueryResult(JSON.stringify(jsonResult, null, 2))
      } catch (parseError) {
        console.log('[DIRECT QUERY] JSON解析失败，显示原始文本')
        setDirectQueryResult(result)
      }
      
    } catch (error) {
      console.error('[DIRECT QUERY] 网络错误:', error)
      setDirectQueryResult(`网络错误: ${error}`)
    } finally {
      setIsDirectTesting(false)
    }
  }

  // 验证API密钥
  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      setIsApiKeyValid(false)
      return
    }

    try {
      const service = getApicoreApiService({ apiKey, endpoint })
      const isValid = await service.validateApiKey()
      setIsApiKeyValid(isValid)
    } catch (error) {
      console.error('API key validation failed:', error)
      setIsApiKeyValid(false)
    }
  }

  // 开始测试视频生成
  const startTest = async () => {
    if (!apiKey.trim()) {
      alert('请先输入API密钥')
      return
    }

    setIsTesting(true)
    const startTime = new Date()
    const logs: string[] = []

    const updateResult = (updates: Partial<TestResult>) => {
      setTestResult(prev => prev ? { ...prev, ...updates } : null)
    }

    const addLog = (message: string) => {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
      const logMessage = `[${timestamp}] ${message}`
      logs.push(logMessage)
      console.log(logMessage)
      updateResult({ logs: [...logs] })
    }

    try {
      // 初始化测试结果
      const initialResult: TestResult = {
        status: 'pending',
        progress: 0,
        startTime,
        logs: []
      }
      setTestResult(initialResult)

      // 初始化APICore服务
      addLog('初始化APICore服务...')
      const service = getApicoreApiService({ apiKey, endpoint })

      // 选择合适的模型
      const selectedModel = service.selectModel(quality, hasImages, aspectRatio)
      addLog(`选择模型: ${selectedModel}`)

      // 创建请求
      const request: ApicoreCreateRequest = {
        prompt,
        model: selectedModel,
        enhance_prompt: enhancePrompt,
        aspect_ratio: aspectRatio
      }

      if (hasImages && imageUrl.trim()) {
        request.images = [imageUrl.trim()]
        addLog(`添加图片: ${imageUrl}`)
      }

      // 创建视频任务
      addLog('创建视频生成任务...')
      const createResponse = await service.createVideo(request)
      
      if (!createResponse.data) {
        throw new Error(`任务创建失败: ${createResponse.message || 'No task ID returned'}`)
      }

      const taskId = createResponse.data
      addLog(`任务创建成功: ${taskId}`)
      updateResult({ 
        taskId,
        status: 'processing',
        progress: 5
      })

      // 轮询任务状态
      addLog('开始轮询任务状态...')
      const pollResult = await service.pollUntilComplete(
        taskId,
        (progress) => {
          addLog(`进度更新: ${progress}%`)
          updateResult({ progress })
        },
        60, // 最大60次尝试
        10000 // 每10秒查询一次
      )

      const videoUrl = pollResult.videoUrl || pollResult.video_url
      const finalStatus = pollResult.status || 'completed'

      if (videoUrl) {
        addLog(`视频生成完成！URL: ${videoUrl}`)
        updateResult({
          status: 'completed',
          progress: 100,
          videoUrl,
          endTime: new Date()
        })
      } else {
        throw new Error('视频生成完成但没有返回视频URL')
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addLog(`错误: ${errorMessage}`)
      updateResult({
        status: 'failed',
        error: errorMessage,
        endTime: new Date()
      })
    } finally {
      setIsTesting(false)
    }
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'failed': return 'bg-red-500'  
      case 'processing': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: TestResult['status']) => {
    switch (status) {
      case 'completed': return '✅ 完成'
      case 'failed': return '❌ 失败'
      case 'processing': return '🔄 处理中'
      default: return '⏳ 等待中'
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">APICore API 测试工具</h1>
        <p className="text-gray-600">测试APICore视频生成API的功能和性能</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 配置面板 */}
        <div className="space-y-6">
          {/* API配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                API配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">API密钥</label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="输入APICore API密钥"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={validateApiKey} variant="outline" disabled={!apiKey.trim()}>
                    验证
                  </Button>
                </div>
                {isApiKeyValid !== null && (
                  <div className="mt-2">
                    {isApiKeyValid ? (
                      <Badge variant="default" className="bg-green-500">✅ API密钥有效</Badge>
                    ) : (
                      <Badge variant="destructive">❌ API密钥无效</Badge>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">API端点</label>
                <Input
                  placeholder="https://api.apicore.ai"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 视频参数 */}
          <Card>
            <CardHeader>
              <CardTitle>视频参数</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">描述文本</label>
                <Textarea
                  placeholder="输入视频描述..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">质量</label>
                  <Select value={quality} onValueChange={(value) => setQuality(value as 'fast' | 'pro')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast (快速)</SelectItem>
                      <SelectItem value="pro">Pro (高质量)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">宽高比</label>
                  <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as '16:9' | '9:16')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (横屏)</SelectItem>
                      <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasImages"
                  checked={hasImages}
                  onChange={(e) => setHasImages(e.target.checked)}
                />
                <label htmlFor="hasImages" className="text-sm font-medium">包含图片</label>
              </div>

              {hasImages && (
                <div>
                  <label className="block text-sm font-medium mb-2">图片URL</label>
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="enhancePrompt"
                  checked={enhancePrompt}
                  onChange={(e) => setEnhancePrompt(e.target.checked)}
                />
                <label htmlFor="enhancePrompt" className="text-sm font-medium">增强提示词</label>
              </div>
            </CardContent>
          </Card>

          {/* 开始测试按钮 */}
          <div className="space-y-3">
            <Button 
              onClick={startTest} 
              disabled={isTesting || !apiKey.trim()} 
              className="w-full"
              size="lg"
            >
              {isTesting ? (
                <>
                  <Activity className="mr-2 h-4 w-4 animate-spin" />
                  测试进行中...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  开始测试
                </>
              )}
            </Button>
            
            {/* API官方示例直接查询 */}
            <Button 
              onClick={directQueryTest} 
              disabled={isDirectTesting || !apiKey.trim()} 
              className="w-full"
              size="lg"
              variant="outline"
            >
              {isDirectTesting ? (
                <>
                  <Activity className="mr-2 h-4 w-4 animate-spin" />
                  直接查询中...
                </>
              ) : (
                <>
                  <Settings className="mr-2 h-4 w-4" />
                  API官方示例查询
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 结果面板 */}
        <div className="space-y-6">
          {/* 测试状态 */}
          {testResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  测试结果
                  <Badge className={getStatusColor(testResult.status)}>
                    {getStatusText(testResult.status)}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {testResult.taskId && `任务ID: ${testResult.taskId}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 进度条 */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>进度</span>
                      <span>{testResult.progress}%</span>
                    </div>
                    <Progress value={testResult.progress} className="w-full" />
                  </div>

                  {/* 时间信息 */}
                  <div className="text-sm text-gray-600">
                    <div>开始时间: {testResult.startTime.toLocaleTimeString()}</div>
                    {testResult.endTime && (
                      <div>完成时间: {testResult.endTime.toLocaleTimeString()}</div>
                    )}
                    {testResult.endTime && (
                      <div>耗时: {Math.round((testResult.endTime.getTime() - testResult.startTime.getTime()) / 1000)}秒</div>
                    )}
                  </div>

                  {/* 错误信息 */}
                  {testResult.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{testResult.error}</AlertDescription>
                    </Alert>
                  )}

                  {/* 生成的视频 */}
                  {testResult.videoUrl && (
                    <div>
                      <label className="block text-sm font-medium mb-2">生成的视频</label>
                      <video
                        controls
                        className="w-full rounded-lg"
                        style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                      >
                        <source src={testResult.videoUrl} type="video/mp4" />
                        您的浏览器不支持视频播放
                      </video>
                      <div className="mt-2">
                        <a
                          href={testResult.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm break-all"
                        >
                          {testResult.videoUrl}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* API官方示例查询结果 */}
          {directQueryResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  API官方示例查询结果
                </CardTitle>
                <CardDescription>
                  使用完全相同的API官方示例代码
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap">
                    {directQueryResult}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 日志 */}
          {testResult && testResult.logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>执行日志</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {testResult.logs.map((log, index) => (
                    <div key={index} className="text-sm font-mono text-gray-800 mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}