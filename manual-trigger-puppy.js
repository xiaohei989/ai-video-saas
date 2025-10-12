import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const VIDEO_ID = 'e8bfccd7-49b1-4b8c-a90a-fcfee914cb63';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔄 手动触发 Puppy 视频缩略图生成\n');

// 1. 获取视频信息
const { data: video } = await supabase
  .from('videos')
  .select('*')
  .eq('id', VIDEO_ID)
  .single();

if (!video) {
  console.error('❌ 视频不存在');
  process.exit(1);
}

console.log('📹 视频信息:');
console.log('   标题:', video.title);
console.log('   URL:', video.video_url);
console.log('   迁移状态:', video.migration_status);
console.log('');

// 2. 模拟触发器：直接调用 Edge Function
console.log('🚀 调用 Edge Function...\n');

const edgeUrl = `${process.env.VITE_SUPABASE_URL}/functions/v1/auto-generate-thumbnail`;

const startTime = Date.now();

try {
  const response = await fetch(edgeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      videoId: VIDEO_ID,
      videoUrl: video.video_url
    })
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`⏱️  耗时: ${elapsed}秒`);
  console.log(`📊 HTTP 状态: ${response.status} ${response.statusText}`);
  console.log('');

  if (response.ok) {
    const result = await response.json();
    console.log('✅ 成功!');
    console.log('响应:', JSON.stringify(result, null, 2));

    // 验证数据库
    const { data: updated } = await supabase
      .from('videos')
      .select('thumbnail_url, thumbnail_generated_at')
      .eq('id', VIDEO_ID)
      .single();

    if (updated) {
      console.log('');
      console.log('📊 数据库已更新:');
      console.log('   thumbnail_url:', updated.thumbnail_url);
      console.log('   thumbnail_generated_at:', updated.thumbnail_generated_at);
    }
  } else {
    const errorText = await response.text();
    console.log('❌ 失败!');
    console.log('状态码:', response.status);
    console.log('错误:', errorText);
  }
} catch (error) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`⏱️  耗时: ${elapsed}秒`);
  console.log('❌ 请求失败:', error.message);

  // 检查是否是网络问题
  if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
    console.log('');
    console.log('💡 可能是网络问题。请检查:');
    console.log('1. 是否可以访问 Supabase');
    console.log('2. 环境变量是否正确');
  }
}
