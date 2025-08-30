/**
 * 标题特效演示页面
 * 用于测试和展示不同的动画效果
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AnimatedHeroTitle, { 
  FlowingHeroTitle, 
  RainbowHeroTitle, 
  NeonHeroTitle 
} from '@/components/ui/AnimatedHeroTitle'

export default function TitleEffectDemo() {
  const [currentEffect, setCurrentEffect] = useState<'flowing' | 'rainbow' | 'neon' | 'pulse' | 'glitch'>('flowing')
  const [animationSpeed, setAnimationSpeed] = useState<'slow' | 'normal' | 'fast'>('normal')
  
  const demoText = "Viral Videos Made Simple"
  
  const effects = [
    { 
      value: 'flowing' as const, 
      label: '流光渐变', 
      description: '彩色渐变背景从左到右流动，产生流光效果' 
    },
    { 
      value: 'rainbow' as const, 
      label: '彩虹渐变', 
      description: '彩虹色彩连续渐变移动，色彩丰富' 
    },
    { 
      value: 'neon' as const, 
      label: '霓虹发光', 
      description: '青色霓虹灯效果，带闪烁和发光' 
    },
    { 
      value: 'pulse' as const, 
      label: '脉冲发光', 
      description: '紫蓝渐变背景带脉冲发光效果' 
    },
    { 
      value: 'glitch' as const, 
      label: '故障风格', 
      description: 'Cyberpunk风格的故障闪烁效果' 
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* 页面标题 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Hero标题特效演示
          </h1>
          <p className="text-gray-300">
            测试不同的动画特效和配置选项
          </p>
        </div>

        {/* 主演示区域 */}
        <div className="text-center mb-12 p-12 bg-black/30 rounded-xl backdrop-blur-sm">
          <AnimatedHeroTitle
            text={demoText}
            effectType={currentEffect}
            size="xl"
            animationSpeed={animationSpeed}
            enableHover={true}
            enableBreathing={true}
            glowIntensity="medium"
          />
        </div>

        {/* 控制面板 */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* 特效选择 */}
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">特效类型</CardTitle>
              <CardDescription className="text-gray-300">
                选择不同的动画特效
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {effects.map((effect) => (
                <div key={effect.value}>
                  <Button
                    variant={currentEffect === effect.value ? "default" : "outline"}
                    onClick={() => setCurrentEffect(effect.value)}
                    className="w-full justify-start mb-2"
                  >
                    {effect.label}
                  </Button>
                  {currentEffect === effect.value && (
                    <p className="text-sm text-gray-300 pl-4">
                      {effect.description}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 动画设置 */}
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">动画设置</CardTitle>
              <CardDescription className="text-gray-300">
                调整动画速度和效果
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  动画速度
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['slow', 'normal', 'fast'] as const).map((speed) => (
                    <Button
                      key={speed}
                      variant={animationSpeed === speed ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAnimationSpeed(speed)}
                    >
                      {speed === 'slow' ? '慢' : speed === 'normal' ? '正常' : '快'}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 预设组件演示 */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white text-center">
            预设组件演示
          </h2>
          
          <div className="grid gap-8">
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm p-8 text-center">
              <CardTitle className="text-white mb-4">流光标题 (FlowingHeroTitle)</CardTitle>
              <FlowingHeroTitle text={demoText} size="lg" />
            </Card>
            
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm p-8 text-center">
              <CardTitle className="text-white mb-4">彩虹标题 (RainbowHeroTitle)</CardTitle>
              <RainbowHeroTitle text={demoText} size="lg" />
            </Card>
            
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm p-8 text-center">
              <CardTitle className="text-white mb-4">霓虹标题 (NeonHeroTitle)</CardTitle>
              <NeonHeroTitle text={demoText} size="lg" />
            </Card>
          </div>
        </div>

        {/* 技术说明 */}
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">技术实现</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300 space-y-4">
            <div>
              <h4 className="font-semibold text-white mb-2">特效技术：</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>CSS渐变背景 + background-clip: text 实现文字渐变</li>
                <li>CSS动画关键帧控制渐变位置移动</li>
                <li>Text-shadow 实现发光效果</li>
                <li>Transform 动画实现Glitch故障效果</li>
                <li>Filter drop-shadow 增强视觉效果</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-2">性能优化：</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>GPU加速: will-change, backface-visibility</li>
                <li>响应式设计: 移动端简化动画</li>
                <li>无障碍支持: prefers-reduced-motion 适配</li>
                <li>高对比度模式适配</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}