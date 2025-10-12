/**
 * 测试 pg_net 功能
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🧪 测试 pg_net 功能\n');

// 测试 1: 测试 pg_net 基础连接
console.log('📡 步骤 1: 测试 pg_net 基础连接...');
const { data: testResult, error: testError } = await supabase.rpc('test_pgnet_connection');

if (testError) {
  console.error('❌ 测试失败:', testError);
} else {
  console.log('✅ 测试结果:', testResult);
}

// 等待 5 秒让 pg_net 处理请求
console.log('\n⏳ 等待 5 秒...\n');
await new Promise(resolve => setTimeout(resolve, 5000));

// 测试 2: 查看 pg_net 响应
console.log('📊 步骤 2: 查看 pg_net 响应...');
const { data: responses, error: responseError } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .limit(10);

if (responseError) {
  console.error('❌ 查询失败:', responseError);
} else {
  console.log(`✅ 找到 ${responses.length} 条响应:\n`);
  responses.forEach((r, idx) => {
    console.log(`${idx + 1}. 状态: ${r.status_summary}`);
    console.log(`   HTTP: ${r.status_code || 'N/A'}`);
    console.log(`   错误: ${r.error_msg || '无'}`);
    console.log(`   超时: ${r.timed_out ? '是' : '否'}`);
    console.log(`   时间: ${r.created}`);
    if (r.content_preview) {
      console.log(`   内容: ${r.content_preview}`);
    }
    console.log('');
  });
}

// 测试 3: 手动触发缩略图生成
console.log('🚀 步骤 3: 手动触发缩略图生成...');
const videoId = '2efa121a-735b-431b-8432-40c903014a33';
const { data: triggerResult, error: triggerError } = await supabase.rpc(
  'manually_trigger_thumbnail_generation',
  { p_video_id: videoId }
);

if (triggerError) {
  console.error('❌ 触发失败:', triggerError);
} else {
  console.log('✅ 触发结果:', triggerResult);
}

// 等待 5 秒
console.log('\n⏳ 等待 5 秒...\n');
await new Promise(resolve => setTimeout(resolve, 5000));

// 测试 4: 再次查看响应
console.log('📊 步骤 4: 查看最新的 pg_net 响应...');
const { data: responses2, error: responseError2 } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .limit(5);

if (responseError2) {
  console.error('❌ 查询失败:', responseError2);
} else {
  console.log(`✅ 最新 ${responses2.length} 条响应:\n`);
  responses2.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.status_summary}] HTTP ${r.status_code || 'N/A'} - ${r.error_msg || '正常'}`);
    console.log(`   时间: ${r.created}`);
    console.log('');
  });
}

console.log('\n🎯 总结:');
console.log('如果看到 HTTP 200 状态码，说明 pg_net 工作正常');
console.log('如果看到超时或错误，需要检查网络配置或 Supabase 设置');
