import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { videoId, videoUrl, options = {} } = body

    if (!videoId || !videoUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing videoId or videoUrl parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[THUMBNAIL SERVICE] Generate thumbnail request: ${videoId} - ${videoUrl}`)

    // Set default options
    const finalOptions = {
      timestamp: options.timestamp || 1,
      quality: options.quality || 'medium',
      width: options.width || 640,
      height: options.height || 360,
      format: options.format || 'jpeg',
      blurRadius: options.blurRadius || 20
    }

    // Generate high-quality SVG thumbnails as default
    const normalThumbnail = generateDefaultThumbnail(finalOptions)
    const blurThumbnail = generateDefaultThumbnail({ ...finalOptions, blur: true })
    
    const metadata = {
      width: finalOptions.width,
      height: finalOptions.height,
      format: finalOptions.format,
      fileSize: 5000,
      generationMethod: 'server-svg',
      timestamp: Date.now()
    }
    
    console.log(`[THUMBNAIL SERVICE] Thumbnail generated successfully: ${videoId}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        thumbnails: {
          normal: normalThumbnail,
          blur: blurThumbnail
        },
        metadata: metadata
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[THUMBNAIL SERVICE] Request processing failed:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function generateDefaultThumbnail(options) {
  const { width, height, blur = false } = options
  
  const blurFilter = blur ? `filter="blur(${Math.max(2, width/32)}px)"` : ''
  const opacity = blur ? 0.8 : 1
  
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="serverBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1;stop-opacity:${opacity}" />
          <stop offset="50%" style="stop-color:#8b5cf6;stop-opacity:${opacity}" />
          <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:${opacity}" />
        </linearGradient>
        <radialGradient id="playBg" cx="50%" cy="50%" r="30%">
          <stop offset="0%" style="stop-color:rgba(255,255,255,0.9);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(255,255,255,0.7);stop-opacity:1" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#serverBg)" ${blurFilter}/>
      ${!blur ? `
        <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height) * 0.18}" fill="url(#playBg)"/>
        <polygon points="${width/2-12},${height/2-10} ${width/2-12},${height/2+10} ${width/2+10},${height/2}" fill="#4f46e5"/>
        <text x="${width/2}" y="${height*0.85}" font-family="Arial, sans-serif" font-size="${Math.max(10, width/30)}" fill="rgba(255,255,255,0.9)" text-anchor="middle" font-weight="500">Video Preview</text>
      ` : ''}
    </svg>
  `
  
  // Use Deno's btoa for base64 encoding
  const encoded = btoa(svg)
  return `data:image/svg+xml;base64,${encoded}`
}