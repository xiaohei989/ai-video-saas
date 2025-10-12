import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查 Bouncing Piglets 视频\n');

// 查询视频
const { data: video, error } = await supabase
  .from('videos')
  .select('*')
  .ilike('title', '%Bouncing Piglets%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

console.log('📹 视频信息:');
console.log(`   ID: ${video.id}`);
console.log(`   标题: ${video.title}`);
console.log(`   状态: ${video.status}`);
console.log(`   创建时间: ${video.created_at}`);
console.log(`   完成时间: ${video.processing_completed_at || '(未完成)'}`);
console.log('');

console.log('🌐 URL信息:');
console.log(`   video_url: ${video.video_url || '(未设置)'}`);
console.log(`   r2_url: ${video.r2_url || '(未设置)'}`);
console.log('');

console.log('📦 迁移状态:');
console.log(`   migration_status: ${video.migration_status || '(未设置)'}`);
console.log(`   original_video_url: ${video.original_video_url || '(未设置)'}`);
console.log('');

console.log('🖼️ 缩略图信息:');
console.log(`   thumbnail_url: ${video.thumbnail_url || '(未设置)'}`);
console.log(`   thumbnail_generated_at: ${video.thumbnail_generated_at || '(未设置)'}`);
if (video.thumbnail_metadata) {
  console.log(`   thumbnail_metadata: ${JSON.stringify(video.thumbnail_metadata, null, 2)}`);
}
console.log('');

// 检查视频是否在R2
const isOnR2 = video.video_url?.includes('cdn.veo3video.me') ||
               video.video_url?.includes('r2.cloudflarestorage.com') ||
               video.r2_url !== null;

console.log('========== 分析 ==========');
console.log(`视频是否在R2: ${isOnR2 ? '✅ 是' : '❌ 否'}`);
console.log(`视频状态: ${video.status}`);
console.log(`缩略图: ${video.thumbnail_url ? '✅ 有' : '❌ 无'}`);
console.log('');

if (!isOnR2) {
  console.log('❌ 问题: 视频还未迁移到R2');
  console.log('   迁移状态:', video.migration_status || '未开始');
  console.log('   需要等待迁移完成后才能生成缩略图');
} else if (video.status !== 'completed') {
  console.log('⚠️  视频状态不是 completed');
  console.log('   触发器条件不满足');
} else if (!video.thumbnail_url) {
  console.log('❌ 视频已在R2且状态为completed，但缩略图未生成');
  console.log('   可能原因:');
  console.log('   1. 触发器未执行');
  console.log('   2. 触发器执行失败');
  console.log('   3. 视频太新，Cloudflare还在处理');

  // 检查视频完成时间
  if (video.processing_completed_at) {
    const completedTime = new Date(video.processing_completed_at);
    const now = new Date();
    const minutesSinceComplete = Math.floor((now - completedTime) / 1000 / 60);

    console.log('');
    console.log(`   完成后经过时间: ${minutesSinceComplete} 分钟`);

    if (minutesSinceComplete < 15) {
      console.log('   💡 视频刚完成不久，可能还在等待Cloudflare处理');
      console.log('   建议: 等待15分钟后重试');
    } else {
      console.log('   ⚠️  已超过15分钟，触发器可能失败');
      console.log('   建议: 手动触发缩略图生成');
    }
  }
}

// 检查 pg_net 响应
console.log('');
console.log('🌐 检查最近的 pg_net 响应...');
const videoCreatedAt = new Date(video.created_at);
const { data: netResponses } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .gte('created', videoCreatedAt.toISOString())
  .order('created', { ascending: false })
  .limit(5);

if (netResponses && netResponses.length > 0) {
  console.log(`找到 ${netResponses.length} 条响应:\n`);
  netResponses.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.status_summary}] HTTP ${r.status_code || 'N/A'}`);
    console.log(`   时间: ${r.created}`);
    if (r.error_msg) {
      console.log(`   错误: ${r.error_msg}`);
    }
    console.log('');
  });
} else {
  console.log('(无相关响应记录)');
}
