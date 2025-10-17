import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🚀 正在触发缩略图生成...\n');

// 调用数据库的自动重试函数
const { data, error } = await supabase.rpc('auto_retry_stuck_thumbnails');

if (error) {
  console.error('❌ 调用失败:', error);
  process.exit(1);
}

console.log('✅ 自动重试执行结果:');
console.log(JSON.stringify(data, null, 2));

if (data.success) {
  console.log(`\n✨ 成功触发 ${data.retriedCount} 个视频的缩略图生成`);
  console.log(`⏭️  跳过 ${data.skippedCount} 个视频（已达到最大重试次数）`);
  console.log(`\n⏰ 请等待1-2分钟，然后刷新页面查看结果`);
} else {
  console.log(`\n❌ 执行失败: ${data.error}`);
}

console.log('\n💡 可以运行以下命令查看健康状态:');
console.log('node check-thumbnail-health.mjs');

process.exit(0);
