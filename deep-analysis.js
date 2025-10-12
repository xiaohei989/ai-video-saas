import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 深度分析 Puppy 视频\n');

// 获取 Puppy 视频
const { data: puppy } = await supabase
  .from('videos')
  .select('*')
  .ilike('title', '%Puppy Trampoline Party Night Vision%')
  .single();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1️⃣ Puppy 视频状态:\n');
console.log('   创建时间:', puppy.created_at);
console.log('   生成完成:', puppy.processing_completed_at);
console.log('   R2迁移:', puppy.r2_uploaded_at);
console.log('   缩略图生成:', puppy.thumbnail_generated_at);
console.log('');

// 计算时间差
const created = new Date(puppy.created_at);
const completed = new Date(puppy.processing_completed_at);
const migrated = new Date(puppy.r2_uploaded_at);
const thumbGenerated = puppy.thumbnail_generated_at ? new Date(puppy.thumbnail_generated_at) : null;

console.log('   时间差:');
console.log('   - 创建 → 完成:', Math.floor((completed - created) / 1000), '秒');
console.log('   - 完成 → 迁移:', Math.floor((migrated - completed) / 1000), '秒');
if (thumbGenerated) {
  console.log('   - 迁移 → 缩略图:', Math.floor((thumbGenerated - migrated) / 1000), '秒');
}
console.log('');

// 对比同期成功的视频
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('2️⃣ 对比同期成功的视频:\n');

const { data: successVideos } = await supabase
  .from('videos')
  .select('*')
  .gte('created_at', '2025-10-07T10:00:00')
  .lte('created_at', '2025-10-07T11:00:00')
  .not('thumbnail_url', 'is', null)
  .not('thumbnail_url', 'like', 'data:image/svg%')
  .order('created_at', { ascending: false })
  .limit(3);

for (const video of successVideos) {
  console.log(`📹 ${video.title.substring(0, 40)}...`);
  console.log('   创建:', video.created_at);
  console.log('   R2迁移:', video.r2_uploaded_at);
  console.log('   缩略图:', video.thumbnail_generated_at);
  
  const vMigrated = new Date(video.r2_uploaded_at);
  const vThumb = new Date(video.thumbnail_generated_at);
  const delay = Math.floor((vThumb - vMigrated) / 1000);
  console.log('   迁移 → 缩略图:', delay, '秒');
  console.log('');
}

// 检查触发器是否执行过
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('3️⃣ 分析:\n');

if (!puppy.thumbnail_generated_at) {
  console.log('❌ Puppy 视频当时没有生成缩略图');
  console.log('   原因: 触发器可能没有执行或执行失败');
} else {
  const autoDelay = Math.floor((thumbGenerated - migrated) / 1000);
  if (autoDelay > 86400) {
    console.log('⚠️  Puppy 视频缩略图是后来才生成的');
    console.log(`   延迟: ${Math.floor(autoDelay / 86400)} 天`);
    console.log('   结论: 自动触发器没有工作');
  } else {
    console.log('✅ Puppy 视频缩略图是自动生成的');
    console.log(`   延迟: ${autoDelay} 秒`);
  }
}

console.log('\n关键问题:');
console.log('为什么 Puppy 视频在 2025-10-07 迁移完成后没有自动生成缩略图？');
console.log('而同期其他视频都成功了？');
