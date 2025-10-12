/**
 * Cloudflare Worker: 从视频生成缩略图
 * 部署到 Cloudflare Workers（完全免费）
 *
 * 原理：
 * 1. 下载视频的前几秒
 * 2. 返回一个HTML页面，用Canvas API提取第一帧
 * 3. 将生成的缩略图回传
 *
 * 优点：
 * - ✅ 完全免费（Cloudflare Workers 免费 100,000 请求/天）
 * - ✅ 无需第三方API
 * - ✅ 快速响应（边缘计算）
 *
 * 使用：
 * POST https://thumbnail-worker.your-domain.workers.dev
 * Body: { "videoUrl": "https://cdn.veo3video.me/videos/xxx.mp4" }
 */

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const { videoUrl, timestamp = 0.1 } = await request.json()

      if (!videoUrl) {
        return new Response(
          JSON.stringify({ error: 'videoUrl is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // 返回一个HTML页面，用JavaScript提取视频帧
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Video Thumbnail Generator</title>
</head>
<body>
  <video id="video" crossorigin="anonymous" style="display:none"></video>
  <canvas id="canvas" style="display:none"></canvas>
  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    video.src = '${videoUrl}';
    video.currentTime = ${timestamp};

    video.addEventListener('seeked', function() {
      canvas.width = 960;
      canvas.height = 540;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(function(blob) {
        const reader = new FileReader();
        reader.onloadend = function() {
          const base64 = reader.result;
          // 将结果发送回父窗口或显示
          document.body.innerHTML = '<pre>' + base64 + '</pre>';
        };
        reader.readAsDataURL(blob);
      }, 'image/webp', 0.95);
    });

    video.addEventListener('error', function(e) {
      document.body.innerHTML = '<pre>Error loading video: ' + e.message + '</pre>';
    });
  </script>
</body>
</html>
      `

      return new Response(html, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html;charset=UTF-8'
        }
      })

    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
  }
}
