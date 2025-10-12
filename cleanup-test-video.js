import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧹 清理测试视频\n');

// 删除测试视频
const { error } = await supabase
  .from('videos')
  .delete()
  .like('title', '%【测试】%');

if (error) {
  console.error('❌ 删除失败:', error);
} else {
  console.log('✅ 测试视频已删除');
}
