import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 测试自动迁移触发器\n');

// 测试方案1：创建一个测试视频记录（模拟 OSS 视频）
console.log('方案 1: 创建测试视频（模拟 OSS 视频）\n');

const testVideoUrl = 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/test-video.mp4';

// 0. 获取一个真实的 template_id
console.log('0. 获取真实的 template_id...');
const { data: templates } = await supabase
  .from('templates')
  .select('id')
  .limit(1)
  .single();

const templateId = templates?.id;
console.log(`✅ 使用 template_id: ${templateId}\n`);

// 1. 创建测试视频
console.log('1. 创建测试视频记录...');
const { data: newVideo, error: createError } = await supabase
  .from('videos')
  .insert({
    title: '【测试】自动迁移触发器测试视频',
    description: '这是一个测试视频，用于验证自动迁移到 R2 的功能',
    status: 'processing',
    video_url: testVideoUrl,
    user_id: 'fa38674f-1e5b-4132-9fb7-192940e52a32', // admin用户
    template_id: templateId,
    migration_status: null,
    r2_url: null
  })
  .select()
  .single();

if (createError) {
  console.error('❌ 创建测试视频失败:', createError);
  process.exit(1);
}

console.log(`✅ 测试视频已创建: ${newVideo.id}`);
console.log(`   video_url: ${newVideo.video_url}`);
console.log(`   migration_status: ${newVideo.migration_status}\n`);

// 2. 等待 2 秒
console.log('2. 等待 2 秒...\n');
await new Promise(r => setTimeout(r, 2000));

// 3. 更新状态为 completed（触发迁移）
console.log('3. 更新状态为 completed，触发自动迁移...');
const triggerTime = new Date();
const { error: updateError } = await supabase
  .from('videos')
  .update({ status: 'completed' })
  .eq('id', newVideo.id);

if (updateError) {
  console.error('❌ 更新状态失败:', updateError);
  process.exit(1);
}

console.log('✅ 状态已更新为 completed\n');

// 4. 等待 5 秒检查迁移状态
console.log('4. 等待 5 秒后检查迁移状态...\n');
await new Promise(r => setTimeout(r, 5000));

// 5. 查看视频记录
const { data: updatedVideo } = await supabase
  .from('videos')
  .select('id, title, status, video_url, r2_url, migration_status')
  .eq('id', newVideo.id)
  .single();

console.log('📹 视频最新状态:');
console.log(`   ID: ${updatedVideo.id}`);
console.log(`   status: ${updatedVideo.status}`);
console.log(`   migration_status: ${updatedVideo.migration_status}`);
console.log(`   video_url: ${updatedVideo.video_url}`);
console.log(`   r2_url: ${updatedVideo.r2_url || '(未设置)'}\n`);

// 6. 检查 pg_net 响应
console.log('5. 查看 pg_net 响应记录...\n');
const { data: responses } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .gte('created', triggerTime.toISOString())
  .order('created', { ascending: false })
  .limit(3);

if (responses && responses.length > 0) {
  responses.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.status_summary}] HTTP ${r.status_code || 'N/A'}`);
    console.log(`   响应 ID: ${r.id}`);
    console.log(`   时间: ${r.created}`);
    if (r.error_msg) {
      console.log(`   错误: ${r.error_msg}`);
    }
    if (r.content_preview) {
      console.log(`   内容: ${r.content_preview}`);
    }
    console.log('');
  });
} else {
  console.log('⚠️  未找到相关的 pg_net 响应');
}

// 7. 判断结果
console.log('\n========== 测试结果 ==========');
if (updatedVideo.migration_status === 'pending') {
  console.log('✅ 触发器已触发！migration_status 已设置为 pending');
  console.log('⏳ 迁移正在后台执行中，等待 Edge Function 完成...');
  console.log('\n💡 提示：');
  console.log('- 迁移 Edge Function 需要 1-3 分钟完成（下载+上传）');
  console.log('- 可以稍后查询视频记录查看 r2_url 是否已生成');
  console.log('- 也可以查看 pg_net_recent_responses 查看迁移结果');
} else if (updatedVideo.migration_status === 'completed' && updatedVideo.r2_url) {
  console.log('🎉 迁移已完成！');
  console.log(`R2 URL: ${updatedVideo.r2_url}`);
} else if (updatedVideo.migration_status === 'failed') {
  console.log('❌ 迁移失败');
  console.log('请查看上面的 pg_net 响应了解失败原因');
} else {
  console.log('⚠️  migration_status 仍为空，触发器可能未正常工作');
  console.log('请检查:');
  console.log('1. system_config 表是否有 supabase_url 和 service_role_key');
  console.log('2. 触发器是否正确创建');
  console.log('3. 数据库日志');
}

console.log('\n========== 清理测试数据 ==========');
console.log('是否要删除测试视频？(需要手动执行)');
console.log(`DELETE FROM videos WHERE id = '${newVideo.id}';`);
