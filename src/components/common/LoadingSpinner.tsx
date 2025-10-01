/**
 * Loading Spinner Component
 * 用于路由懒加载的统一加载状态组件
 */

import React from 'react'
import { Loader2 } from '@/components/icons'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  fullScreen?: boolean
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function LoadingSpinner({
  fullScreen = false,
  message,
  size = 'md',
  className
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  }

  const spinnerSize = sizeClasses[size]

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className={cn(spinnerSize, 'animate-spin text-primary')} />
          {message && (
            <p className="text-sm text-muted-foreground animate-pulse">
              {message}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className={cn(spinnerSize, 'animate-spin text-primary')} />
        {message && (
          <p className="text-sm text-muted-foreground animate-pulse">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}