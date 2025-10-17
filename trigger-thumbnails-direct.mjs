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

// 查询缺少缩略图的视频
const { data: videos, error } = await supabase
  .from('videos')
  .select('id, title, video_url')
  .eq('status', 'completed')
  .not('video_url', 'is', null)
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('❌ 查询失败:', error);
  process.exit(1);
}

const missingThumbnails = videos.filter(v =>
  !v.thumbnail_url || v.thumbnail_url.startsWith('data:image/svg+xml')
);

if (missingThumbnails.length === 0) {
  console.log('✅ 没有需要生成缩略图的视频！');
  process.exit(0);
}

console.log(`找到 ${missingThumbnails.length} 个需要生成缩略图的视频\n`);

let successCount = 0;
let failedCount = 0;

// 逐个调用Edge Function生成缩略图
for (const video of missingThumbnails) {
  console.log(`🎬 处理: ${video.title || video.id}`);

  try {
    const { data, error } = await supabase.functions.invoke('auto-generate-thumbnail', {
      body: {
        videoId: video.id,
        videoUrl: video.video_url
      }
    });

    if (error) {
      console.log(`   ❌ 失败: ${error.message}`);
      failedCount++;
    } else if (!data?.success) {
      console.log(`   ❌ 失败: ${data?.error || '未知错误'}`);
      failedCount++;
    } else {
      console.log(`   ✅ 成功触发`);
      successCount++;
    }
  } catch (e) {
    console.log(`   ❌ 异常: ${e.message}`);
    failedCount++;
  }

  // 短暂延迟避免过载
  await new Promise(resolve => setTimeout(resolve, 500));
}

console.log('\n' + '='.repeat(50));
console.log(`\n📊 执行结果:`);
console.log(`  ✅ 成功: ${successCount} 个`);
console.log(`  ❌ 失败: ${failedCount} 个`);
console.log(`\n⏰ 请等待1-2分钟，缩略图生成需要一些时间`);
console.log('   可以刷新页面查看进度\n');

process.exit(0);
