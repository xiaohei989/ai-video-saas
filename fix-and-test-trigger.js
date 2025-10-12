/**
 * 修复 service_role_key 并测试触发器
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔧 修复 service_role_key 配置\n');

// 步骤 1: 检查当前配置
console.log('📊 步骤 1: 检查当前配置...');
const { data: currentConfig, error: checkError } = await supabase
  .from('system_config')
  .select('key, value, description')
  .in('key', ['supabase_url', 'service_role_key', 'project_ref']);

if (checkError) {
  console.error('❌ 检查失败:', checkError);
} else {
  console.log('✅ 当前配置:');
  currentConfig.forEach(c => {
    const preview = c.key === 'service_role_key' ? c.value.substring(0, 30) + '...' : c.value;
    console.log(`   ${c.key}: ${preview}`);
  });
}

// 步骤 2: 更新 service_role_key
console.log('\n🔄 步骤 2: 更新 service_role_key...');
const correctKey = supabaseServiceKey;
const { error: updateError } = await supabase
  .from('system_config')
  .update({ value: correctKey })
  .eq('key', 'service_role_key');

if (updateError) {
  console.error('❌ 更新失败:', updateError);
} else {
  console.log('✅ service_role_key 已更新');
  console.log(`   长度: ${correctKey.length} 字符`);
  console.log(`   预览: ${correctKey.substring(0, 30)}...`);
}

// 步骤 3: 测试手动触发
console.log('\n🚀 步骤 3: 测试手动触发缩略图生成...');
const testVideoId = '2efa121a-735b-431b-8432-40c903014a33';

const { data: triggerResult, error: triggerError } = await supabase.rpc(
  'manually_trigger_thumbnail_generation',
  { p_video_id: testVideoId }
);

if (triggerError) {
  console.error('❌ 触发失败:', triggerError);
} else {
  console.log('✅ 触发结果:', triggerResult);
}

// 步骤 4: 等待并检查 pg_net 响应
console.log('\n⏳ 等待 10 秒让 pg_net 处理...');
await new Promise(resolve => setTimeout(resolve, 10000));

console.log('\n📊 步骤 4: 查看 pg_net HTTP 响应...');

// 尝试查询 pg_net 响应（通过视图）
let responses = null;
let responseError = null;

try {
  const result = await supabase
    .from('pg_net_recent_responses')
    .select('*')
    .order('created', { ascending: false })
    .limit(5);

  responses = result.data;
  responseError = result.error;
} catch (err) {
  responseError = { message: '视图查询失败' };
}

if (responseError || !responses) {
  console.log('⚠️  无法直接查询 net._http_response');
  console.log('💡 请在 Supabase SQL Editor 执行以下查询：\n');
  console.log('SELECT id, status_code, error_msg, created, LEFT(content::text, 500)');
  console.log('FROM net._http_response');
  console.log('WHERE created > NOW() - INTERVAL \'10 minutes\'');
  console.log('ORDER BY created DESC LIMIT 5;\n');
} else {
  console.log('✅ 最近的 pg_net 响应:');
  responses.forEach((r, idx) => {
    console.log(`\n${idx + 1}. [${r.status_summary || '未知'}]`);
    console.log(`   响应 ID: ${r.id}`);
    console.log(`   状态码: ${r.status_code || '未知'}`);
    console.log(`   错误: ${r.error_msg || '无'}`);
    console.log(`   超时: ${r.timed_out ? '是' : '否'}`);
    console.log(`   时间: ${r.created}`);
    if (r.content_preview) {
      console.log(`   响应: ${r.content_preview}`);
    }
  });
}

// 步骤 5: 检查视频缩略图是否已生成
console.log('\n📸 步骤 5: 检查视频缩略图状态...');
const { data: video, error: videoError } = await supabase
  .from('videos')
  .select('id, title, thumbnail_url, thumbnail_generated_at')
  .eq('id', testVideoId)
  .single();

if (videoError) {
  console.error('❌ 查询失败:', videoError);
} else {
  if (video.thumbnail_url && !video.thumbnail_url.startsWith('data:image/svg')) {
    console.log('✅ 缩略图已生成！');
    console.log(`🖼️  ${video.thumbnail_url}`);
    console.log(`⏰ 生成时间: ${video.thumbnail_generated_at}`);
  } else {
    console.log('⚠️  缩略图尚未生成');
    console.log('   可能原因：Edge Function 执行失败或 pg_net 请求未到达');
  }
}

console.log('\n' + '='.repeat(60));
console.log('🎯 调试总结：');
console.log('1. 如果 pg_net 响应状态码是 401 → JWT 配置问题');
console.log('2. 如果 pg_net 响应状态码是 200 → 功能正常！');
console.log('3. 如果没有响应记录 → pg_net 可能未启用或网络问题');
console.log('='.repeat(60));
