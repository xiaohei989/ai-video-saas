import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 查询失败的请求详情\n');

// 查询 ID 33 的详细信息
const { data: failedRequest } = await supabase
  .from('pg_net_recent_responses')
  .select('*')
  .eq('id', 33)
  .single();

if (failedRequest) {
  console.log('❌ 失败请求详情 (ID: 33):');
  console.log('   URL:', failedRequest.url || '(未记录)');
  console.log('   方法:', failedRequest.method || '(未记录)');
  console.log('   状态:', failedRequest.status_summary);
  console.log('   HTTP 状态码:', failedRequest.status_code || 'N/A');
  console.log('   时间:', failedRequest.created);
  console.log('   错误消息:', failedRequest.error_msg || '(无)');

  if (failedRequest.headers) {
    console.log('   请求头:', JSON.stringify(failedRequest.headers, null, 2));
  }

  if (failedRequest.body) {
    console.log('   请求体:', failedRequest.body);
  }

  console.log('');
  console.log('========== 分析 ==========');

  if (failedRequest.status_code === 504) {
    console.log('❌ 504 Gateway Timeout - Edge Function 执行超时');
    console.log('');
    console.log('可能原因:');
    console.log('1. Cloudflare 还在处理新上传的视频');
    console.log('2. 视频文件太大,帧提取耗时过长');
    console.log('3. 网络延迟导致超时');
    console.log('');
    console.log('解决方案:');
    console.log('1. 触发器已配置 180 秒超时,但 Edge Function 本身可能有更短的超时');
    console.log('2. 需要手动重试生成缩略图');
    console.log('3. 检查 Edge Function 日志: npx supabase functions logs auto-generate-thumbnail');
  } else {
    console.log('错误类型:', failedRequest.status_summary);
  }
} else {
  console.log('❌ 未找到 ID 33 的请求记录');
}

// 查询视频当前状态
console.log('\n📹 当前视频状态:');
const { data: video } = await supabase
  .from('videos')
  .select('id, title, thumbnail_url, migration_status')
  .eq('id', 'e8bfccd7-49b1-4b8c-a90a-fcfee914cb63')
  .single();

if (video) {
  const hasThumbnail = video.thumbnail_url && !video.thumbnail_url.includes('data:image/svg');
  console.log('   缩略图状态:', hasThumbnail ? '✅ 有' : '❌ 无');
  console.log('   迁移状态:', video.migration_status);

  if (!hasThumbnail) {
    console.log('');
    console.log('💡 建议: 手动调用 Edge Function 重新生成缩略图');
  }
}
