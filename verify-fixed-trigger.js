/**
 * 验证修复后的触发器并测试完整流程
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const videoId = '0271fac7-e515-4d4a-b45e-447e8416cf26';
const videoTitle = 'Ocean Selfie Surprise Highlights';

console.log('🔍 验证修复后的触发器\n');

// 步骤 1: 测试 pg_net 连接
console.log('📊 步骤 1: 测试 pg_net 连接功能...');
try {
  const { data: testResult, error: testError } = await supabase.rpc('test_pgnet_connection');

  if (testError) {
    console.log('❌ test_pgnet_connection 函数不存在或失败:', testError.message);
    console.log('   请确认 SQL 已在 SQL Editor 中成功执行\n');
    process.exit(1);
  } else {
    console.log('✅ pg_net 测试函数可用');
    console.log('   Response ID:', testResult.response_id);
    console.log('   消息:', testResult.message);
  }
} catch (err) {
  console.log('❌ 测试异常:', err.message);
  process.exit(1);
}

// 等待 3 秒让 pg_net 处理
console.log('\n⏳ 等待 3 秒让 pg_net 处理测试请求...');
await new Promise(resolve => setTimeout(resolve, 3000));

// 步骤 2: 查看 pg_net 响应
console.log('\n📊 步骤 2: 查看 pg_net 响应视图...');
const { data: responses, error: viewError } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .limit(5);

if (viewError) {
  console.log('❌ pg_net_recent_responses 视图不可用:', viewError.message);
  console.log('   请确认 SQL 已在 SQL Editor 中成功执行\n');
  process.exit(1);
} else {
  console.log(`✅ pg_net 响应视图可用，找到 ${responses.length} 条最近记录`);
  if (responses.length > 0) {
    const latest = responses[0];
    console.log(`   最新响应: [${latest.status_summary}] HTTP ${latest.status_code || 'N/A'}`);
  }
}

// 步骤 3: 重置测试视频状态
console.log('\n📊 步骤 3: 重置测试视频状态（模拟视频刚完成）...');
console.log(`   视频: ${videoTitle}`);
console.log(`   ID: ${videoId}\n`);

// 先改为 processing
const { error: resetError } = await supabase
  .from('videos')
  .update({
    status: 'processing',
    thumbnail_url: null,
    thumbnail_blur_url: null,
    thumbnail_generated_at: null,
    thumbnail_metadata: {}
  })
  .eq('id', videoId);

if (resetError) {
  console.error('❌ 重置失败:', resetError.message);
  process.exit(1);
}

console.log('   ✓ 状态已重置为 processing');

// 等待 1 秒
await new Promise(resolve => setTimeout(resolve, 1000));

// 然后改为 completed，这会触发修复后的触发器
const { error: triggerError } = await supabase
  .from('videos')
  .update({ status: 'completed' })
  .eq('id', videoId);

if (triggerError) {
  console.error('❌ 触发失败:', triggerError.message);
  process.exit(1);
}

console.log('   ✓ 状态已更新为 completed，触发器应该已触发\n');

// 步骤 4: 检查元数据
console.log('📊 步骤 4: 立即检查视频元数据...');
const { data: videoCheck, error: checkError } = await supabase
  .from('videos')
  .select('thumbnail_metadata')
  .eq('id', videoId)
  .single();

if (checkError) {
  console.error('❌ 查询失败:', checkError.message);
} else {
  if (videoCheck.thumbnail_metadata && Object.keys(videoCheck.thumbnail_metadata).length > 0) {
    console.log('✅ 视频元数据已设置（说明触发器执行了）:');
    console.log(JSON.stringify(videoCheck.thumbnail_metadata, null, 2));
  } else {
    console.log('⚠️  视频元数据仍为空');
    console.log('   触发器可能未执行或执行失败');
  }
}

// 步骤 5: 等待 Edge Function 处理
console.log('\n⏳ 步骤 5: 等待 15 秒让 Edge Function 生成缩略图...');
for (let i = 15; i > 0; i--) {
  process.stdout.write(`\r   ${i} 秒...`);
  await new Promise(resolve => setTimeout(resolve, 1000));
}
console.log('\n');

// 步骤 6: 检查缩略图是否生成
console.log('📸 步骤 6: 检查缩略图生成结果...');
const { data: finalVideo, error: finalError } = await supabase
  .from('videos')
  .select('id, thumbnail_url, thumbnail_blur_url, thumbnail_generated_at, thumbnail_metadata')
  .eq('id', videoId)
  .single();

if (finalError) {
  console.error('❌ 查询失败:', finalError.message);
  process.exit(1);
}

const hasThumbnail = finalVideo.thumbnail_url && !finalVideo.thumbnail_url.startsWith('data:image/svg');

if (hasThumbnail) {
  console.log('✅ 缩略图已自动生成！');
  console.log('🎉 后端自动触发功能修复成功！\n');
  console.log('   高清缩略图:', finalVideo.thumbnail_url);
  if (finalVideo.thumbnail_blur_url) {
    console.log('   模糊缩略图:', finalVideo.thumbnail_blur_url);
  }
  console.log('   生成时间:', finalVideo.thumbnail_generated_at);
  console.log('   元数据:', JSON.stringify(finalVideo.thumbnail_metadata, null, 2));
} else {
  console.log('⚠️  缩略图尚未生成');
  console.log('   当前 URL:', finalVideo.thumbnail_url || '(null)');
  console.log('   元数据:', JSON.stringify(finalVideo.thumbnail_metadata, null, 2) || '(null)');
  console.log('\n💡 可能的原因:');
  console.log('1. Edge Function 执行时间超过 15 秒');
  console.log('2. 请查看 pg_net_recent_responses 视图检查 HTTP 响应');
  console.log('3. 请在 Supabase Dashboard 查看 Edge Function 日志');
}

// 步骤 7: 查看最新的 pg_net 响应
console.log('\n📊 步骤 7: 查看最新的 pg_net HTTP 响应...');
const { data: latestResponses } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .limit(3);

if (latestResponses && latestResponses.length > 0) {
  console.log(`✅ 最新 ${latestResponses.length} 条响应:\n`);
  latestResponses.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.status_summary}] HTTP ${r.status_code || 'N/A'}`);
    console.log(`   响应 ID: ${r.id}`);
    console.log(`   错误: ${r.error_msg || '无'}`);
    console.log(`   时间: ${r.created}`);
    if (r.content_preview) {
      console.log(`   内容预览: ${r.content_preview}`);
    }
    console.log('');
  });
} else {
  console.log('⚠️  没有找到最近的 pg_net 响应');
}

console.log('='.repeat(60));
console.log('🎯 验证完成！');
console.log('='.repeat(60));
