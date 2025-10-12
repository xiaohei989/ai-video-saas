import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const VIDEO_ID = 'e8bfccd7-49b1-4b8c-a90a-fcfee914cb63';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('📊 Puppy 视频时间线分析\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 获取视频详细信息
const { data: video } = await supabase
  .from('videos')
  .select('*')
  .eq('id', VIDEO_ID)
  .single();

if (!video) {
  console.error('❌ 视频不存在');
  process.exit(1);
}

// 构建时间线
const timeline = [];

if (video.created_at) {
  timeline.push({
    time: new Date(video.created_at),
    event: '视频创建',
    field: 'created_at'
  });
}

if (video.processing_started_at) {
  timeline.push({
    time: new Date(video.processing_started_at),
    event: '开始生成',
    field: 'processing_started_at'
  });
}

if (video.processing_completed_at) {
  timeline.push({
    time: new Date(video.processing_completed_at),
    event: '生成完成 (status → completed)',
    field: 'processing_completed_at',
    note: '⚠️ 旧触发器在这里触发（但视频还没迁移到 R2）'
  });
}

if (video.r2_uploaded_at) {
  timeline.push({
    time: new Date(video.r2_uploaded_at),
    event: '迁移到 R2 (migration_status → completed)',
    field: 'r2_uploaded_at',
    note: '✅ 新触发器应该在这里触发'
  });
}

if (video.thumbnail_generated_at) {
  timeline.push({
    time: new Date(video.thumbnail_generated_at),
    event: '缩略图生成',
    field: 'thumbnail_generated_at',
    note: '🔧 手动触发生成的'
  });
}

// 按时间排序
timeline.sort((a, b) => a.time - b.time);

// 输出时间线
console.log('⏱️  时间线:\n');

let baseTime = timeline[0].time;

timeline.forEach((item, index) => {
  const elapsed = index === 0 ? 0 : Math.floor((item.time - baseTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log(`${index + 1}. ${item.time.toISOString()}`);
  console.log(`   [+${minutes}分${seconds}秒] ${item.event}`);
  if (item.note) {
    console.log(`   ${item.note}`);
  }
  console.log('');
});

// 分析问题
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 问题分析:\n');

const processingCompletedTime = new Date(video.processing_completed_at);
const migrationCompletedTime = new Date(video.r2_uploaded_at);
const timeDiff = Math.floor((migrationCompletedTime - processingCompletedTime) / 1000);

console.log(`1. 视频生成完成 → 迁移完成: ${timeDiff} 秒`);
console.log('');
console.log('2. 旧触发器 (021_auto_thumbnail_trigger.sql):');
console.log('   触发条件: NEW.status = "completed"');
console.log('   触发时间: 视频生成完成时 (10:48:04)');
console.log('   问题: 此时视频还没迁移到 R2，还在 Cloudinary');
console.log('   结果: 触发器尝试从 Cloudinary URL 生成缩略图');
console.log('');
console.log('3. 新触发器 (fix-thumbnail-trigger-smart-delay.sql):');
console.log('   触发条件: NEW.migration_status = "completed"');
console.log('   触发时间: R2 迁移完成时 (10:48:38)');
console.log('   优势: 此时视频已在 Cloudflare CDN 上');
console.log('   智能延迟: 等待 30 秒让 Cloudflare 处理视频');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ 解决方案:\n');
console.log('部署新触发器 (fix-thumbnail-trigger-smart-delay.sql)');
console.log('命令: PGPASSWORD="..." psql ... -f fix-thumbnail-trigger-smart-delay.sql');
console.log('');
console.log('新触发器特性:');
console.log('  ✓ 基于 migration_status 而非 status');
console.log('  ✓ 计算迁移完成后的时间');
console.log('  ✓ 传递时间信息给 Edge Function');
console.log('  ✓ Edge Function 智能延迟（< 30秒则等待）');
console.log('  ✓ 重试机制 (0s → 30s → 120s)');
console.log('  ✓ 总超时 150 秒');
