import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 查询最近成功生成缩略图的视频\n');

// 查询最近有缩略图的视频
const { data: videos, error } = await supabase
  .from('videos')
  .select('id, title, video_url, thumbnail_url, thumbnail_generated_at, migration_status, r2_uploaded_at, created_at')
  .not('thumbnail_url', 'is', null)
  .not('thumbnail_url', 'like', 'data:image/svg%')
  .order('thumbnail_generated_at', { ascending: false })
  .limit(3);

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

if (!videos || videos.length === 0) {
  console.log('❌ 没有找到成功生成缩略图的视频');
  process.exit(0);
}

console.log(`✅ 找到 ${videos.length} 个成功的视频:\n`);

for (const video of videos) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📹', video.title);
  console.log('   ID:', video.id);
  console.log('   创建时间:', video.created_at);
  console.log('   缩略图生成:', video.thumbnail_generated_at);
  console.log('   迁移状态:', video.migration_status);
  console.log('   R2上传:', video.r2_uploaded_at || '(未上传)');
  console.log('');
  console.log('   视频URL:', video.video_url);
  console.log('   缩略图URL:', video.thumbnail_url);

  // 测试缩略图是否可访问
  try {
    const thumbResponse = await fetch(video.thumbnail_url, { method: 'HEAD' });
    console.log('   缩略图状态:', thumbResponse.ok ? '✅ 可访问' : '❌ 不可访问');
  } catch (e) {
    console.log('   缩略图状态: ❌ 访问失败');
  }

  console.log('');
}

// 对比 Puppy 视频
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🐶 Puppy 视频对比:\n');

const { data: puppyVideo } = await supabase
  .from('videos')
  .select('*')
  .eq('id', 'e8bfccd7-49b1-4b8c-a90a-fcfee914cb63')
  .single();

if (puppyVideo) {
  console.log('   创建时间:', puppyVideo.created_at);
  console.log('   迁移状态:', puppyVideo.migration_status);
  console.log('   R2上传:', puppyVideo.r2_uploaded_at);
  console.log('   视频URL:', puppyVideo.video_url);
  console.log('');

  // 对比差异
  const successfulVideo = videos[0];

  console.log('🔍 差异分析:');

  if (successfulVideo.video_url && puppyVideo.video_url) {
    const successDomain = new URL(successfulVideo.video_url).hostname;
    const puppyDomain = new URL(puppyVideo.video_url).hostname;
    console.log('   域名: 成功视频', successDomain, 'vs Puppy', puppyDomain);

    if (successDomain !== puppyDomain) {
      console.log('   ⚠️  域名不同!');
    }
  }

  const successTime = new Date(successfulVideo.created_at);
  const puppyTime = new Date(puppyVideo.created_at);

  if (puppyTime > successTime) {
    console.log('   📅 Puppy 视频更新 (', Math.floor((puppyTime - successTime) / 1000 / 60), '分钟后)');
  }

  if (puppyVideo.migration_status !== successfulVideo.migration_status) {
    console.log('   ⚠️  迁移状态不同:', puppyVideo.migration_status, 'vs', successfulVideo.migration_status);
  }
}
