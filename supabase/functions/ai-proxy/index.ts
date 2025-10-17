import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Parse request body
    const { prompt, model } = await req.json()

    console.log('[AI Proxy] 收到请求:', { model, promptLength: prompt?.length })

    // Validate required fields
    if (!prompt || !model) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少必要参数: prompt 和 model' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get APICore credentials from environment
    const apiKey = Deno.env.get('APICORE_API_KEY')
    const apiEndpoint = Deno.env.get('APICORE_ENDPOINT') || 'https://api.apicore.ai'

    if (!apiKey) {
      console.error('[AI Proxy] APICore API密钥未配置')
      return new Response(
        JSON.stringify({ success: false, error: 'APICore API密钥未配置' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Determine model name
    const modelName = model === 'claude'
      ? 'claude-opus-4-1-20250805'
      : 'chatgpt-4o-latest'

    console.log('[AI Proxy] 调用APICore:', { modelName })

    // Call APICore API
    const response = await fetch(`${apiEndpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[AI Proxy] APICore调用失败:', errorText)
      return new Response(
        JSON.stringify({
          success: false,
          error: `APICore调用失败: ${response.status} ${errorText}`
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    console.log('[AI Proxy] APICore调用成功, 内容长度:', content?.length)

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        content: content
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[AI Proxy] 函数错误:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '服务器内部错误'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
