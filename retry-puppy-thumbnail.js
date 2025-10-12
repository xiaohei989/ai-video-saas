import 'dotenv/config';

const VIDEO_ID = 'e8bfccd7-49b1-4b8c-a90a-fcfee914cb63';
const VIDEO_URL = 'https://cdn.veo3video.me/videos/e8bfccd7-49b1-4b8c-a90a-fcfee914cb63.mp4';

console.log('🔄 重试生成 Puppy 视频缩略图\n');
console.log('📹 视频:', VIDEO_ID);
console.log('🔗 URL:', VIDEO_URL);
console.log('\n🚀 调用 Edge Function...\n');

const startTime = Date.now();

try {
  const response = await fetch(
    'https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/auto-generate-thumbnail',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        videoId: VIDEO_ID,
        videoUrl: VIDEO_URL
      })
    }
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`⏱️  耗时: ${elapsed}秒`);
  console.log(`📊 状态码: ${response.status} ${response.statusText}`);
  console.log('');

  if (response.ok) {
    const result = await response.json();
    console.log('✅ 成功!');
    console.log('📄 响应:', JSON.stringify(result, null, 2));

    if (result.thumbnailUrl) {
      console.log('');
      console.log('🖼️  缩略图 URL:');
      console.log(result.thumbnailUrl);
    }
  } else {
    const error = await response.text();
    console.log('❌ 失败!');
    console.log('错误:', error);
  }
} catch (error) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`⏱️  耗时: ${elapsed}秒`);
  console.log('❌ 请求失败:', error.message);
}
