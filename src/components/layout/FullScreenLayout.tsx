/**
 * 全屏布局组件
 * 
 * 专为需要全屏背景（如视频背景）的页面设计
 * 提供基础的头部导航，但允许内容占据全屏空间
 */

import React from 'react'
import { Header } from './Header'

interface FullScreenLayoutProps {
  children: React.ReactNode
  showHeader?: boolean
  headerClassName?: string
}

export function FullScreenLayout({ 
  children, 
  showHeader = true,
  headerClassName = ""
}: FullScreenLayoutProps) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {/* Header - 确保在移动端保持固定 */}
      {showHeader && (
        <Header className={`mobile-fixed-header z-50 bg-transparent backdrop-blur-sm border-b border-white/10 ${headerClassName}`} />
      )}
      
      {/* Full Screen Content - 添加顶部间距避免被导航条遮挡 */}
      <div className="relative w-full pt-16 md:pt-0">
        {children}
      </div>
    </div>
  )
}

export default FullScreenLayout