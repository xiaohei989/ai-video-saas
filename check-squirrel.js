import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 查看 Squirrel Trampoline Party at Night\n');

const { data: video, error } = await supabase
  .from('videos')
  .select('*')
  .ilike('title', '%Squirrel Trampoline%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

console.log('📹 视频信息:');
console.log('   ID:', video.id);
console.log('   标题:', video.title);
console.log('   状态:', video.status);
console.log('   创建时间:', video.created_at);
console.log('   完成时间:', video.processing_completed_at || '(未完成)');
console.log('');

console.log('🖼️ 缩略图状态:');
const hasThumbnail = video.thumbnail_url && !video.thumbnail_url.includes('data:image/svg');
console.log('   缩略图:', hasThumbnail ? '✅ 有' : '❌ 无');
if (hasThumbnail) {
  console.log('   URL:', video.thumbnail_url);
  console.log('   生成时间:', video.thumbnail_generated_at);
}
console.log('');

console.log('📦 迁移状态:');
console.log('   migration_status:', video.migration_status || '(未设置)');
const isOnR2 = video.video_url && video.video_url.includes('cdn.veo3video.me');
console.log('   视频位置:', isOnR2 ? '✅ R2' : '❌ OSS');
if (video.r2_uploaded_at) {
  console.log('   R2上传时间:', video.r2_uploaded_at);
}
console.log('');

// 时间分析
if (video.processing_completed_at) {
  const completedTime = new Date(video.processing_completed_at);
  const now = new Date();
  const minutesAgo = Math.floor((now - completedTime) / 1000 / 60);

  console.log('⏱️  时间分析:');
  console.log('   完成后经过:', minutesAgo, '分钟');

  if (video.r2_uploaded_at) {
    const r2Time = new Date(video.r2_uploaded_at);
    const migrationDelay = Math.floor((r2Time - completedTime) / 1000);
    console.log('   迁移耗时:', migrationDelay, '秒');

    if (hasThumbnail && video.thumbnail_generated_at) {
      const thumbTime = new Date(video.thumbnail_generated_at);
      const thumbDelay = Math.floor((thumbTime - r2Time) / 1000);
      console.log('   缩略图生成延迟:', thumbDelay, '秒 (迁移完成后)');
    }
  }
  console.log('');
}

// 结论
console.log('========== 结论 ==========');
if (hasThumbnail) {
  console.log('✅ 缩略图已生成');
  console.log('🔗', video.thumbnail_url);
} else {
  console.log('❌ 缩略图未生成');
  if (!isOnR2) {
    console.log('   原因: 视频还在 OSS，未迁移到 R2');
  } else if (video.migration_status !== 'completed') {
    console.log('   原因: 迁移状态不是 completed');
  } else {
    console.log('   原因: 未知（可能触发器未执行）');
  }
}
