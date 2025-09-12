// supabase/functions/update-video-status/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

interface VideoUpdateRequest {
  videoId: string
  updates: {
    status?: 'pending' | 'processing' | 'completed' | 'failed'
    video_url?: string
    thumbnail_url?: string
    duration?: number
    resolution?: string
    file_size?: number
    error_message?: string
    metadata?: Record<string, any>
    processing_started_at?: string
    processing_completed_at?: string
  }
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 创建具有 Service Role 权限的 Supabase 客户端
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const body: VideoUpdateRequest = await req.json()
    const { videoId, updates } = body

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Video ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('[EDGE FUNCTION] Updating video:', { videoId, updates })

    // 准备更新数据
    const updateData: any = { ...updates }
    
    // 自动设置时间戳
    if (updates.status === 'completed') {
      updateData.processing_completed_at = new Date().toISOString()
    } else if (updates.status === 'processing' && !updateData.processing_started_at) {
      updateData.processing_started_at = new Date().toISOString()
    }

    // 使用 Service Role 权限更新视频记录（绕过 RLS）
    const { data: video, error } = await supabaseAdmin
      .from('videos')
      .update(updateData)
      .eq('id', videoId)
      .select()
      .single()

    if (error) {
      console.error('[EDGE FUNCTION] Error updating video:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          details: error
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('[EDGE FUNCTION] Video updated successfully:', {
      videoId,
      status: video.status,
      hasVideoUrl: !!video.video_url
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: video,
        message: 'Video updated successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[EDGE FUNCTION] Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})