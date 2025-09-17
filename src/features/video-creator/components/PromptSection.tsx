import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Copy, Lock, Gem } from 'lucide-react'
import { Template } from '../data/templates'
import { Button } from '@/components/ui/button'
import { PromptGenerator } from '@/services/promptGenerator'
import { useAuth } from '@/contexts/AuthContext'
import { SubscriptionService } from '@/services/subscriptionService'
import { edgeCacheClient } from '@/services/EdgeFunctionCacheClient'
import { useQuery } from '@tanstack/react-query'
import type { Subscription } from '@/types'

interface PromptSectionProps {
  template: Template
  params: Record<string, any>
  aspectRatio?: '16:9' | '9:16'  // 新增宽高比参数
}

export default function PromptSection({
  template,
  params,
  aspectRatio
}: PromptSectionProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [showPromptDebug, setShowPromptDebug] = useState(false)
  
  // 强制刷新key，确保在aspectRatio变化时重新渲染
  const [refreshKey, setRefreshKey] = useState(0)
  
  // 当aspectRatio变化时，强制重新渲染
  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [aspectRatio])

  // 获取用户订阅信息
  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      
      try {
        // 优先使用缓存获取订阅信息
        const tier = await edgeCacheClient.getUserSubscription(user.id)
        
        if (tier && tier !== 'free') {
          // 如果有有效订阅，构建subscription对象
          return {
            id: '',
            userId: user.id,
            stripeSubscriptionId: '',
            planId: tier as any,
            status: 'active' as const,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            cancelAtPeriodEnd: false,
            createdAt: new Date(),
            updatedAt: new Date()
          } as Subscription
        } else {
          // 免费用户或缓存未命中时，使用原方法
          return await SubscriptionService.getCurrentSubscription(user.id)
        }
      } catch (error) {
        console.error('[PromptSection] 加载订阅信息失败:', error)
        return null
      }
    },
    enabled: !!user?.id
  })

  // 检查用户是否有有效订阅（不依赖积分数量）
  const isSubscribed = useMemo(() => !!(
    subscription && 
    subscription.status === 'active' && 
    subscription.planId
  ), [subscription])

  const generatePrompt = useMemo(() => {
    // 如果aspectRatio未定义，使用默认值16:9
    const finalAspectRatio = aspectRatio || '16:9';
    
    const result = PromptGenerator.generateJsonPrompt(template, params, finalAspectRatio);
    return result;
  }, [template, params, aspectRatio, refreshKey])

  const copyPromptToClipboard = async () => {
    const promptResult = generatePrompt
    
    // 根据结果类型决定复制内容
    const textToCopy = typeof promptResult === 'string' 
      ? promptResult 
      : JSON.stringify(promptResult, null, 2)
    
    try {
      await navigator.clipboard.writeText(textToCopy)
      console.log('提示词已复制到剪贴板', typeof promptResult === 'string' ? '(文本格式)' : '(JSON格式)')
    } catch (error) {
      console.error('复制失败:', error)
      // 降级方案：创建临时 textarea 进行复制
      const textarea = document.createElement('textarea')
      textarea.value = textToCopy
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      console.log('提示词已复制到剪贴板 (降级方案)')
    }
  }

  return (
    <div className="border-t border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          {t('configPanel.prompt')}
          {!isSubscribed && <Lock className="h-3.5 w-3.5" />}
        </span>
        {isSubscribed && (
          <div className="flex gap-1">
            <button
              className="p-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
              onClick={() => setShowPromptDebug(!showPromptDebug)}
              title={showPromptDebug ? t('configPanel.hidePrompt') : t('configPanel.viewPrompt')}
            >
              {showPromptDebug ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              className="p-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
              onClick={copyPromptToClipboard}
              title={t('configPanel.copyPrompt')}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      
      {isSubscribed ? (
        // 订阅用户：显示完整提示词
        showPromptDebug && (
          <div className="bg-background border border-border rounded-md p-3 max-h-40 overflow-y-auto">
            <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono">
              {(() => {
                // 直接使用最新的generatePrompt结果
                const content = typeof generatePrompt === 'string' 
                  ? generatePrompt 
                  : JSON.stringify(generatePrompt, null, 2);
                return content;
              })()}
            </pre>
          </div>
        )
      ) : (
        // 免费用户：显示升级提示
        <div className="bg-background border border-border rounded-md p-4 text-center">
          <div className="flex items-center justify-center mb-3">
            <div className="p-2 rounded-full bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t('configPanel.promptAccessRequired')}
          </p>
          <Link to="/pricing">
            <Button size="sm" variant="default" className="text-sm">
              <Gem className="h-4 w-4 mr-2" />
              {t('configPanel.upgradeToUnlock')}
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}