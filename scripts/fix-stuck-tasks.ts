/**
 * 修复卡住的视频生成任务
 * 用于清理超过一定时间还在processing状态的任务
 */

import { createClient } from '@supabase/supabase-js'

// Supabase配置
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface StuckTask {
  id: string
  user_id: string
  status: string
  title: string
  created_at: string
  processing_started_at: string
  veo3_job_id: string
}

/**
 * 查找卡住的任务
 * @param maxMinutes 超过多少分钟算卡住（默认15分钟）
 */
async function findStuckTasks(maxMinutes: number = 15): Promise<StuckTask[]> {
  const cutoffTime = new Date(Date.now() - maxMinutes * 60 * 1000).toISOString()

  console.log(`\n🔍 查找超过 ${maxMinutes} 分钟还在处理中的任务...`)
  console.log(`⏰ 截止时间: ${cutoffTime}`)

  const { data, error } = await supabase
    .from('videos')
    .select('id, user_id, status, title, created_at, processing_started_at, veo3_job_id')
    .in('status', ['processing', 'pending'])
    .lt('created_at', cutoffTime)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ 查询失败:', error)
    throw error
  }

  console.log(`\n📊 找到 ${data?.length || 0} 个可能卡住的任务`)

  return data as StuckTask[] || []
}

/**
 * 修复单个卡住的任务
 */
async function fixStuckTask(task: StuckTask): Promise<boolean> {
  console.log(`\n🔧 修复任务: ${task.title}`)
  console.log(`   ID: ${task.id}`)
  console.log(`   状态: ${task.status}`)
  console.log(`   创建时间: ${task.created_at}`)
  console.log(`   veo3_job_id: ${task.veo3_job_id || 'null'}`)

  const { error } = await supabase
    .from('videos')
    .update({
      status: 'failed',
      error_message: '任务超时 - 自动清理脚本标记为失败',
      updated_at: new Date().toISOString()
    })
    .eq('id', task.id)

  if (error) {
    console.error(`   ❌ 更新失败:`, error)
    return false
  }

  console.log(`   ✅ 已标记为失败`)
  return true
}

/**
 * 主函数
 */
async function main() {
  console.log('=' .repeat(60))
  console.log('🛠️  修复卡住的视频生成任务')
  console.log('=' .repeat(60))

  try {
    // 1. 查找卡住的任务
    const stuckTasks = await findStuckTasks(15) // 超过15分钟

    if (stuckTasks.length === 0) {
      console.log('\n✅ 没有发现卡住的任务！')
      return
    }

    // 2. 显示任务列表
    console.log('\n📋 卡住的任务列表:')
    console.log('-'.repeat(60))
    stuckTasks.forEach((task, index) => {
      const elapsedMinutes = Math.round(
        (Date.now() - new Date(task.created_at).getTime()) / (1000 * 60)
      )
      console.log(`${index + 1}. ${task.title}`)
      console.log(`   状态: ${task.status}, 已经过: ${elapsedMinutes}分钟`)
    })

    // 3. 修复所有任务
    console.log('\n🚀 开始修复...')
    let successCount = 0
    let failCount = 0

    for (const task of stuckTasks) {
      const success = await fixStuckTask(task)
      if (success) {
        successCount++
      } else {
        failCount++
      }
    }

    // 4. 显示结果
    console.log('\n' + '='.repeat(60))
    console.log('📊 修复完成!')
    console.log(`   ✅ 成功: ${successCount}`)
    console.log(`   ❌ 失败: ${failCount}`)
    console.log(`   📝 总计: ${stuckTasks.length}`)
    console.log('='.repeat(60))

    // 5. 提示用户刷新页面
    console.log('\n💡 提示: 请刷新浏览器页面以查看更新后的任务状态')

  } catch (error) {
    console.error('\n💥 脚本执行失败:', error)
    process.exit(1)
  }
}

// 运行脚本
main()
