/**
 * 测试完整的后端自动触发流程
 * 1. 找一个有 video_url 但没有真实缩略图的视频
 * 2. 更新视频状态为 'completed' 来触发触发器
 * 3. 等待并检查是否自动生成缩略图
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 测试后端自动触发缩略图生成\n');

// 步骤 1: 找一个合适的测试视频
console.log('📊 步骤 1: 查找合适的测试视频...');
const { data: videos, error: findError } = await supabase
  .from('videos')
  .select('id, title, video_url, thumbnail_url, status')
  .eq('status', 'completed')
  .not('video_url', 'is', null)
  .or('thumbnail_url.is.null,thumbnail_url.like.data:image/svg%')
  .order('created_at', { ascending: false })
  .limit(3);

if (findError || !videos || videos.length === 0) {
  console.error('❌ 找不到合适的测试视频');
  console.log('💡 需要一个 status=completed, video_url 不为空，但没有真实缩略图的视频');
  process.exit(1);
}

console.log(`✅ 找到 ${videos.length} 个候选视频:\n`);
videos.forEach((v, idx) => {
  console.log(`${idx + 1}. ${v.id}`);
  console.log(`   标题: ${v.title}`);
  console.log(`   状态: ${v.status}`);
  console.log(`   视频: ${v.video_url ? '✓' : '✗'}`);
  console.log(`   缩略图: ${v.thumbnail_url && !v.thumbnail_url.startsWith('data:image/svg') ? '✓ ' + v.thumbnail_url : '✗ (占位符)'}`);
  console.log('');
});

const testVideo = videos[0];
console.log(`🎯 选择视频: ${testVideo.id}\n`);

// 步骤 2: 清除现有缩略图并重置状态，然后重新标记为 completed
console.log('🔄 步骤 2: 触发视频状态更新（模拟视频刚完成）...');

// 先将状态改为 processing
const { error: resetError } = await supabase
  .from('videos')
  .update({
    status: 'processing',
    thumbnail_url: null,
    thumbnail_metadata: null
  })
  .eq('id', testVideo.id);

if (resetError) {
  console.error('❌ 重置失败:', resetError);
  process.exit(1);
}

console.log('   ✓ 状态已重置为 processing');

// 等待 1 秒
await new Promise(resolve => setTimeout(resolve, 1000));

// 然后标记为 completed，这应该触发触发器
const { error: triggerError } = await supabase
  .from('videos')
  .update({
    status: 'completed'
  })
  .eq('id', testVideo.id);

if (triggerError) {
  console.error('❌ 触发失败:', triggerError);
  process.exit(1);
}

console.log('   ✓ 状态已更新为 completed，触发器应该已触发\n');

// 步骤 3: 等待 15 秒让后端处理
console.log('⏳ 步骤 3: 等待 15 秒让后端处理...');
for (let i = 15; i > 0; i--) {
  process.stdout.write(`\r   ${i} 秒...`);
  await new Promise(resolve => setTimeout(resolve, 1000));
}
console.log('\n');

// 步骤 4: 检查视频缩略图是否已生成
console.log('📸 步骤 4: 检查视频缩略图状态...');
const { data: updatedVideo, error: checkError } = await supabase
  .from('videos')
  .select('id, thumbnail_url, thumbnail_generated_at, thumbnail_metadata')
  .eq('id', testVideo.id)
  .single();

if (checkError) {
  console.error('❌ 查询失败:', checkError);
  process.exit(1);
}

if (updatedVideo.thumbnail_url && !updatedVideo.thumbnail_url.startsWith('data:image/svg')) {
  console.log('✅ 缩略图已自动生成！');
  console.log(`🖼️  URL: ${updatedVideo.thumbnail_url}`);
  console.log(`⏰ 生成时间: ${updatedVideo.thumbnail_generated_at}`);
  if (updatedVideo.thumbnail_metadata) {
    console.log(`📊 元数据:`, updatedVideo.thumbnail_metadata);
  }
  console.log('\n🎉 后端自动触发功能测试成功！');
} else {
  console.log('⚠️  缩略图尚未生成');
  console.log(`   当前值: ${updatedVideo.thumbnail_url || '(null)'}`);
  console.log('\n💡 可能的原因:');
  console.log('1. pg_net 请求尚未完成（等待时间不够）');
  console.log('2. Edge Function 调用失败（检查 Supabase Functions 日志）');
  console.log('3. JWT 认证失败（需要验证 service_role_key）');
  console.log('4. 触发器未正确触发（检查 pg_net_recent_responses 视图）');

  if (updatedVideo.thumbnail_metadata) {
    console.log('\n📊 元数据:', updatedVideo.thumbnail_metadata);
  }
}

console.log('\n' + '='.repeat(60));
console.log('🔍 调试提示:');
console.log('1. 查看 pg_net 响应: SELECT * FROM pg_net_recent_responses LIMIT 5;');
console.log('2. 查看 Edge Function 日志: npx supabase functions logs auto-generate-thumbnail');
console.log('3. 手动触发: SELECT manually_trigger_thumbnail_generation(\'' + testVideo.id + '\');');
console.log('='.repeat(60));
