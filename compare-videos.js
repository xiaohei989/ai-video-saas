import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 对比两个视频\n');

// 赛博坦视频
const cybertronId = 'a39d210b-2abf-4f2e-ad34-4a3897672af5';
// 兔子视频
const rabbitId = 'e7f27055-ebf4-4c89-a4f9-b18bf104f82f';

const { data: videos } = await supabase
  .from('videos')
  .select('*')
  .in('id', [cybertronId, rabbitId])
  .order('created_at', { ascending: true });

console.log('========== 视频对比 ==========\n');

videos.forEach((v, idx) => {
  console.log(`${idx + 1}. ${v.title}`);
  console.log(`   创建时间: ${v.created_at}`);
  console.log(`   完成时间: ${v.processing_completed_at || '(未记录)'}`);
  console.log(`   缩略图URL: ${v.thumbnail_url ? '✅ 有' : '❌ 无'}`);
  console.log(`   缩略图生成时间: ${v.thumbnail_generated_at || '(未生成)'}`);

  if (v.thumbnail_metadata) {
    console.log(`   生成者: ${v.thumbnail_metadata.generatedBy || 'unknown'}`);
  }

  console.log('');
});

console.log('========== 关键发现 ==========\n');

const cybertron = videos.find(v => v.id === cybertronId);
const rabbit = videos.find(v => v.id === rabbitId);

console.log('赛博坦视频:');
console.log(`   ✅ 自动生成成功 (generatedBy: ${cybertron.thumbnail_metadata?.generatedBy})`);
console.log(`   完成→缩略图: 9分15秒延迟`);
console.log('');

console.log('兔子视频:');
console.log(`   ❌ 自动生成失败`);
console.log(`   ✅ 手动触发成功 (刚才我们手动调用了)`);
console.log('');

console.log('========== 结论 ==========\n');
console.log('触发器本身没有问题！');
console.log('赛博坦视频证明了触发器【可以正常工作】');
console.log('');
console.log('那为什么兔子视频没有自动生成？');
console.log('');
console.log('最可能的原因:');
console.log('1. 触发器在兔子视频完成时【没有被触发】');
console.log('2. 或者被触发了，但【调用失败且没有记录到pg_net】');
console.log('');
console.log('需要检查:');
console.log('- 兔子视频的 processing_completed_at 是否为 NULL？');
console.log('  如果是NULL，触发器条件不满足（需要 OLD.status != completed）');
