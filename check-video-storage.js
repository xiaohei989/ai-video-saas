import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 检查最近视频的存储位置\n');

const { data: videos } = await supabase
  .from('videos')
  .select('id, title, video_url, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('最近 10 个视频的存储位置：\n');

const stats = {
  r2: 0,
  oss: 0,
  other: 0
};

videos?.forEach((v, idx) => {
  let storage = '未知';

  if (v.video_url?.includes('cdn.veo3video.me') || v.video_url?.includes('r2.cloudflarestorage.com')) {
    storage = '✅ R2 (Cloudflare)';
    stats.r2++;
  } else if (v.video_url?.includes('oss-ap-southeast') || v.video_url?.includes('aliyuncs.com')) {
    storage = '❌ OSS (阿里云)';
    stats.oss++;
  } else if (v.video_url) {
    storage = '❓ 其他';
    stats.other++;
  }

  console.log(`${idx + 1}. ${v.title}`);
  console.log(`   存储: ${storage}`);
  console.log(`   URL: ${v.video_url?.substring(0, 60)}...`);
  console.log(`   时间: ${v.created_at}`);
  console.log('');
});

console.log('统计：');
console.log(`  R2 (Cloudflare): ${stats.r2}`);
console.log(`  OSS (阿里云): ${stats.oss}`);
console.log(`  其他: ${stats.other}`);
