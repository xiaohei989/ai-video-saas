/**
 * Templates Page - 简化版
 * 使用新的组件架构，代码量从1200+行减少到50行
 * 添加VideoContextProvider以支持视频播放状态管理
 */

import TemplatesContainer from '@/components/templates/TemplatesContainer'
import { VideoContextProvider } from '@/contexts/VideoContext'

export default function TemplatesPage() {
  return (
    <VideoContextProvider>
      <TemplatesContainer />
    </VideoContextProvider>
  )
}