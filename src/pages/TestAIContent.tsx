import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import aiContentService from '@/services/aiContentService'

export default function TestAIContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    title: string
    description: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    templateName: 'Baby Professional Interview',
    prompt: 'A cynical female reporter interviews a happy-go-lucky baby in a tiny taxi driver uniform with cap, sitting in a toy car. Outside a busy transportation hub at night, with taxis and ride-share vehicles waiting.',
    parameters: JSON.stringify({
      baby_profession: 'uber_driver',
      reporter_question: 'Driving strangers around all day, isn\'t it exhausting?',
      baby_response: 'No way! I meet so many interesting people and explore new places!'
    }, null, 2),
    userLanguage: 'zh-CN'
  })

  const handleTest = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)
    
    try {
      let parameters = {}
      try {
        parameters = JSON.parse(formData.parameters)
      } catch (e) {
        parameters = {}
      }
      
      const metadata = await aiContentService.generateVideoMetadata({
        templateName: formData.templateName,
        prompt: formData.prompt,
        parameters: parameters,
        userLanguage: formData.userLanguage
      })
      
      setResult(metadata)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleServiceHealthCheck = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const isHealthy = await aiContentService.checkServiceHealth()
      setResult({
        title: isHealthy ? '✅ 服务可用' : '❌ 服务不可用',
        description: isHealthy 
          ? 'APICore服务连接正常，可以正常生成内容' 
          : 'APICore服务连接失败，请检查API密钥和网络连接'
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '健康检查失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">AI内容生成测试</h1>
          <p className="text-muted-foreground mt-2">
            测试AI自动生成视频标题和简介功能
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 输入表单 */}
          <Card>
            <CardHeader>
              <CardTitle>测试参数</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="templateName">模板名称</Label>
                <Input
                  id="templateName"
                  value={formData.templateName}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    templateName: e.target.value 
                  }))}
                  placeholder="输入模板名称"
                />
              </div>
              
              <div>
                <Label htmlFor="prompt">视频提示词</Label>
                <Textarea
                  id="prompt"
                  value={formData.prompt}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    prompt: e.target.value 
                  }))}
                  placeholder="输入视频生成提示词"
                  rows={4}
                />
              </div>
              
              <div>
                <Label htmlFor="parameters">参数 (JSON格式)</Label>
                <Textarea
                  id="parameters"
                  value={formData.parameters}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    parameters: e.target.value 
                  }))}
                  placeholder="输入JSON格式的参数"
                  rows={6}
                />
              </div>
              
              <div>
                <Label htmlFor="userLanguage">用户语言</Label>
                <select
                  id="userLanguage"
                  value={formData.userLanguage}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    userLanguage: e.target.value 
                  }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                >
                  <option value="zh-CN">中文</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                  <option value="ko">한국어</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleTest} 
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    '生成标题和简介'
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={handleServiceHealthCheck}
                  disabled={isLoading}
                >
                  健康检查
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 结果显示 */}
          <Card>
            <CardHeader>
              <CardTitle>生成结果</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
              )}
              
              {result && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">生成成功</span>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">标题</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md">
                      <p className="text-sm">{result.title}</p>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">简介</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md">
                      <p className="text-sm">{result.description}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {!result && !error && !isLoading && (
                <div className="text-center text-muted-foreground py-8">
                  <p>点击"生成标题和简介"按钮开始测试</p>
                </div>
              )}
              
              {isLoading && (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground mt-2">AI正在生成内容...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• <strong>主模型:</strong> GPT-3.5-turbo-0125</p>
              <p>• <strong>备用模型:</strong> Claude-3.5-haiku-20241022</p>
              <p>• <strong>生成模式:</strong> JSON格式输出</p>
              <p>• <strong>超时设置:</strong> 10秒</p>
              <p>• <strong>温度参数:</strong> 0.7 (创意与一致性平衡)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}