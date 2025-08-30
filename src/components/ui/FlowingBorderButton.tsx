/**
 * 边框流光按钮组件
 * 
 * 基于定价页面的按钮样式，添加边框流光特效
 * 保持原有的 Button 组件样式和交互行为
 */

import React, { forwardRef } from 'react'
import { cn } from '@/utils/cn'
import { Button, ButtonProps } from '@/components/ui/button'

export interface FlowingBorderButtonProps extends ButtonProps {
  flowSpeed?: 'slow' | 'normal' | 'fast'
  flowColors?: string[]
  showFlowOnHover?: boolean
  glowIntensity?: 'none' | 'subtle' | 'medium' | 'strong'
}

const FlowingBorderButton = forwardRef<HTMLButtonElement, FlowingBorderButtonProps>(({
  className,
  children,
  variant = 'default',
  size = 'lg',
  flowSpeed = 'normal',
  flowColors,
  showFlowOnHover = false,
  glowIntensity = 'medium',
  disabled,
  ...props
}, ref) => {
  // 默认流光颜色 - 使用紫色系配合主题
  const defaultColors = [
    '#8b5cf6', // 紫色
    '#3b82f6', // 蓝色 
    '#06b6d4', // 青色
    '#10b981', // 绿色
    '#f59e0b', // 黄色
    '#ef4444', // 红色
    '#ec4899', // 粉色
    '#8b5cf6'  // 回到紫色
  ]

  const colors = flowColors || defaultColors
  const colorStops = colors.join(', ')

  // 速度映射
  const speedClasses = {
    slow: 'animate-flowing-border-slow',
    normal: 'animate-flowing-border',
    fast: 'animate-flowing-border-fast'
  }

  // 发光强度
  const glowClasses = {
    none: '',
    subtle: 'drop-shadow-glow-subtle',
    medium: 'drop-shadow-glow-medium',
    strong: 'drop-shadow-glow-strong'
  }

  // 根据variant决定是否显示流光效果
  const shouldShowFlow = !disabled && (variant === 'default' || variant === 'outline')

  return (
    <div className="relative inline-block group">
      {/* 流光边框层 */}
      {shouldShowFlow && (
        <div 
          className={cn(
            'absolute inset-0 rounded-md p-[2px]',
            showFlowOnHover 
              ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
              : 'opacity-100',
            speedClasses[flowSpeed],
            disabled && 'opacity-0'
          )}
          style={{
            background: `linear-gradient(45deg, ${colorStops})`,
            backgroundSize: '300% 100%',
            borderRadius: 'inherit'
          }}
        >
          {/* 内层背景，创建边框效果 */}
          <div className={cn(
            "w-full h-full rounded-md",
            variant === 'default' 
              ? "bg-primary" 
              : variant === 'outline'
              ? "bg-background"
              : "bg-transparent"
          )} />
        </div>
      )}

      {/* 主按钮 */}
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          'relative transition-all duration-300',
          
          // 悬停缩放效果
          'hover:scale-105 active:scale-95',
          
          // 发光效果
          !disabled && shouldShowFlow && glowClasses[glowIntensity],
          
          // 确保文字在最上层
          'z-10',
          
          className
        )}
        disabled={disabled}
        {...props}
      >
        <span className="relative z-20">
          {children}
        </span>
      </Button>
    </div>
  )
})

FlowingBorderButton.displayName = "FlowingBorderButton"

// 预设样式的流光边框按钮
export const PrimaryFlowingButton = forwardRef<HTMLButtonElement, Omit<FlowingBorderButtonProps, 'variant'>>(
  (props, ref) => (
    <FlowingBorderButton
      ref={ref}
      variant="default"
      glowIntensity="medium"
      showFlowOnHover={false}
      {...props}
    />
  )
)

export const OutlineFlowingButton = forwardRef<HTMLButtonElement, Omit<FlowingBorderButtonProps, 'variant'>>(
  (props, ref) => (
    <FlowingBorderButton
      ref={ref}
      variant="outline"
      glowIntensity="subtle"
      showFlowOnHover={true}
      {...props}
    />
  )
)

// 彩虹流光按钮
export const RainbowFlowingButton = forwardRef<HTMLButtonElement, Omit<FlowingBorderButtonProps, 'variant' | 'flowColors'>>(
  (props, ref) => (
    <FlowingBorderButton
      ref={ref}
      variant="default"
      flowColors={[
        '#ff0000', // 红
        '#ff8000', // 橙
        '#ffff00', // 黄
        '#80ff00', // 黄绿
        '#00ff00', // 绿
        '#00ff80', // 绿青
        '#00ffff', // 青
        '#0080ff', // 青蓝
        '#0000ff', // 蓝
        '#8000ff', // 蓝紫
        '#ff00ff', // 紫
        '#ff0080', // 紫红
        '#ff0000'  // 红
      ]}
      flowSpeed="normal"
      glowIntensity="strong"
      {...props}
    />
  )
)

PrimaryFlowingButton.displayName = "PrimaryFlowingButton"
OutlineFlowingButton.displayName = "OutlineFlowingButton"
RainbowFlowingButton.displayName = "RainbowFlowingButton"

export default FlowingBorderButton