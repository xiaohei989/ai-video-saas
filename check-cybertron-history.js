import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查赛博坦视频的缩略图生成历史\n');

// 1. 查询赛博坦视频
const { data: video, error } = await supabase
  .from('videos')
  .select('*')
  .ilike('title', '%赛博坦%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

console.log('📹 赛博坦视频信息:');
console.log(`   ID: ${video.id}`);
console.log(`   标题: ${video.title}`);
console.log(`   创建时间: ${video.created_at}`);
console.log(`   状态: ${video.status}`);
console.log('');

console.log('🖼️ 缩略图信息:');
console.log(`   thumbnail_url: ${video.thumbnail_url || '(未设置)'}`);
console.log(`   thumbnail_generated_at: ${video.thumbnail_generated_at || '(未设置)'}`);
console.log(`   thumbnail_metadata: ${JSON.stringify(video.thumbnail_metadata || {}, null, 2)}`);
console.log('');

console.log('📦 迁移信息:');
console.log(`   video_url: ${video.video_url}`);
console.log(`   r2_url: ${video.r2_url || '(未设置)'}`);
console.log(`   migration_status: ${video.migration_status || '(未设置)'}`);
console.log(`   original_video_url: ${video.original_video_url || '(未设置)'}`);
console.log('');

// 2. 检查 pg_net 历史响应（查看是否有自动触发记录）
console.log('🌐 检查 pg_net 响应历史（视频创建后的记录）:');

const videoCreatedAt = new Date(video.created_at);
const { data: netResponses } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .gte('created', videoCreatedAt.toISOString())
  .order('created', { ascending: false })
  .limit(10);

if (netResponses && netResponses.length > 0) {
  console.log(`   找到 ${netResponses.length} 条响应:\n`);
  netResponses.forEach((r, idx) => {
    console.log(`   ${idx + 1}. [${r.status_summary}] HTTP ${r.status_code || 'N/A'}`);
    console.log(`      时间: ${r.created}`);
    console.log(`      ID: ${r.id}`);
    if (r.error_msg) {
      console.log(`      错误: ${r.error_msg}`);
    }
    console.log('');
  });
} else {
  console.log('   (无响应记录)');
}
console.log('');

// 3. 分析
console.log('========== 分析 ==========');

const thumbnailTime = video.thumbnail_generated_at ? new Date(video.thumbnail_generated_at) : null;
const videoCompletedTime = video.processing_completed_at ? new Date(video.processing_completed_at) : null;

console.log('时间线:');
console.log(`   1. 视频创建: ${video.created_at}`);
if (videoCompletedTime) {
  console.log(`   2. 视频完成: ${video.processing_completed_at}`);
}
if (thumbnailTime) {
  console.log(`   3. 缩略图生成: ${video.thumbnail_generated_at}`);

  if (videoCompletedTime) {
    const delaySeconds = Math.floor((thumbnailTime - videoCompletedTime) / 1000);
    console.log(`   延迟: ${delaySeconds} 秒`);
  }
}
console.log('');

// 检查缩略图元数据
if (video.thumbnail_metadata) {
  console.log('缩略图生成方式:');
  const method = video.thumbnail_metadata.method || 'unknown';
  const generatedBy = video.thumbnail_metadata.generatedBy || 'unknown';

  console.log(`   方式: ${method}`);
  console.log(`   生成者: ${generatedBy}`);

  if (generatedBy.includes('manual') || method.includes('manual')) {
    console.log('   ✅ 结论: 这是【手动触发】生成的缩略图');
  } else if (generatedBy.includes('auto') || method.includes('auto')) {
    console.log('   ✅ 结论: 这是【自动触发】生成的缩略图');
  } else {
    console.log('   ⚠️  无法判断是手动还是自动');
  }
}
