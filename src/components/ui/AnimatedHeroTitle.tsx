/**
 * 动画Hero标题组件
 * 
 * 实现多种炫酷的文字特效：
 * 1. 流光渐变动画
 * 2. 文字发光效果
 * 3. 呼吸缩放动画
 * 4. 悬停交互效果
 */

import React, { useState, useEffect } from 'react'
import { cn } from '@/utils/cn'

export interface AnimatedHeroTitleProps {
  text: string
  className?: string
  effectType?: 'flowing' | 'rainbow' | 'neon' | 'pulse' | 'glitch'
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  enableHover?: boolean
  enableBreathing?: boolean
  animationSpeed?: 'slow' | 'normal' | 'fast'
  glowIntensity?: 'subtle' | 'medium' | 'strong'
}

export default function AnimatedHeroTitle({
  text,
  className = '',
  effectType = 'flowing',
  size = 'xl',
  enableHover = true,
  enableBreathing = true,
  animationSpeed = 'normal',
  glowIntensity = 'medium'
}: AnimatedHeroTitleProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  // 检测用户是否偏好减少动画
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // 尺寸映射
  const sizeClasses = {
    sm: 'text-3xl md:text-4xl',
    md: 'text-4xl md:text-5xl',
    lg: 'text-5xl md:text-6xl',
    xl: 'text-5xl md:text-6xl lg:text-7xl',
    '2xl': 'text-6xl md:text-7xl lg:text-8xl'
  }

  // 动画速度映射
  const speedClasses = {
    slow: 'animate-flowing-slow',
    normal: 'animate-flowing',
    fast: 'animate-flowing-fast'
  }

  // 发光强度映射
  const glowClasses = {
    subtle: 'text-glow-subtle',
    medium: 'text-glow-medium',
    strong: 'text-glow-strong'
  }

  // 特效类名映射
  const effectClasses = {
    flowing: `hero-title-flowing ${speedClasses[animationSpeed]}`,
    rainbow: `hero-title-rainbow ${speedClasses[animationSpeed]}`,
    neon: `hero-title-neon ${glowClasses[glowIntensity]}`,
    pulse: 'hero-title-pulse',
    glitch: 'hero-title-glitch'
  }

  // 如果用户偏好减少动画，使用静态样式
  if (reducedMotion) {
    return (
      <h1 className={cn(
        sizeClasses[size],
        'font-bold tracking-tight text-white drop-shadow-lg',
        'bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent',
        className
      )}>
        {text}
      </h1>
    )
  }

  return (
    <div className="relative inline-block">
      <h1 
        className={cn(
          // 基础样式
          sizeClasses[size],
          'font-bold tracking-tight cursor-default select-none',
          'transition-transform duration-300 ease-out',
          
          // 特效样式
          effectClasses[effectType],
          
          // 呼吸效果
          enableBreathing && !isHovered && 'animate-breathing',
          
          // 悬停缩放
          enableHover && 'hover:scale-105',
          
          // 悬停时增强效果
          isHovered && effectType === 'flowing' && 'hero-title-flowing-hover',
          
          className
        )}
        onMouseEnter={() => enableHover && setIsHovered(true)}
        onMouseLeave={() => enableHover && setIsHovered(false)}
        style={{
          // 确保GPU加速
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
      >
        {text}
        
        {/* 额外的发光层 - 仅在特定效果下显示 */}
        {(effectType === 'neon' || effectType === 'flowing') && (
          <span 
            className={cn(
              'absolute inset-0 opacity-50 blur-sm pointer-events-none',
              effectClasses[effectType]
            )}
            aria-hidden="true"
          >
            {text}
          </span>
        )}
      </h1>
      
      {/* Glitch效果的额外层 */}
      {effectType === 'glitch' && (
        <>
          <h1 
            className={cn(
              sizeClasses[size],
              'font-bold tracking-tight absolute inset-0 hero-title-glitch-layer-1'
            )}
            aria-hidden="true"
          >
            {text}
          </h1>
          <h1 
            className={cn(
              sizeClasses[size],
              'font-bold tracking-tight absolute inset-0 hero-title-glitch-layer-2'
            )}
            aria-hidden="true"
          >
            {text}
          </h1>
        </>
      )}
    </div>
  )
}

// 预设组合组件
export const FlowingHeroTitle: React.FC<{
  text: string
  className?: string
  size?: AnimatedHeroTitleProps['size']
}> = ({ text, className, size = 'xl' }) => (
  <AnimatedHeroTitle
    text={text}
    effectType="flowing"
    size={size}
    className={className}
    enableHover={true}
    enableBreathing={true}
    animationSpeed="normal"
    glowIntensity="medium"
  />
)

export const RainbowHeroTitle: React.FC<{
  text: string
  className?: string
  size?: AnimatedHeroTitleProps['size']
}> = ({ text, className, size = 'xl' }) => (
  <AnimatedHeroTitle
    text={text}
    effectType="rainbow"
    size={size}
    className={className}
    enableHover={true}
    enableBreathing={false}
    animationSpeed="slow"
  />
)

export const NeonHeroTitle: React.FC<{
  text: string
  className?: string
  size?: AnimatedHeroTitleProps['size']
}> = ({ text, className, size = 'xl' }) => (
  <AnimatedHeroTitle
    text={text}
    effectType="neon"
    size={size}
    className={className}
    enableHover={true}
    enableBreathing={true}
    glowIntensity="strong"
  />
)