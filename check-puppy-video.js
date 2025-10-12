import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 查询 Puppy Trampoline Party Night Vision\n');

const { data: video, error } = await supabase
  .from('videos')
  .select('*')
  .ilike('title', '%Puppy Trampoline Party Night Vision%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

if (!video) {
  console.log('❌ 未找到该视频');
  process.exit(0);
}

console.log('📹 视频信息:');
console.log('   ID:', video.id);
console.log('   标题:', video.title);
console.log('   状态:', video.status);
console.log('   创建时间:', video.created_at);
console.log('   完成时间:', video.processing_completed_at || '(未完成)');
console.log('');

console.log('🌐 URL 信息:');
console.log('   video_url:', video.video_url || '(无)');
const isOnR2 = video.video_url && video.video_url.includes('cdn.veo3video.me');
console.log('   位置:', isOnR2 ? '✅ R2' : '❌ OSS');
console.log('');

console.log('📦 迁移状态:');
console.log('   migration_status:', video.migration_status || '(未设置)');
console.log('   r2_uploaded_at:', video.r2_uploaded_at || '(未上传)');
console.log('');

console.log('🖼️ 缩略图状态:');
const hasThumbnail = video.thumbnail_url && !video.thumbnail_url.includes('data:image/svg');
console.log('   状态:', hasThumbnail ? '✅ 有缩略图' : '❌ 无缩略图');
if (hasThumbnail) {
  console.log('   URL:', video.thumbnail_url);
  console.log('   生成时间:', video.thumbnail_generated_at || '(未记录)');
  if (video.thumbnail_metadata) {
    console.log('   元数据:', JSON.stringify(video.thumbnail_metadata));
  }
} else if (video.thumbnail_url) {
  console.log('   URL:', video.thumbnail_url.substring(0, 100) + '...');
}
console.log('');

// 时间分析
if (video.processing_completed_at && video.r2_uploaded_at) {
  const completedTime = new Date(video.processing_completed_at);
  const r2Time = new Date(video.r2_uploaded_at);
  const now = new Date();

  const migrationDelay = Math.floor((r2Time - completedTime) / 1000);
  const r2MinutesAgo = Math.floor((now - r2Time) / 1000 / 60);

  console.log('⏱️  时间分析:');
  console.log('   迁移耗时:', migrationDelay, '秒');
  console.log('   R2 上传后经过:', r2MinutesAgo, '分钟');

  if (hasThumbnail && video.thumbnail_generated_at) {
    const thumbTime = new Date(video.thumbnail_generated_at);
    const thumbDelay = Math.floor((thumbTime - r2Time) / 1000);
    console.log('   缩略图生成延迟:', thumbDelay, '秒 (迁移后)');
  } else if (!hasThumbnail && r2MinutesAgo > 2) {
    console.log('   ⚠️  迁移完成超过2分钟,但缩略图未生成!');
  }
  console.log('');
}

// 结论
console.log('========== 结论 ==========');
if (video.status !== 'completed') {
  console.log('❌ 视频还在处理中,状态:', video.status);
} else if (!isOnR2) {
  console.log('❌ 视频已完成但未迁移到 R2');
} else if (hasThumbnail) {
  console.log('✅ 缩略图已生成');
  console.log('🔗', video.thumbnail_url);
} else {
  console.log('❌ 缩略图未生成');
  console.log('   可能原因:');
  if (video.migration_status !== 'completed') {
    console.log('   - 迁移状态不是 completed:', video.migration_status);
  }

  if (video.r2_uploaded_at) {
    const r2Time = new Date(video.r2_uploaded_at);
    const now = new Date();
    const minutesAgo = Math.floor((now - r2Time) / 1000 / 60);
    if (minutesAgo < 2) {
      console.log('   - 刚迁移完成,可能还在生成中 (', minutesAgo, '分钟前)');
    } else {
      console.log('   - 触发器可能未执行或执行失败');
    }
  } else {
    console.log('   - 视频未上传到 R2');
  }
}
