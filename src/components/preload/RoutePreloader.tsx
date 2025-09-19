/**
 * 路由预加载组件 - 智能监听路由变化并预加载数据
 * 提升移动端用户体验，实现近零延迟页面加载
 */

import { useEffect, useContext } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import { videoPreloadService } from '@/services/videoPreloadService'

export default function RoutePreloader() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const authContext = useContext(AuthContext)
  const user = authContext?.user

  // 🚀 监听路由变化，智能预加载
  useEffect(() => {
    if (!user) return

    const currentPath = location.pathname
    console.log(`[RoutePreloader] 📍 路由变化: ${currentPath} (${navigationType})`)

    // 基于当前路径预测用户下一步行为
    predictAndPreload(currentPath, user.id)

    // 基于导航类型优化预加载策略
    if (navigationType === 'PUSH') {
      // 用户主动导航，预加载优先级更高
      handleActiveNavigation(currentPath, user.id)
    } else if (navigationType === 'POP') {
      // 用户后退，预加载历史常访问页面
      handleBackNavigation(user.id)
    }

  }, [location, navigationType, user])

  // 🔮 用户登录后的初始化预加载
  useEffect(() => {
    if (user) {
      console.log('[RoutePreloader] 👤 用户已登录，启动初始化预加载')
      
      // 延迟启动，避免影响登录后的首次加载
      setTimeout(() => {
        // 空闲时预加载视频数据
        videoPreloadService.preloadOnIdle(user.id, 'medium')
        
        // 基于用户行为模式预测性预加载
        const userBehavior = getUserBehaviorFromStorage(user.id)
        videoPreloadService.predictivePreload(user.id, userBehavior)
        
      }, 2000)
    } else {
      // 用户登出时清理预加载缓存
      console.log('[RoutePreloader] 👋 用户已登出，清理预加载缓存')
      videoPreloadService.clearPreloadCache()
    }
  }, [user])

  /**
   * 🎯 基于当前路径预测并预加载
   */
  const predictAndPreload = (currentPath: string, userId: string) => {
    // 在首页时，预测用户可能访问模板或创建页面
    if (currentPath === '/') {
      console.log('[RoutePreloader] 🏠 首页 -> 预加载模板数据')
      videoPreloadService.preloadOnIdle(userId, 'low')
    }
    
    // 在模板页面时，用户很可能去创建视频，然后查看"我的视频"
    else if (currentPath === '/templates') {
      console.log('[RoutePreloader] 📋 模板页面 -> 预加载视频列表')
      videoPreloadService.preloadOnIdle(userId, 'medium')
    }
    
    // 在创建页面时，用户完成后通常会查看"我的视频"
    else if (currentPath === '/create') {
      console.log('[RoutePreloader] ✨ 创建页面 -> 高优先级预加载视频列表')
      videoPreloadService.preloadUserVideos(userId, { priority: 'high' })
      
      // 记录用户行为模式
      recordUserBehavior(userId, 'create_page_visit')
    }
    
    // 在定价页面时，用户可能订阅后查看"我的视频"
    else if (currentPath === '/pricing') {
      console.log('[RoutePreloader] 💰 定价页面 -> 预加载视频列表')
      videoPreloadService.preloadOnIdle(userId, 'medium')
    }
    
    // 在个人资料页面时，用户可能查看"我的视频"
    else if (currentPath.startsWith('/profile')) {
      console.log('[RoutePreloader] 👤 个人资料 -> 预加载视频列表')
      videoPreloadService.preloadOnIdle(userId, 'medium')
    }
  }

  /**
   * 🎯 处理主动导航
   */
  const handleActiveNavigation = (currentPath: string, userId: string) => {
    // 用户主动导航到"我的视频"页面
    if (currentPath === '/videos') {
      console.log('[RoutePreloader] 🎬 主动访问视频页面')
      recordUserBehavior(userId, 'videos_page_visit')
    }
  }

  /**
   * ⬅️ 处理后退导航
   */
  const handleBackNavigation = (userId: string) => {
    console.log('[RoutePreloader] ⬅️ 用户后退，预加载常访问页面')
    
    // 后退时通常会重新访问之前的页面，预加载视频数据
    videoPreloadService.preloadOnIdle(userId, 'low')
  }

  /**
   * 📊 从本地存储获取用户行为模式
   */
  const getUserBehaviorFromStorage = (userId: string) => {
    try {
      const storageKey = `user_behavior_${userId}`
      const stored = localStorage.getItem(storageKey)
      
      if (stored) {
        const behavior = JSON.parse(stored)
        return {
          lastVideoPageVisit: behavior.lastVideoPageVisit || 0,
          createToVideoPageRatio: behavior.createToVideoPageRatio || 0,
          avgTimeOnVideoPage: behavior.avgTimeOnVideoPage || 0
        }
      }
    } catch (error) {
      console.warn('[RoutePreloader] 读取用户行为失败:', error)
    }
    
    return {}
  }

  /**
   * 📝 记录用户行为模式
   */
  const recordUserBehavior = (userId: string, action: string) => {
    try {
      const storageKey = `user_behavior_${userId}`
      const stored = localStorage.getItem(storageKey)
      let behavior = stored ? JSON.parse(stored) : {}
      
      const now = Date.now()
      
      switch (action) {
        case 'videos_page_visit':
          behavior.lastVideoPageVisit = now
          behavior.videoPageVisits = (behavior.videoPageVisits || 0) + 1
          break
          
        case 'create_page_visit':
          behavior.createPageVisits = (behavior.createPageVisits || 0) + 1
          break
      }
      
      // 计算创建到查看视频的转换率
      if (behavior.createPageVisits && behavior.videoPageVisits) {
        behavior.createToVideoPageRatio = behavior.videoPageVisits / behavior.createPageVisits
      }
      
      localStorage.setItem(storageKey, JSON.stringify(behavior))
      
    } catch (error) {
      console.warn('[RoutePreloader] 记录用户行为失败:', error)
    }
  }

  // 这个组件不渲染任何UI
  return null
}