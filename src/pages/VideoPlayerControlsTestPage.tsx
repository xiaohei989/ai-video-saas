/**
 * 视频播放器控制组件测试页面
 * 用于测试环境变量 VITE_VIDEO_PLAYER_NATIVE_CONTROLS 的开关功能
 */

import React from 'react'
import { ReactVideoPlayer } from '@/components/video/ReactVideoPlayer'

const VideoPlayerControlsTestPage: React.FC = () => {
  // 获取环境变量配置
  const nativeControlsEnabled = import.meta.env.VITE_VIDEO_PLAYER_NATIVE_CONTROLS === 'true'
  
  // 测试视频URL (使用公共的测试视频)
  const testVideoUrl = "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"
  const testThumbnailUrl = "https://sample-videos.com/zip/10/jpg/SampleJPGImage_1280x720_1MB.jpg"

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          视频播放器控制组件测试
        </h1>
        
        {/* 环境变量状态显示 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">环境配置状态</h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">VITE_VIDEO_PLAYER_NATIVE_CONTROLS:</span>
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                nativeControlsEnabled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {import.meta.env.VITE_VIDEO_PLAYER_NATIVE_CONTROLS || 'undefined'}
              </span>
            </p>
            <p>
              <span className="font-medium">原生控制组件:</span>
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                nativeControlsEnabled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {nativeControlsEnabled ? '启用' : '禁用'}
              </span>
            </p>
          </div>
        </div>

        {/* ReactVideoPlayer 测试 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">ReactVideoPlayer 测试</h2>
          <p className="text-gray-600 mb-4">
            {nativeControlsEnabled 
              ? '应该显示原生HTML5视频控制条（播放、暂停、进度条等）' 
              : '应该只显示自定义的播放按钮，不显示原生控制条'
            }
          </p>
          <div className="aspect-video max-w-2xl mx-auto">
            <ReactVideoPlayer
              videoUrl={testVideoUrl}
              thumbnailUrl={testThumbnailUrl}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* SimpleVideoPlayer 测试（现在使用ReactVideoPlayer） */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">SimpleVideoPlayer 测试（合并后）</h2>
          <p className="text-gray-600 mb-4">
            {nativeControlsEnabled 
              ? '应该显示原生HTML5视频控制条' 
              : '应该只显示自定义的播放按钮'
            }
          </p>
          <p className="text-sm text-blue-600 mb-4">
            现在使用SimpleVideoPlayer的src/poster属性别名，内部由ReactVideoPlayer处理
          </p>
          <div className="aspect-video max-w-2xl mx-auto">
            <ReactVideoPlayer
              src={testVideoUrl}
              poster={testThumbnailUrl}
              className="w-full h-full"
              onCanPlay={() => console.log('SimpleVideoPlayer onCanPlay callback')}
              onLoadStart={() => console.log('SimpleVideoPlayer onLoadStart callback')}
            />
          </div>
        </div>

        {/* 对比测试：相同功能不同API */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">API对比测试</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">ReactVideoPlayer原生API</h3>
              <div className="aspect-video">
                <ReactVideoPlayer
                  videoUrl={testVideoUrl}
                  thumbnailUrl={testThumbnailUrl}
                  className="w-full h-full"
                  onReady={() => console.log('ReactVideoPlayer onReady callback')}
                />
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">SimpleVideoPlayer兼容API</h3>
              <div className="aspect-video">
                <ReactVideoPlayer
                  src={testVideoUrl}
                  poster={testThumbnailUrl}
                  className="w-full h-full"
                  onCanPlay={() => console.log('ReactVideoPlayer with alias onCanPlay callback')}
                />
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            两个播放器应该表现完全一致，说明API兼容成功
          </p>
        </div>

        {/* 使用说明 */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">使用说明</h2>
          <div className="space-y-3 text-blue-700">
            <p>
              <strong>启用原生控制组件:</strong> 在 .env 文件中设置 
              <code className="bg-blue-200 px-2 py-1 rounded mx-1">VITE_VIDEO_PLAYER_NATIVE_CONTROLS=true</code>
            </p>
            <p>
              <strong>禁用原生控制组件:</strong> 在 .env 文件中设置 
              <code className="bg-blue-200 px-2 py-1 rounded mx-1">VITE_VIDEO_PLAYER_NATIVE_CONTROLS=false</code>
            </p>
            <p>
              <strong>注意:</strong> 修改 .env 文件后需要重启开发服务器才能生效。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayerControlsTestPage