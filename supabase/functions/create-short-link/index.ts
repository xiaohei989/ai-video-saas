import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface CreateShortLinkRequest {
  videoId: string
  platform?: string
  targetUrl?: string
  metadata?: Record<string, unknown>
}

const SUPPORTED_PLATFORMS = new Set([
  'twitter',
  'facebook',
  'linkedin',
  'whatsapp',
  'telegram',
  'copy',
  'email',
  'embed'
])

// 生成短码工具，避免容易混淆的字符
const SHORT_CODE_SOURCE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz'
const SHORT_CODE_LENGTH = 8

function generateShortCode() {
  let code = ''
  const sourceLength = SHORT_CODE_SOURCE.length
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    const index = Math.floor(Math.random() * sourceLength)
    code += SHORT_CODE_SOURCE[index]
  }
  return code
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('[CREATE SHORT LINK] Supabase 环境变量缺失')
      return new Response(JSON.stringify({ error: 'Supabase configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const authHeader = req.headers.get('Authorization') || ''
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const isServiceRequest = bearerToken === serviceRoleKey

    const requestBody: CreateShortLinkRequest = await req.json()
    const { videoId, platform, targetUrl, metadata } = requestBody

    if (!videoId) {
      return new Response(JSON.stringify({ error: '缺少 videoId 参数' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (platform && !SUPPORTED_PLATFORMS.has(platform)) {
      return new Response(JSON.stringify({ error: `不支持的平台: ${platform}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 使用用户身份校验视频归属
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    })

    const {
      data: { user },
      error: userError
    } = isServiceRequest
      ? { data: { user: null }, error: null }
      : await supabaseClient.auth.getUser()

    if (!isServiceRequest && (userError || !user)) {
      console.error('[CREATE SHORT LINK] 用户认证失败', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 使用 service role 执行实际数据库操作
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 验证视频归属关系
    const { data: videoRecord, error: videoError } = await serviceClient
      .from('videos')
      .select('id, user_id, share_count, is_public')
      .eq('id', videoId)
      .maybeSingle()

    if (videoError) {
      console.error('[CREATE SHORT LINK] 查询视频信息失败', videoError)
      return new Response(JSON.stringify({ error: '查询视频失败' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!videoRecord) {
      return new Response(JSON.stringify({ error: '视频不存在' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const requestUserId = user?.id ?? videoRecord.user_id

    if (!isServiceRequest && videoRecord.user_id !== requestUserId) {
      return new Response(JSON.stringify({ error: '无权为该视频创建短链接' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 计算目标地址，默认指向公共分享页
    const appUrl = Deno.env.get('APP_URL') ?? Deno.env.get('VITE_APP_URL') ?? ''
    if (!appUrl && !targetUrl) {
      return new Response(JSON.stringify({ error: '缺少分享目标地址配置' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const resolvedTargetUrl = targetUrl || `${appUrl.replace(/\/$/, '')}/video/${videoId}`

    // 如果已有有效的短链接，直接复用
    let query = serviceClient
      .from('video_share_links')
      .select('*')
      .eq('video_id', videoId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (platform) {
      query = query.eq('platform', platform)
    } else {
      query = query.is('platform', null)
    }

    const { data: existingLink, error: existingError } = await query.maybeSingle()

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('[CREATE SHORT LINK] 查询短链接失败', existingError)
      return new Response(JSON.stringify({ error: '查询短链接失败' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const now = Date.now()
    if (existingLink) {
      const isExpired = existingLink.expires_at ? (new Date(existingLink.expires_at).getTime() < now) : false
      if (!isExpired && existingLink.target_url === resolvedTargetUrl) {
        const shortDomain = Deno.env.get('VIDEO_SHARE_BASE_URL') ?? appUrl
        const shortUrl = `${shortDomain.replace(/\/$/, '')}/${existingLink.short_code}`
        return new Response(JSON.stringify({
          success: true,
          shortCode: existingLink.short_code,
          shortUrl,
          targetUrl: existingLink.target_url,
          reused: true
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 已过期或者目标地址发生变化，则标记失效后继续生成新短码
      await serviceClient
        .from('video_share_links')
        .update({ is_active: false })
        .eq('id', existingLink.id)
    }

    // 生成唯一短码
    let shortCode = generateShortCode()
    const MAX_ATTEMPTS = 5
    let attempts = 0
    while (attempts < MAX_ATTEMPTS) {
      const { data: codeExists } = await serviceClient
        .from('video_share_links')
        .select('id')
        .eq('short_code', shortCode)
        .maybeSingle()

      if (!codeExists) {
        break
      }

      shortCode = generateShortCode()
      attempts += 1
    }

    if (attempts >= MAX_ATTEMPTS) {
      return new Response(JSON.stringify({ error: '短链接生成失败，请稍后重试' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const shareDomain = Deno.env.get('VIDEO_SHARE_BASE_URL') ?? appUrl
    const shortUrl = `${shareDomain.replace(/\/$/, '')}/${shortCode}`

    const insertPayload = {
      video_id: videoId,
      short_code: shortCode,
      target_url: resolvedTargetUrl,
      platform: platform ?? null,
      created_by: requestUserId,
      metadata: metadata ?? {},
      is_active: true
    }

    const { data: newLink, error: insertError } = await serviceClient
      .from('video_share_links')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError) {
      console.error('[CREATE SHORT LINK] 写入短链接失败', insertError)
      return new Response(JSON.stringify({ error: '写入短链接失败' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      shortCode,
      shortUrl,
      targetUrl: newLink.target_url,
      reused: false
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[CREATE SHORT LINK] 服务器错误', error)
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
