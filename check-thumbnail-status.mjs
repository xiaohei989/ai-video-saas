import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 检查缩略图批量生成的最新状态...')

const { data: videos } = await supabase
  .from('videos')
  .select('id, title, thumbnail_url, thumbnail_generation_status, created_at')
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(20)

if (videos) {
  let completed = 0
  let pending = 0
  let failed = 0
  let processing = 0

  console.log('📹 最新20个视频的缩略图状态:')
  console.log('=====================================')
  
  for (const video of videos) {
    const status = video.thumbnail_generation_status || 'pending'
    const hasUrl = !!video.thumbnail_url
    const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
    
    switch (status) {
      case 'completed': completed++; break
      case 'pending': pending++; break
      case 'failed': failed++; break
      case 'processing': processing++; break
      default: pending++; break
    }
    
    const statusIcon = {
      'completed': '✅',
      'pending': '⏳',
      'failed': '❌',
      'processing': '🔄'
    }[status] || '❓'
    
    console.log(`${statusIcon} ${video.title}`)
    console.log(`   状态: ${status}`)
    console.log(`   缩略图: ${hasUrl ? '✅ 已生成' : '❌ 无'}`)
    console.log(`   创建: ${createdAt}`)
    console.log('   ---')
  }
  
  console.log()
  console.log('📊 统计结果:')
  console.log(`总数: ${videos.length}`)
  console.log(`已完成: ${completed}`)
  console.log(`待处理: ${pending}`)
  console.log(`处理中: ${processing}`)
  console.log(`失败: ${failed}`)
  
  const successRate = videos.length > 0 ? ((completed / videos.length) * 100).toFixed(1) + '%' : '0%'
  console.log(`成功率: ${successRate}`)
}