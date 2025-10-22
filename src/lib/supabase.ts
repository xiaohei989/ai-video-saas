import { createClient } from '@supabase/supabase-js'
import { createSecureSupabaseClient } from '../services/secureSupabaseClient'
// 🔥 修复循环依赖：改为动态导入 securityMonitor
// import { securityMonitor } from '../services/securityMonitorService'
import { InputValidator } from '../utils/inputValidator'

// Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// 创建安全增强的 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'sb-hvkzwrnvxsleeonqqrzq-auth-token',
    storage: localStorage,
    flowType: 'pkce', // 恢复PKCE流程 - Apple OAuth需要PKCE
  },
  global: {
    headers: {
      'Accept': 'application/json, application/vnd.pgrst.object+json',
      'X-Client-Info': 'ai-video-saas',
      'X-Requested-With': 'XMLHttpRequest'
    },
  },
})

// 创建安全增强版本的客户端（使用现有的supabase实例避免多实例警告）
export const secureSupabase = createSecureSupabaseClient(
  supabase, // 传入现有的客户端实例而不是URL和KEY
  undefined,
  {
    enableCSRF: true,
    enableRateLimit: true,
    enableInputValidation: true,
    enableQueryLogging: true,
    maxQueryComplexity: 10
  }
)

// 数据库类型定义
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          website: string | null
          social_links: Record<string, any>
          language: string
          credits: number
          total_credits_earned: number
          total_credits_spent: number
          referral_code: string | null
          referred_by: string | null
          follower_count: number
          following_count: number
          template_count: number
          is_verified: boolean
          verification_date: string | null
          profile_views: number
          last_active_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          website?: string | null
          social_links?: Record<string, any>
          language?: string
          credits?: number
          referred_by?: string | null
        }
        Update: {
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          website?: string | null
          social_links?: Record<string, any>
          language?: string
        }
      }
      templates: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          thumbnail_url: string | null
          preview_url: string | null
          category: string | null
          author_id: string | null
          is_active: boolean
          is_public: boolean
          is_premium: boolean
          is_featured: boolean
          credit_cost: number
          parameters: Record<string, any>
          prompt_template: string
          veo3_settings: Record<string, any>
          usage_count: number
          like_count: number
          comment_count: number
          share_count: number
          view_count: number
          favorite_count: number
          tags: string[]
          source_template_id: string | null
          version: string
          featured_at: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
      }
      videos: {
        Row: {
          id: string
          user_id: string
          template_id: string | null
          title: string | null
          description: string | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          veo3_job_id: string | null
          video_url: string | null
          thumbnail_url: string | null
          thumbnail_blur_url: string | null
          thumbnail_generated_at: string | null
          thumbnail_metadata: Record<string, any>
          duration: number | null
          resolution: string | null
          file_size: number | null
          parameters: Record<string, any>
          prompt: string | null
          credits_used: number
          error_message: string | null
          is_deleted: boolean
          deleted_at: string | null
          deleted_by: string | null
          is_public: boolean
          share_code: string | null
          view_count: number
          download_count: number
          like_count: number
          comment_count: number
          share_count: number
          last_viewed_at: string | null
          version: number
          parent_video_id: string | null
          tags: string[]
          metadata: Record<string, any>
          processing_started_at: string | null
          processing_completed_at: string | null
          created_at: string
          updated_at: string
        }
      }
    }
  }
}

// Helper functions
export const getPublicUrl = (path: string) => {
  if (!path) return null
  if (path.startsWith('http')) return path
  const { data } = supabase.storage.from('public').getPublicUrl(path)
  return data.publicUrl
}

