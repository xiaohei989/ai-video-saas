import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 检查最近视频的缩略图状态\n');

// 查找标题包含 "赛博坦" 的视频
const { data: videos, error: searchError } = await supabase
  .from('videos')
  .select('id, title, status, video_url, thumbnail_url, thumbnail_generated_at, thumbnail_metadata, created_at')
  .ilike('title', '%赛博坦%')
  .order('created_at', { ascending: false })
  .limit(1);

if (searchError) {
  console.error('❌ 查询失败:', searchError);
  process.exit(1);
}

if (!videos || videos.length === 0) {
  console.log('⚠️  未找到匹配的视频，查询最近5个视频...\n');

  const { data: recentVideos, error: recentError } = await supabase
    .from('videos')
    .select('id, title, status, video_url, thumbnail_url, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentError) {
    console.error('❌ 查询失败:', recentError);
    process.exit(1);
  }

  console.log('最近的 5 个视频:');
  recentVideos?.forEach((v, idx) => {
    const hasThumbnail = v.thumbnail_url && !v.thumbnail_url.startsWith('data:image/svg');
    console.log(`\n${idx + 1}. ${v.title}`);
    console.log(`   状态: ${v.status}`);
    console.log(`   视频: ${v.video_url ? '✅' : '❌'}`);
    console.log(`   缩略图: ${hasThumbnail ? '✅' : '❌'}`);
    console.log(`   ID: ${v.id}`);
  });
  process.exit(0);
}

const data = videos[0];
const error = null;

console.log('📹 视频信息:');
console.log('='.repeat(60));
console.log(`标题: ${data.title}`);
console.log(`ID: ${data.id}`);
console.log(`状态: ${data.status}`);
console.log(`创建时间: ${data.created_at}`);
console.log(`视频 URL: ${data.video_url || '(未生成)'}`);
console.log('');

const hasThumbnail = data.thumbnail_url && !data.thumbnail_url.startsWith('data:image/svg');

if (hasThumbnail) {
  console.log('✅ 缩略图已生成');
  console.log(`   URL: ${data.thumbnail_url}`);
  console.log(`   生成时间: ${data.thumbnail_generated_at}`);
  if (data.thumbnail_metadata) {
    console.log(`   元数据:`);
    console.log(JSON.stringify(data.thumbnail_metadata, null, 2));
  }
} else {
  console.log('❌ 缩略图未生成');
  console.log(`   当前 URL: ${data.thumbnail_url || '(null)'}`);
  console.log('');

  // 检查触发器是否执行
  if (data.status === 'completed' && data.video_url) {
    console.log('💡 视频已完成但缩略图未生成，检查 Edge Function 日志...\n');

    // 检查最近的 pg_net 响应
    console.log('📊 最近的 pg_net HTTP 响应:');
    const { data: responses } = await supabase
      .from('pg_net_recent_responses')
      .select('*')
      .order('created', { ascending: false })
      .limit(3);

    if (responses && responses.length > 0) {
      responses.forEach((r, idx) => {
        console.log(`\n${idx + 1}. [${r.status_summary}] HTTP ${r.status_code || 'N/A'}`);
        console.log(`   响应 ID: ${r.id}`);
        console.log(`   时间: ${r.created}`);
        console.log(`   错误: ${r.error_msg || '无'}`);
        if (r.content_preview) {
          console.log(`   内容: ${r.content_preview}`);
        }
      });
    } else {
      console.log('⚠️  没有找到最近的 pg_net 响应');
    }
  } else if (data.status !== 'completed') {
    console.log(`💡 视频状态为 "${data.status}"，缩略图在视频完成后自动生成`);
  } else if (!data.video_url) {
    console.log('💡 视频 URL 为空，无法生成缩略图');
  }
}

console.log('\n' + '='.repeat(60));
