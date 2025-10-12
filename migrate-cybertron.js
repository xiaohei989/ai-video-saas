import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const videoId = 'a39d210b-2abf-4f2e-ad34-4a3897672af5';

console.log('🚀 开始迁移赛博坦视频到 R2\n');
console.log(`视频ID: ${videoId}\n`);

// 调用服务端迁移 Edge Function
console.log('调用 migrate-video Edge Function...\n');

const { data, error } = await supabase.functions.invoke('migrate-video', {
  body: {
    videoId,
    forceRemigrate: false
  }
});

if (error) {
  console.error('❌ 迁移失败:', error);
  process.exit(1);
}

console.log('✅ Edge Function 响应:');
console.log(JSON.stringify(data, null, 2));

if (data.success) {
  console.log('\n✅ 迁移成功！');
  console.log(`R2 URL: ${data.r2Url}`);
  console.log(`R2 Key: ${data.r2Key}`);

  // 等待数据库更新
  console.log('\n等待 3 秒后检查状态...');
  await new Promise(r => setTimeout(r, 3000));

  // 检查视频状态
  const { data: video } = await supabase
    .from('videos')
    .select('video_url, r2_url, migration_status, thumbnail_url')
    .eq('id', videoId)
    .single();

  console.log('\n📹 视频最新状态:');
  console.log(`video_url: ${video.video_url}`);
  console.log(`r2_url: ${video.r2_url}`);
  console.log(`migration_status: ${video.migration_status}`);
  console.log(`thumbnail_url: ${video.thumbnail_url || '(未生成)'}`);

  // 检查缩略图状态
  if (video.thumbnail_url && !video.thumbnail_url.startsWith('data:image/svg')) {
    console.log('\n✅ 缩略图已存在！');
  } else {
    console.log('\n⏳ 缩略图将自动生成（约30秒-2分钟）...');
  }
} else {
  console.log('\n❌ 迁移失败:', data.error);
  if (data.skipped) {
    console.log(`原因: ${data.reason}`);
  }
}