export const uploadFile = async (
  bucket: string,
  path: string,
  file: File,
  options?: {
    cacheControl?: string
    contentType?: string
    upsert?: boolean
    maxRetries?: number
  }
) => {
  const maxRetries = options?.maxRetries || 3
  let lastError: any = null
  
  // 文件安全验证
  const fileValidation = await InputValidator.validateFile(file)
  if (!fileValidation.isValid) {
    // 记录恶意文件上传尝试（动态导入避免循环依赖）
    const { securityMonitor } = await import('../services/securityMonitorService')
    await securityMonitor.logFileUpload(
      '', // 将在session检查后获取用户ID
      file.name,
      file.size,
      file.type,
      false,
      true
    )
    throw new Error(`文件验证失败: ${fileValidation.errors.join(', ')}`)
  }
  
  // 验证用户认证状态
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) {
    console.error('[Storage] 用户未认证:', sessionError)
    throw new Error('用户未登录或session已过期，请重新登录')
  }
  
  const userId = session.user?.id || ''
  
  // 重试逻辑
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 构建上传选项，让浏览器自动设置正确的Content-Type
      const uploadOptions: any = {
        cacheControl: options?.cacheControl || '3600',
        upsert: options?.upsert || false,
      }
      
      // 只有在明确指定时才设置contentType，否则让浏览器自动处理
      if (options?.contentType) {
        uploadOptions.contentType = options.contentType
      }
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, uploadOptions)

      if (error) {
        console.error(`[Storage] 上传失败 (第${attempt}次):`, {
          error: error.message,
          statusCode: (error as any).statusCode,
          details: error
        })
        
        // 如果是权限错误，不重试
        if (error.message?.includes('policy') || error.message?.includes('unauthorized') || error.message?.includes('Unauthorized')) {
          throw new Error('没有权限上传文件，请检查Storage权限配置')
        }
        
        // 如果是MIME类型错误，不重试
        if (error.message?.includes('mime type') || error.message?.includes('not supported')) {
          throw new Error(`不支持的文件类型: ${file.type}。请使用JPG、PNG、GIF或WebP格式的图片`)
        }
        
        lastError = error
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
          continue
        }
      } else {
        // 记录成功的文件上传（动态导入避免循环依赖）
        const { securityMonitor } = await import('../services/securityMonitorService')
        await securityMonitor.logFileUpload(
          userId,
          file.name,
          file.size,
          file.type,
          true,
          false
        )

        // 成功上传
        return data
      }
    } catch (err: any) {
      console.error(`[Storage] 上传异常 (第${attempt}次):`, err)
      lastError = err
      
      // 网络错误，可能需要重试
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
          continue
        }
      } else {
        // 其他错误直接抛出
        throw err
      }
    }
  }
  
  // 所有重试都失败了
  throw lastError || new Error('Upload failed after multiple attempts')
}

export const deleteFile = async (bucket: string, paths: string[]) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .remove(paths)

  if (error) throw error
  return data
}

// Token 管理工具函数
export const ensureValidSession = async (maxRetries = 3): Promise<any> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 获取当前session
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error(`Session check attempt ${attempt} failed:`, error)
        if (attempt === maxRetries) throw error
        continue
      }

      if (!session) {
        throw new Error('No active session')
      }

      // 检查session是否快过期（5分钟内过期）
      const expiresAt = new Date(session.expires_at! * 1000)
      const now = new Date()
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()
      
      if (timeUntilExpiry < 5 * 60 * 1000) { // 5分钟 = 5 * 60 * 1000ms
        console.log('Token expires soon, refreshing...')
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError) {
          console.error(`Token refresh attempt ${attempt} failed:`, refreshError)
          if (attempt === maxRetries) throw refreshError
          
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
          continue
        }
        
        if (refreshData.session) {
          console.log('Token refreshed successfully')
          return refreshData.session
        }
      }

      return session
    } catch (error) {
      console.error(`Session validation attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, attempt * 1000))
    }
  }
  
  throw new Error('Failed to ensure valid session after multiple attempts')
}

// 手动刷新session
export const refreshSession = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) throw error
    return data.session
  } catch (error) {
    console.error('Manual session refresh failed:', error)
    throw error
  }
}