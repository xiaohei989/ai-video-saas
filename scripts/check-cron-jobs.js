#!/usr/bin/env node
// 检查pg_cron定时任务配置

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('🔍 检查pg_cron定时任务配置\n')

  // 查询所有cron任务
  const { data: jobs, error } = await supabase.rpc('exec_sql', {
    sql: 'SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobname;'
  })

  if (error) {
    console.log('⚠️  无法直接查询cron.job表\n')
    console.log('请在Supabase SQL Editor中执行以下命令：\n')
    console.log('SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobname;')
    console.log('')
    return
  }

  if (!jobs || jobs.length === 0) {
    console.log('📋 当前没有配置任何cron任务\n')
    return
  }

  console.log(`📋 找到 ${jobs.length} 个cron任务:\n`)

  jobs.forEach((job, i) => {
    console.log(`[${i + 1}] ${job.jobname}`)
    console.log(`    Schedule: ${job.schedule}`)
    console.log(`    Command: ${job.command.substring(0, 100)}...`)
    console.log('')
  })
}

main().catch(console.error)
