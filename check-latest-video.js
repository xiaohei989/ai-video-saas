import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查最新兔子视频状态\n');

// 查询最新的兔子视频
const { data: video, error } = await supabase
  .from('videos')
  .select('id, title, status, video_url, r2_url, migration_status, thumbnail_url, thumbnail_generated_at, created_at')
  .or('title.ilike.%ウサギ15匹%,title.ilike.%トランポリン%')
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
console.log('');

console.log('🌐 URL信息:');
console.log(`   video_url: ${video.video_url}`);
console.log(`   r2_url: ${video.r2_url || '(未设置)'}`);
console.log('');

console.log('📦 迁移状态:');
console.log(`   migration_status: ${video.migration_status || '(未设置)'}`);

// 判断视频是否在R2
const isOnR2 = video.video_url?.includes('cdn.veo3video.me') ||
               video.video_url?.includes('r2.cloudflarestorage.com') ||
               video.r2_url !== null;

console.log(`   是否在R2: ${isOnR2 ? '✅ 是' : '❌ 否 (在OSS上)'}`);
console.log('');

console.log('🖼️ 缩略图状态:');
console.log(`   thumbnail_url: ${video.thumbnail_url || '(未设置)'}`);
console.log(`   thumbnail_generated_at: ${video.thumbnail_generated_at || '(未设置)'}`);
console.log('');

// 检查pg_net响应（最近5分钟）
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
const { data: netResponses } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .gte('created', fiveMinutesAgo)
  .order('created', { ascending: false });

console.log('🌐 最近5分钟的pg_net响应:');
if (netResponses && netResponses.length > 0) {
  netResponses.forEach((r, idx) => {
    console.log(`   ${idx + 1}. [${r.status_summary}] HTTP ${r.status_code || 'N/A'}`);
    console.log(`      时间: ${r.created}`);
    if (r.error_msg) {
      console.log(`      错误: ${r.error_msg}`);
    }
  });
} else {
  console.log('   (无响应)');
}
console.log('');

// 分析问题
console.log('========== 问题分析 ==========');
if (!isOnR2) {
  console.log('❌ 问题1: 视频未迁移到R2');
  console.log('   原因: 后端触发器可能未触发或迁移失败');
  console.log('   解决: 手动触发迁移');
} else {
  console.log('✅ 视频已在R2上');

  if (!video.thumbnail_url) {
    console.log('❌ 问题2: 缩略图未生成');
    console.log('   可能原因:');
    console.log('   - 视频刚上传，Cloudflare还在处理');
    console.log('   - 缩略图触发器未执行');
    console.log('   - 缩略图生成失败');
    console.log('   解决: 手动触发缩略图生成');
  }
}
