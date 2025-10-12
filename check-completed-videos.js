import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 查询最近完成的视频...\n');

const { data, error } = await supabase
  .from('videos')
  .select('id, title, status, migration_status, video_url, r2_url, thumbnail_url, thumbnail_generated_at, processing_completed_at, r2_uploaded_at, created_at')
  .eq('status', 'completed')
  .order('processing_completed_at', { ascending: false, nullsLast: true })
  .limit(5);

if (error) {
  console.error('❌ 查询错误:', error);
} else if (!data || data.length === 0) {
  console.log('⚠️  未找到已完成的视频');
} else {
  console.log(`✅ 找到 ${data.length} 个已完成的视频\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  data.forEach((video, index) => {
    console.log(`📹 视频 ${index + 1}:`);
    console.log(`   ID: ${video.id}`);
    console.log(`   标题: ${video.title?.substring(0, 100)}...`);
    console.log(`   状态: ${video.status}`);
    console.log(`   迁移状态: ${video.migration_status}`);
    console.log(`   video_url: ${video.video_url ? '✅ 有' : '❌ 无'}`);
    console.log(`   r2_url: ${video.r2_url ? '✅ 有' : '❌ 无'}`);
    console.log(`   thumbnail_url: ${video.thumbnail_url ? (video.thumbnail_url.includes('data:image/svg') ? '⚠️  SVG占位符' : '✅ 有') : '❌ 无'}`);
    console.log(`   处理完成时间: ${video.processing_completed_at || '(未记录)'}`);
    console.log(`   R2上传时间: ${video.r2_uploaded_at || '❌ 未上传'}`);
    console.log(`   缩略图生成时间: ${video.thumbnail_generated_at || '❌ 未生成'}`);

    if (video.processing_completed_at && video.r2_uploaded_at) {
      const completed = new Date(video.processing_completed_at);
      const uploaded = new Date(video.r2_uploaded_at);
      const diff = Math.floor((uploaded - completed) / 1000);
      console.log(`   ⏱️  完成→R2迁移: ${diff}秒`);
    }

    console.log('');
  });

  // 统计分析
  const withR2 = data.filter(v => v.r2_url).length;
  const withMigrationCompleted = data.filter(v => v.migration_status === 'completed').length;
  const withThumbnail = data.filter(v => v.thumbnail_url && !v.thumbnail_url.includes('data:image/svg')).length;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 统计分析:');
  console.log(`   已迁移到R2: ${withR2}/${data.length}`);
  console.log(`   migration_status='completed': ${withMigrationCompleted}/${data.length}`);
  console.log(`   有真实缩略图: ${withThumbnail}/${data.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
