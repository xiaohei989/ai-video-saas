import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const VIDEO_ID = 'e8bfccd7-49b1-4b8c-a90a-fcfee914cb63';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 深度检查 Puppy 视频缩略图问题\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 1. 查询视频详细信息
console.log('1️⃣ 视频信息:');
const { data: video } = await supabase
  .from('videos')
  .select('*')
  .eq('id', VIDEO_ID)
  .single();

if (!video) {
  console.error('❌ 视频不存在');
  process.exit(1);
}

console.log('   ID:', video.id);
console.log('   标题:', video.title);
console.log('   状态:', video.status);
console.log('   创建时间:', video.created_at);
console.log('   视频URL:', video.video_url);
console.log('   迁移状态:', video.migration_status);
console.log('   R2上传时间:', video.r2_uploaded_at);
console.log('   缩略图URL:', video.thumbnail_url || '(无)');
console.log('   缩略图生成时间:', video.thumbnail_generated_at || '(无)');
console.log('');

// 2. 计算时间差
if (video.r2_uploaded_at) {
  const uploadTime = new Date(video.r2_uploaded_at);
  const now = new Date();
  const diffSeconds = Math.floor((now - uploadTime) / 1000);
  console.log('⏱️  迁移完成已过:', diffSeconds, '秒');
  console.log('');
}

// 3. 检查触发器是否存在
console.log('2️⃣ 检查触发器:');
const { data: triggers } = await supabase.rpc('sql', {
  query: `
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE trigger_name = 'on_video_completed_auto_thumbnail'
      AND event_object_table = 'videos';
  `
});

if (triggers && triggers.length > 0) {
  console.log('   ✅ 触发器存在');
} else {
  console.log('   ❌ 触发器不存在！');
}
console.log('');

// 4. 手动测试视频 URL 是否可以生成缩略图
console.log('3️⃣ 测试 Cloudflare Media Transformations:');
const testUrl = 'https://veo3video.me/cdn-cgi/media/mode=frame,time=0.1s,format=jpg,width=960,height=540,fit=cover,quality=95/' + video.video_url;
console.log('   测试URL:', testUrl);

try {
  const response = await fetch(testUrl, { method: 'HEAD' });
  console.log('   HTTP 状态:', response.status, response.statusText);
  console.log('   Content-Type:', response.headers.get('content-type'));

  if (response.ok && response.headers.get('content-type')?.includes('image')) {
    console.log('   ✅ 视频可以生成缩略图');
  } else {
    console.log('   ❌ 视频无法生成缩略图');
  }
} catch (error) {
  console.log('   ❌ 请求失败:', error.message);
}
console.log('');

// 5. 检查是否有其他类似时间的视频成功了
console.log('4️⃣ 对比同期其他视频:');
const { data: similarVideos } = await supabase
  .from('videos')
  .select('id, title, created_at, thumbnail_url, thumbnail_generated_at')
  .gte('created_at', '2025-10-07T10:00:00')
  .lte('created_at', '2025-10-07T11:00:00')
  .order('created_at', { ascending: false });

if (similarVideos && similarVideos.length > 0) {
  console.log(`   找到 ${similarVideos.length} 个同期视频:\n`);
  similarVideos.forEach(v => {
    const hasThumbnail = v.thumbnail_url && !v.thumbnail_url.includes('data:image/svg');
    console.log('   -', v.title.substring(0, 30) + '...');
    console.log('     缩略图:', hasThumbnail ? '✅' : '❌');
    console.log('     生成时间:', v.thumbnail_generated_at || '(无)');
  });
}
console.log('');

// 6. 分析结论
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 问题分析:\n');

if (!video.thumbnail_url || video.thumbnail_url.includes('data:image/svg')) {
  console.log('❌ Puppy 视频确实没有缩略图');

  if (video.migration_status !== 'completed') {
    console.log('   原因: 视频未完成迁移');
  } else {
    console.log('   可能原因:');
    console.log('   1. 触发器没有执行（需要检查数据库日志）');
    console.log('   2. Edge Function 调用失败（需要检查 pg_net 日志）');
    console.log('   3. Cloudflare 处理失败（504 超时）');
    console.log('');
    console.log('   建议: 手动触发一次生成（运行 manual-trigger-puppy.js）');
  }
} else {
  console.log('✅ Puppy 视频已有缩略图:', video.thumbnail_url);
}
