import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

const userId = '8242424d-957c-4755-af2f-5e809cfa23f7'

console.log('🔍 检查用户限制状态...')
console.log('用户ID:', userId)
console.log('邮箱: ccmd2ghwj7@privaterelay.appleid.com')
console.log()

// 检查当前积分
const { data: profile } = await supabase
  .from('profiles')
  .select('credits, total_credits_earned, total_credits_spent')
  .eq('id', userId)
  .single()

console.log('💰 积分状态:')
console.log('  当前积分:', profile?.credits || 0)
console.log('  累计获得:', profile?.total_credits_earned || 0)
console.log('  累计消费:', profile?.total_credits_spent || 0)
console.log()

// 检查订阅状态
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('user_id', userId)
  .eq('status', 'active')
  .maybeSingle()

console.log('📋 订阅状态:')
if (subscription) {
  console.log('  等级:', subscription.tier)
  console.log('  状态:', subscription.status)
  console.log('  周期结束:', subscription.current_period_end)
} else {
  console.log('  等级: free (免费用户)')
}
console.log()

// 检查处理中的视频
const { data: processingVideos } = await supabase
  .from('videos')
  .select('*')
  .eq('user_id', userId)
  .eq('status', 'processing')

console.log('🎬 处理中的视频:', processingVideos?.length || 0)
if (processingVideos && processingVideos.length > 0) {
  processingVideos.forEach(video => {
    console.log('  -', video.id, ':', video.title)
    console.log('    开始时间:', video.processing_started_at)
  })
}
console.log()

console.log('🚀 分析结果:')
console.log('积分余额:', profile?.credits === 0 ? '❌ 积分已用完' : '✅ 有积分')
console.log('并发任务:', processingVideos?.length === 0 ? '✅ 无并发任务' : '❌ 有并发任务')
console.log('订阅状态:', subscription ? '✅ 有订阅' : '⚠️ 免费用户')

// 分析问题原因
console.log()
console.log('🔍 问题分析:')
if (profile?.credits === 0) {
  console.log('❌ 主要问题：积分余额为0')
  console.log('   - 用户已消费完所有积分（累计消费160积分）')
  console.log('   - 需要购买订阅或充值积分才能继续生成视频')
}

if (!subscription) {
  console.log('⚠️ 次要问题：用户为免费用户')
  console.log('   - 免费用户只能同时处理1个视频')
  console.log('   - 建议升级订阅以获得更多并发和积分')
}