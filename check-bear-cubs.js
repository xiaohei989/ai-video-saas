import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 深度检查: Bear Cubs Bounce Under the Stars\n');

const { data: video, error } = await supabase
  .from('videos')
  .select('*')
  .ilike('title', '%Bear Cubs%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

console.log('📹 视频完整信息:');
console.log('   ID:', video.id);
console.log('   标题:', video.title);
console.log('   状态:', video.status);
console.log('   创建时间:', video.created_at);
console.log('   完成时间:', video.processing_completed_at || '(未完成)');
console.log('');

console.log('🌐 URL信息:');
console.log('   video_url:', video.video_url || '(未设置)');
console.log('   r2_url:', video.r2_url || '(未设置)');
console.log('   original_video_url:', video.original_video_url || '(未设置)');
console.log('');

console.log('📦 迁移状态:');
console.log('   migration_status:', video.migration_status || '(未设置)');
console.log('   r2_uploaded_at:', video.r2_uploaded_at || '(未设置)');
console.log('');

console.log('🖼️ 缩略图信息:');
console.log('   thumbnail_url:', video.thumbnail_url || '(未设置)');
console.log('   thumbnail_generated_at:', video.thumbnail_generated_at || '(未设置)');
if (video.thumbnail_metadata) {
  console.log('   metadata:', JSON.stringify(video.thumbnail_metadata));
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

    const r2MinutesAgo = Math.floor((now - r2Time) / 1000 / 60);
    console.log('   R2上传后经过:', r2MinutesAgo, '分钟');
  }
  console.log('');
}

// 判断视频位置
const isOnR2 = video.video_url?.includes('cdn.veo3video.me') ||
               video.video_url?.includes('r2.cloudflarestorage.com');
console.log('🎯 视频位置:', isOnR2 ? '✅ R2' : '❌ OSS');
console.log('');

// 查询 pg_net 响应
console.log('🌐 pg_net 响应记录:');
const videoCreatedAt = new Date(video.created_at);
const { data: netResponses } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .gte('created', videoCreatedAt.toISOString())
  .order('created', { ascending: false })
  .limit(10);

if (netResponses && netResponses.length > 0) {
  console.log(`找到 ${netResponses.length} 条响应:\n`);
  netResponses.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.status_summary}] HTTP ${r.status_code || 'N/A'}`);
    console.log(`   时间: ${r.created}`);
    console.log(`   ID: ${r.id}`);
    if (r.error_msg) {
      console.log(`   ❌ 错误: ${r.error_msg}`);
    }
    console.log('');
  });
} else {
  console.log('❌ 无响应记录\n');
}

// 深度分析
console.log('========== 深度分析 ==========');

if (!isOnR2) {
  console.log('❌ 问题1: 视频未迁移到 R2');
  console.log('   迁移状态:', video.migration_status || '未开始');
  console.log('   → 缩略图生成需要视频在 R2 上');
} else {
  console.log('✅ 视频已在 R2');

  if (!video.thumbnail_url) {
    console.log('❌ 问题2: 缩略图未生成');

    if (netResponses && netResponses.length === 0) {
      console.log('   → 触发器未执行（没有 pg_net 记录）');
      console.log('   → 可能原因:');
      console.log('     1. 触发器配置有问题');
      console.log('     2. 视频完成时状态变更未触发');
      console.log('     3. 触发器条件不满足');
    } else {
      const hasTimeout = netResponses.some(r => r.error_msg?.includes('Timeout'));
      const hasSuccess = netResponses.some(r => r.status_code === 200);

      if (hasTimeout && !hasSuccess) {
        console.log('   → 触发器已执行但超时');
        console.log('   → Cloudflare 还在处理视频');
      } else if (hasSuccess) {
        console.log('   → 触发器已执行且成功');
        console.log('   → 但数据库未更新？检查 Edge Function');
      }
    }
  }
}
