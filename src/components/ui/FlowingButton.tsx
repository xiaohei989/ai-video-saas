/**
 * 流光特效按钮组件
 * 
 * 实现多种炫酷的按钮特效：
 * 1. 流光边框动画
 * 2. 渐变背景流动
 * 3. 悬停增强效果
 * 4. 点击反馈动画
 */

import React, { useState, forwardRef } from 'react'
import { cn } from '@/utils/cn'
import { Button, ButtonProps } from '@/components/ui/button'

export interface FlowingButtonProps extends ButtonProps {
  flowType?: 'border' | 'background' | 'both'
  flowSpeed?: 'slow' | 'normal' | 'fast'
  flowColors?: string[]
  glowIntensity?: 'subtle' | 'medium' | 'strong'
  enableClickEffect?: boolean
  children: React.ReactNode
}

const FlowingButton = forwardRef<HTMLButtonElement, FlowingButtonProps>(({
  className,
  flowType = 'both',
  flowSpeed = 'normal',
  flowColors,
  glowIntensity = 'medium',
  enableClickEffect = true,
  children,
  disabled,
  ...props
}, ref) => {
  const [isPressed, setIsPressed] = useState(false)

  // 默认流光颜色
  const defaultColors = [
    '#8b5cf6', // 紫色
    '#3b82f6', // 蓝色
    '#06b6d4', // 青色
    '#10b981', // 绿色
    '#f59e0b', // 黄色
    '#ef4444', // 红色
    '#ec4899', // 粉色
  ]

  const colors = flowColors || defaultColors
  const colorStops = colors.join(', ')

  // 速度映射
  const speedClasses = {
    slow: 'animate-flowing-border-slow',
    normal: 'animate-flowing-border',
    fast: 'animate-flowing-border-fast'
  }

  const bgSpeedClasses = {
    slow: 'animate-flowing-bg-slow',
    normal: 'animate-flowing-bg',
    fast: 'animate-flowing-bg-fast'
  }

  // 发光强度
  const glowClasses = {
    subtle: 'drop-shadow-glow-subtle',
    medium: 'drop-shadow-glow-medium',
    strong: 'drop-shadow-glow-strong'
  }

  const handleMouseDown = () => setIsPressed(true)
  const handleMouseUp = () => setIsPressed(false)
  const handleMouseLeave = () => setIsPressed(false)

  return (
    <div className="relative inline-block group">
      {/* 流光边框层 */}
      {(flowType === 'border' || flowType === 'both') && (
        <div 
          className={cn(
            'absolute inset-0 rounded-lg p-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            speedClasses[flowSpeed],
            disabled && 'opacity-50'
          )}
          style={{
            background: `linear-gradient(45deg, ${colorStops}, ${colors[0]})`,
            backgroundSize: '300% 100%',
          }}
        >
          <div className="w-full h-full bg-black rounded-lg" />
        </div>
      )}

      {/* 主按钮 */}
      <Button
        ref={ref}
        className={cn(
          'relative overflow-hidden transition-all duration-300',
          'hover:scale-105 active:scale-95',
          
          // 流光背景
          (flowType === 'background' || flowType === 'both') && [
            'bg-gradient-to-r',
            bgSpeedClasses[flowSpeed]
          ],
          
          // 发光效果
          !disabled && glowClasses[glowIntensity],
          
          // 点击效果
          isPressed && enableClickEffect && 'transform scale-95',
          
          // 禁用状态
          disabled && 'opacity-50 cursor-not-allowed',
          
          className
        )}
        style={(flowType === 'background' || flowType === 'both') ? {
          background: `linear-gradient(45deg, ${colorStops}, ${colors[0]})`,
          backgroundSize: '300% 100%',
        } : undefined}
        disabled={disabled}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* 内容层 */}
        <span className="relative z-10 flex items-center gap-2">
          {children}
        </span>
        
        {/* 悬停光晕效果 */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-white rounded-lg" />
        
        {/* 点击涟漪效果 */}
        {isPressed && enableClickEffect && (
          <div className="absolute inset-0 bg-white opacity-30 rounded-lg animate-ping" />
        )}
      </Button>
    </div>
  )
})

FlowingButton.displayName = "FlowingButton"

// 预设样式的流光按钮
export const PrimaryFlowingButton = forwardRef<HTMLButtonElement, Omit<FlowingButtonProps, 'variant'>>(
  (props, ref) => (
    <FlowingButton
      ref={ref}
      variant="default"
      flowType="both"
      flowSpeed="normal"
      glowIntensity="medium"
      {...props}
    />
  )
)

export const OutlineFlowingButton = forwardRef<HTMLButtonElement, Omit<FlowingButtonProps, 'variant'>>(
  (props, ref) => (
    <FlowingButton
      ref={ref}
      variant="outline"
      flowType="border"
      flowSpeed="normal"
      glowIntensity="subtle"
      {...props}
    />
  )
)

export const NeonFlowingButton = forwardRef<HTMLButtonElement, Omit<FlowingButtonProps, 'variant' | 'flowColors'>>(
  (props, ref) => (
    <FlowingButton
      ref={ref}
      variant="default"
      flowType="both"
      flowSpeed="fast"
      flowColors={['#00ffff', '#0080ff', '#8000ff', '#ff00ff', '#ff0080']}
      glowIntensity="strong"
      {...props}
    />
  )
)

PrimaryFlowingButton.displayName = "PrimaryFlowingButton"
OutlineFlowingButton.displayName = "OutlineFlowingButton" 
NeonFlowingButton.displayName = "NeonFlowingButton"

export default FlowingButton