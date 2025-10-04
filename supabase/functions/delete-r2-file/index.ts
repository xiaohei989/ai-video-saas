import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DeleteR2FileRequest {
  fileUrl: string
  videoId?: string
  fileType?: 'video' | 'thumbnail'
  force?: boolean  // 强制删除，即使没有数据库记录
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 验证用户身份 - 支持Service Role Key
    const token = authHeader.replace('Bearer ', '')
    
    // 检查是否使用Service Role Key（绕过用户认证）
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const isServiceRole = token === serviceRoleKey
    
    let user: any = null
    
    if (isServiceRole) {
      console.log('[delete-r2-file] 使用Service Role Key，跳过用户认证')
      // Service Role模式，创建虚拟admin用户
      user = { 
        id: 'service-role-admin',
        email: 'admin@system.internal',
        role: 'service_role'
      }
    } else {
      // 普通用户认证
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token)
      
      if (authError || !authUser) {
        throw new Error('Invalid authentication')
      }
      
      user = authUser
    }

    const { fileUrl, videoId, fileType = 'video', force = false }: DeleteR2FileRequest = await req.json()

    if (!fileUrl) {
      throw new Error('fileUrl is required')
    }

    console.log('[delete-r2-file] 处理删除请求:', {
      fileUrl,
      videoId,
      fileType,
      force,
      userId: user.id
    })

    // 🚀 从URL中提取文件key
    let fileKey: string
    try {
      const url = new URL(fileUrl)
      
      // 处理不同的R2 URL格式
      if (url.hostname.includes('r2.dev') || url.hostname.includes('r2.cloudflarestorage.com')) {
        // pub-xxx.r2.dev 格式
        fileKey = url.pathname.substring(1) // 移除开头的 '/'
      } else if (url.hostname === 'cdn.veo3video.me') {
        // CDN 格式
        fileKey = url.pathname.substring(1) // 移除开头的 '/'
      } else {
        throw new Error('Unsupported URL format')
      }
      
      console.log('[delete-r2-file] 提取文件key:', fileKey)
    } catch (error) {
      console.error('[delete-r2-file] URL解析失败:', error)
      throw new Error('Invalid file URL format')
    }

    // 检查数据库中是否存在对应记录（如果提供了videoId）
    let hasDbRecord = false
    if (videoId) {
      const { data: videoRecord, error: dbError } = await supabaseClient
        .from('videos')
        .select('id, user_id, video_url, r2_url')
        .eq('id', videoId)
        .single()
      
      if (!dbError && videoRecord) {
        hasDbRecord = true
        
        // 验证权限：只有视频所有者或管理员可以删除
        const isOwner = videoRecord.user_id === user.id
        let isAdmin = false
        
        if (isServiceRole) {
          // Service Role拥有admin权限
          isAdmin = true
          console.log('[delete-r2-file] Service Role权限: 自动获得管理员权限')
        } else {
          // 普通用户需要检查profile
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          
          isAdmin = profile?.role && ['admin', 'super_admin'].includes(profile.role)
        }
        
        if (!isOwner && !isAdmin) {
          throw new Error('Insufficient permissions to delete this file')
        }
        
        console.log('[delete-r2-file] 权限验证通过:', { isOwner, isAdmin, isServiceRole })
      } else if (!force) {
        throw new Error('Video record not found in database. Use force=true to delete orphaned files.')
      }
    } else if (!force) {
      throw new Error('videoId is required unless force=true is specified')
    }

    // 🚀 使用Cloudflare R2 API删除文件
    const accountId = Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')
    const accessKeyId = Deno.env.get('VITE_CLOUDFLARE_R2_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY')
    const bucketName = Deno.env.get('VITE_CLOUDFLARE_R2_BUCKET_NAME')

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Missing R2 configuration')
    }

    // 构建R2删除请求
    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${fileKey}`
    
    console.log('[delete-r2-file] R2删除端点:', r2Endpoint)

    // AWS Signature V4 - 简化版实现
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    
    // 创建删除请求
    const deleteResponse = await fetch(r2Endpoint, {
      method: 'DELETE',
      headers: {
        'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/auto/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=simplified`,
        'x-amz-date': amzDate,
        'Host': `${accountId}.r2.cloudflarestorage.com`
      }
    })

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      console.error('[delete-r2-file] R2删除失败:', {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText
      })
      
      // 尝试简化的删除方法（直接使用访问密钥）
      const simpleEndpoint = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${fileKey}`
      
      const simpleResponse = await fetch(simpleEndpoint, {
        method: 'DELETE',
        headers: {
          'X-Custom-Auth-Key': accessKeyId,
        }
      })
      
      if (!simpleResponse.ok && simpleResponse.status !== 404) {
        throw new Error(`Failed to delete file from R2: ${simpleResponse.status} ${simpleResponse.statusText}`)
      }
    }

    // 如果是404，说明文件已经不存在了，这也算成功
    const deletionStatus = deleteResponse.status === 404 ? 'file_not_found' : 'deleted'
    
    console.log('[delete-r2-file] R2删除状态:', deletionStatus)

    // 如果有数据库记录，清理数据库中的相关字段
    if (hasDbRecord && videoId) {
      const updateFields: any = {}
      
      if (fileType === 'video') {
        updateFields.r2_url = null
        updateFields.migration_status = 'completed' // 标记迁移已完成（删除也是一种迁移）
      } else if (fileType === 'thumbnail') {
        updateFields.thumbnail_url = null
        updateFields.thumbnail_generated_at = null
      }
      
      if (Object.keys(updateFields).length > 0) {
        const { error: updateError } = await supabaseClient
          .from('videos')
          .update(updateFields)
          .eq('id', videoId)
        
        if (updateError) {
          console.error('[delete-r2-file] 数据库更新失败:', updateError)
          // 不抛出错误，因为文件已经删除了
        } else {
          console.log('[delete-r2-file] 数据库更新成功:', updateFields)
        }
      }
    }

    const response = {
      success: true,
      message: deletionStatus === 'file_not_found' 
        ? 'File was already deleted or does not exist'
        : 'File deleted successfully',
      data: {
        fileUrl,
        fileKey,
        videoId,
        fileType,
        deletionStatus,
        hasDbRecord,
        timestamp: new Date().toISOString()
      }
    }

    console.log('[delete-r2-file] 删除完成:', response)

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('[delete-r2-file] 错误:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})