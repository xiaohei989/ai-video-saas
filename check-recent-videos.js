import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 查询最近的视频 (所有状态)...\n');

const { data, error } = await supabase
  .from('videos')
  .select('id, title, status, migration_status, video_url, r2_url, thumbnail_url, thumbnail_blur_url, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('❌ 查询错误:', error);
} else if (!data || data.length === 0) {
  console.log('⚠️  未找到视频');
} else {
  console.log(`✅ 找到 ${data.length} 个视频\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  data.forEach((video, index) => {
    const title = typeof video.title === 'string'
      ? video.title
      : JSON.parse(video.title || '{}').en || 'Unknown';

    console.log(`${index + 1}. ${title.substring(0, 50)}`);
    console.log(`   ID: ${video.id}`);
    console.log(`   状态: ${video.status} | 迁移: ${video.migration_status}`);
    console.log(`   video_url: ${video.video_url ? '✅' : '❌'} | r2_url: ${video.r2_url ? '✅' : '❌'}`);
    console.log(`   缩略图: ${video.thumbnail_url && !video.thumbnail_url.includes('data:image/svg') ? '✅ 真实' : (video.thumbnail_url ? '⚠️  SVG' : '❌')}`);
    console.log(`   模糊图: ${video.thumbnail_blur_url ? '✅' : '❌'}`);
    console.log(`   创建时间: ${video.created_at}`);
    console.log('');
  });
}
