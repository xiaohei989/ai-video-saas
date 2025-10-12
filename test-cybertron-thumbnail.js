import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const videoId = 'a39d210b-2abf-4f2e-ad34-4a3897672af5';
const videoUrl = 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/6e9f9e47-814f-4129-a99a-2bd477c3972a_normal.mp4';

console.log('🔄 直接调用 Edge Function 生成赛博坦视频缩略图\n');
console.log(`视频ID: ${videoId}`);
console.log(`视频URL: ${videoUrl}\n`);

// 直接调用 Edge Function
const { data, error } = await supabase.functions.invoke('auto-generate-thumbnail', {
  body: {
    videoId,
    videoUrl
  }
});

if (error) {
  console.error('❌ Edge Function 调用失败:', error);
  process.exit(1);
}

console.log('✅ Edge Function 响应:');
console.log(JSON.stringify(data, null, 2));

// 检查数据库
console.log('\n🔍 检查数据库状态...\n');

await new Promise(r => setTimeout(r, 2000));

const { data: video } = await supabase
  .from('videos')
  .select('thumbnail_url, thumbnail_generated_at, thumbnail_metadata')
  .eq('id', videoId)
  .single();

if (video?.thumbnail_url && !video.thumbnail_url.startsWith('data:image/svg')) {
  console.log('✅ 缩略图生成成功！');
  console.log(`URL: ${video.thumbnail_url}`);
  console.log(`生成时间: ${video.thumbnail_generated_at}`);
  if (video.thumbnail_metadata) {
    console.log('元数据:', JSON.stringify(video.thumbnail_metadata, null, 2));
  }
} else {
  console.log('❌ 缩略图未生成');
  console.log(`当前 URL: ${video?.thumbnail_url || '(null)'}`);
}
