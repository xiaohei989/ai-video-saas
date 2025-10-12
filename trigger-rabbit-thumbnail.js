import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const videoId = 'e7f27055-ebf4-4c89-a4f9-b18bf104f82f';

console.log('🎬 手动触发兔子视频缩略图生成\n');

// 1. 检查视频当前状态
console.log('1. 检查视频状态...');
const { data: video, error: fetchError } = await supabase
  .from('videos')
  .select('*')
  .eq('id', videoId)
  .single();

if (fetchError) {
  console.error('❌ 查询失败:', fetchError);
  process.exit(1);
}

console.log(`   视频URL: ${video.video_url}`);
console.log(`   缩略图URL: ${video.thumbnail_url || '(未设置)'}`);
console.log(`   状态: ${video.status}\n`);

// 2. 手动调用缩略图生成Edge Function
console.log('2. 调用auto-generate-thumbnail Edge Function...');

const { data: result, error: funcError } = await supabase.functions.invoke('auto-generate-thumbnail', {
  body: {
    videoId,
    videoUrl: video.video_url
  }
});

if (funcError) {
  console.error('❌ 调用失败:', funcError);
  process.exit(1);
}

console.log('✅ Edge Function响应:', result);
console.log('');

// 3. 等待2秒后查看结果
console.log('3. 等待2秒后查看结果...\n');
await new Promise(r => setTimeout(r, 2000));

// 4. 查询最新状态
const { data: updatedVideo } = await supabase
  .from('videos')
  .select('thumbnail_url, thumbnail_generated_at, thumbnail_metadata')
  .eq('id', videoId)
  .single();

console.log('📸 缩略图生成结果:');
console.log(`   thumbnail_url: ${updatedVideo.thumbnail_url || '(未设置)'}`);
console.log(`   thumbnail_generated_at: ${updatedVideo.thumbnail_generated_at || '(未设置)'}`);
if (updatedVideo.thumbnail_metadata) {
  console.log(`   元数据: ${JSON.stringify(updatedVideo.thumbnail_metadata)}`);
}
console.log('');

if (updatedVideo.thumbnail_url) {
  console.log('✅ 缩略图生成成功！');
  console.log(`🔗 ${updatedVideo.thumbnail_url}`);
} else {
  console.log('❌ 缩略图仍未生成');
  console.log('可能需要更长时间等待Cloudflare处理视频');
}
