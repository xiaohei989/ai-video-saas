import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('videos')
  .select('*')
  .ilike('title', '%Fireplace Cozy Selfie%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (error) {
  console.error('查询错误:', error);
} else if (!data) {
  console.log('未找到视频');
} else {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📹 视频详细信息\n');
  console.log('ID:', data.id);
  console.log('标题:', data.title);
  console.log('');
  console.log('状态信息:');
  console.log('  status:', data.status);
  console.log('  migration_status:', data.migration_status);
  console.log('');
  console.log('URL信息:');
  console.log('  video_url:', data.video_url ? '✅ 有' : '❌ 无');
  console.log('  r2_url:', data.r2_url ? '✅ 有' : '❌ 无');
  console.log('  thumbnail_url:', data.thumbnail_url ? (data.thumbnail_url.includes('data:image/svg') ? '❌ SVG占位符' : '✅ 有') : '❌ 无');
  console.log('  thumbnail_blur_url:', data.thumbnail_blur_url ? '✅ 有' : '❌ 无');
  console.log('');
  console.log('时间信息:');
  console.log('  created_at:', data.created_at);
  console.log('  processing_completed_at:', data.processing_completed_at || '(未完成)');
  console.log('  r2_uploaded_at:', data.r2_uploaded_at || '(未上传)');
  console.log('  thumbnail_generated_at:', data.thumbnail_generated_at || '(未生成)');
  console.log('');
  
  if (data.processing_completed_at && data.r2_uploaded_at) {
    const completed = new Date(data.processing_completed_at);
    const uploaded = new Date(data.r2_uploaded_at);
    const diff = Math.floor((uploaded - completed) / 1000);
    console.log('⏱️  时间差:');
    console.log('  生成完成 → R2迁移:', diff, '秒');
  }
  
  if (data.r2_uploaded_at && data.thumbnail_generated_at) {
    const uploaded = new Date(data.r2_uploaded_at);
    const thumbGen = new Date(data.thumbnail_generated_at);
    const diff = Math.floor((thumbGen - uploaded) / 1000);
    console.log('  R2迁移 → 缩略图生成:', diff, '秒');
  }
  
  console.log('');
  console.log('完整URL:');
  if (data.video_url) console.log('  video_url:', data.video_url);
  if (data.r2_url) console.log('  r2_url:', data.r2_url);
  if (data.thumbnail_url && !data.thumbnail_url.includes('data:image/svg')) {
    console.log('  thumbnail_url:', data.thumbnail_url);
  }
}
