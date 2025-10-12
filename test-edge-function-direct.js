/**
 * 直接测试 Edge Function 是否工作
 * 绕过数据库触发器，直接调用 Edge Function
 */

import 'dotenv/config';

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const videoId = '7dc2ddff-3ebf-41c1-a289-05448c6be19d';
const videoUrl = 'https://cdn.veo3video.me/videos/7dc2ddff-3ebf-41c1-a289-05448c6be19d.mp4';

console.log('🧪 直接测试 Edge Function\n');
console.log(`📹 Video ID: ${videoId}`);
console.log(`🎬 Video URL: ${videoUrl}\n`);

const edgeFunctionUrl = `${supabaseUrl}/functions/v1/auto-generate-thumbnail`;

console.log(`🚀 调用 Edge Function: ${edgeFunctionUrl}\n`);

try {
  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify({
      videoId,
      videoUrl
    })
  });

  console.log(`📡 HTTP 状态: ${response.status} ${response.statusText}`);

  const result = await response.json();
  console.log('\n📊 返回结果:');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('\n✅ Edge Function 调用成功！');
    console.log(`🖼️  缩略图 URL: ${result.data.thumbnailUrl}`);
    if (result.data.blurThumbnailUrl) {
      console.log(`🌫️  模糊图 URL: ${result.data.blurThumbnailUrl}`);
    }
    console.log(`⚙️  生成方法: ${result.data.method}`);
  } else {
    console.log('\n❌ Edge Function 返回失败');
    console.log(`错误: ${result.error}`);
    if (result.stack) {
      console.log(`\n堆栈:\n${result.stack}`);
    }
  }

} catch (error) {
  console.error('\n❌ 调用失败:', error.message);
  console.error(error);
}
