import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_IP_HEADERS = ['x-forwarded-for', 'cf-connecting-ip']

function getClientIp(request: Request): string | null {
  for (const header of ALLOWED_IP_HEADERS) {
    const value = request.headers.get(header)
    if (value) {
      const first = value.split(',')[0].trim()
      if (first) return first
    }
  }
  return null
}

serve(async (req) => {
  const url = new URL(req.url)
  const shortCode = url.searchParams.get('code') || url.pathname.split('/').pop()

  if (!shortCode) {
    return new Response('Missing short code', { status: 400 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Supabase configuration missing', { status: 500 })
  }

  const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: link, error } = await supabaseClient
    .from('video_share_links')
    .select('id, video_id, target_url, click_count, metadata')
    .eq('short_code', shortCode)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('[GET SHORT LINK] 查询短链接失败', error)
    return new Response('Internal error', { status: 500 })
  }

  if (!link) {
    return new Response('Link not found', { status: 404 })
  }

  try {
    // 记录点击事件
    const metadata: Record<string, unknown> = link.metadata || {}
    const platform = typeof metadata.platform === 'string' ? metadata.platform : null

    const ipAddress = getClientIp(req)
    const userAgent = req.headers.get('user-agent') ?? undefined

    await supabaseClient.rpc('increment_share_click', {
      p_link_id: link.id,
    })

    await supabaseClient
      .from('video_share_events')
      .insert({
        video_id: link.video_id,
        action: 'click',
        short_code: shortCode,
        platform,
        metadata,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
  } catch (writeError) {
    console.error('[GET SHORT LINK] 记录点击数据失败', writeError)
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: link.target_url,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
})
