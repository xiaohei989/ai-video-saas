import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const email = 'manghe989@gmail.com'
const userId = 'fa38674f-1e5b-4132-9fb7-192940e52a32'

console.log('🔍 查询第二个被限流用户的详细信息...')
console.log('邮箱:', email)
console.log('用户ID:', userId)
console.log()

// 查询用户基本信息
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single()

if (!profile) {
  console.log('❌ 未找到该用户')
  process.exit(1)
}

console.log('👤 用户基本信息:')
console.log('  用户ID:', profile.id)
console.log('  邮箱:', profile.email)
console.log('  用户名:', profile.username || 'N/A')
console.log('  创建时间:', new Date(profile.created_at).toLocaleString('zh-CN'))
console.log('  最后登录:', profile.last_sign_in_at ? new Date(profile.last_sign_in_at).toLocaleString('zh-CN') : 'N/A')
console.log()

console.log('💰 积分状态:')
console.log('  当前积分:', profile.credits || 0)
console.log('  累计获得:', profile.total_credits_earned || 0)
console.log('  累计消费:', profile.total_credits_spent || 0)
console.log()

// 检查订阅状态
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('user_id', profile.id)
  .eq('status', 'active')
  .maybeSingle()

console.log('📋 订阅状态:')
if (subscription) {
  console.log('  等级:', subscription.tier)
  console.log('  状态:', subscription.status)
  console.log('  开始时间:', new Date(subscription.current_period_start).toLocaleString('zh-CN'))
  console.log('  结束时间:', new Date(subscription.current_period_end).toLocaleString('zh-CN'))
} else {
  console.log('  等级: free (免费用户)')
}
console.log()

// 检查视频生成历史
const { data: allVideos } = await supabase
  .from('videos')
  .select('id, title, status, created_at, processing_started_at, processing_completed_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(20)

console.log('📹 视频生成历史 (最近20个):')
if (allVideos && allVideos.length > 0) {
  allVideos.forEach((video, index) => {
    console.log(`  ${index + 1}. [${video.status}] ${video.title}`)
    console.log(`     创建: ${new Date(video.created_at).toLocaleString('zh-CN')}`)
    if (video.processing_completed_at) {
      console.log(`     完成: ${new Date(video.processing_completed_at).toLocaleString('zh-CN')}`)
    }
    console.log()
  })
} else {
  console.log('  无视频记录')
}

// 检查今日视频生成统计
const today = new Date()
today.setHours(0, 0, 0, 0)
const { data: todayVideos } = await supabase
  .from('videos')
  .select('id, status, created_at')
  .eq('user_id', userId)
  .gte('created_at', today.toISOString())

console.log('📊 今日统计:')
console.log('  今日生成视频:', todayVideos?.length || 0)
if (todayVideos) {
  const completed = todayVideos.filter(v => v.status === 'completed').length
  const processing = todayVideos.filter(v => v.status === 'processing').length
  const failed = todayVideos.filter(v => v.status === 'failed').length
  
  console.log('  - 已完成:', completed)
  console.log('  - 处理中:', processing)
  console.log('  - 失败:', failed)
}
console.log()

// 检查最近1小时的视频生成
const oneHourAgo = new Date(Date.now() - 3600000)
const { data: recentVideos } = await supabase
  .from('videos')
  .select('id, status, created_at')
  .eq('user_id', userId)
  .gte('created_at', oneHourAgo.toISOString())

console.log('⏰ 最近1小时统计:')
console.log('  最近1小时生成视频:', recentVideos?.length || 0)
if (recentVideos && recentVideos.length > 0) {
  recentVideos.forEach((video, index) => {
    console.log(`    ${index + 1}. ${video.status} - ${new Date(video.created_at).toLocaleString('zh-CN')}`)
  })
}
console.log()

console.log('🚀 分析结论:')
console.log('视频总数:', allVideos?.length || 0)
console.log('今日生成:', todayVideos?.length || 0)
console.log('最近1小时:', recentVideos?.length || 0)
console.log('积分状态:', profile.credits > 0 ? '✅ 有积分' : '❌ 无积分')

// 判断是否应该被限流
const shouldBeLimited = (recentVideos?.length || 0) >= 100
console.log('是否应该被限流:', shouldBeLimited ? '是 (>= 100次/小时)' : '否 (< 100次/小时)')