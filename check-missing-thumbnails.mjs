import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔍 正在查询缺少缩略图的视频...\n');

const { data: videos, error } = await supabase
  .from('videos')
  .select('id, title, status, video_url, thumbnail_url, thumbnail_generated_at, processing_completed_at, created_at')
  .eq('status', 'completed')
  .not('video_url', 'is', null)
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

// 筛选出没有缩略图或只有SVG占位符的视频
const missingThumbnails = videos.filter(v =>
  !v.thumbnail_url || v.thumbnail_url.startsWith('data:image/svg+xml')
);

console.log(`📊 总共查询到 ${videos.length} 个已完成的视频`);
console.log(`⚠️  其中 ${missingThumbnails.length} 个缺少真实缩略图\n`);

if (missingThumbnails.length === 0) {
  console.log('✅ 所有视频都有缩略图！');
  process.exit(0);
}

console.log('📋 缺少缩略图的视频列表：\n');
missingThumbnails.forEach((v, idx) => {
  console.log(`${idx + 1}. ID: ${v.id}`);
  console.log(`   标题: ${v.title || '无标题'}`);
  console.log(`   视频URL: ${v.video_url ? '✅ 有' : '❌ 无'}`);
  console.log(`   缩略图: ${v.thumbnail_url ? (v.thumbnail_url.startsWith('data:image/svg+xml') ? '⚠️  仅SVG占位符' : '✅ 有') : '❌ 无'}`);
  console.log(`   完成时间: ${v.processing_completed_at || '未知'}`);
  console.log('');
});

console.log('\n💡 可以使用以下命令手动触发缩略图生成：');
console.log(`node trigger-thumbnails.mjs`);

process.exit(0);
