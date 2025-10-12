import 'dotenv/config';

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const videoId = '2efa121a-735b-431b-8432-40c903014a33';
const videoUrl = 'https://cdn.veo3video.me/videos/2efa121a-735b-431b-8432-40c903014a33.mp4';

console.log('🧪 直接测试 Edge Function\n');

const edgeFunctionUrl = `${supabaseUrl}/functions/v1/auto-generate-thumbnail`;

try {
  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify({ videoId, videoUrl })
  });

  console.log(`📡 HTTP 状态: ${response.status} ${response.statusText}`);

  const result = await response.json();
  console.log('\n📊 返回结果:');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('\n✅ 缩略图生成成功！');
    console.log(`🖼️  ${result.data.thumbnailUrl}`);
  } else {
    console.log('\n❌ 生成失败:', result.error);
  }
} catch (error) {
  console.error('\n❌ 调用失败:', error.message);
}
