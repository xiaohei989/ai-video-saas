/**
 * 修复视频标题格式脚本
 * 将 "中文前缀{json}" 格式修复为纯 JSON 格式
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTI2MTI0OCwiZXhwIjoyMDUwODM3MjQ4fQ.zJKHXrLGnkLrL-A9KBpXTWR8HLMJpZ1xR6wswlF8zJQ'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function fixTitleFormat() {
  console.log('🔧 开始修复标题格式...\n')

  // 1. 查询需要修复的标题
  const { data: videos, error: fetchError } = await supabase
    .from('videos')
    .select('id, title')
    .not('title', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (fetchError) {
    console.error('❌ 查询失败:', fetchError)
    return
  }

  console.log(`📊 查询到 ${videos.length} 个视频\n`)

  // 2. 筛选需要修复的标题
  const needFix = videos.filter(video => {
    const title = video.title || ''
    // 检查是否为"前缀+JSON"格式
    return title.includes('{') && !title.startsWith('{')
  })

  console.log(`🔍 发现 ${needFix.length} 个需要修复的标题:\n`)

  // 3. 修复标题
  let fixedCount = 0
  let failedCount = 0

  for (const video of needFix) {
    const originalTitle = video.title

    // 提取JSON部分
    const jsonMatch = originalTitle.match(/(\{(?:[^{}]|"[^"]*")*\})/);

    if (jsonMatch) {
      const fixedTitle = jsonMatch[1]

      // 验证提取的JSON是否有效
      try {
        JSON.parse(fixedTitle)

        // 更新数据库
        const { error: updateError } = await supabase
          .from('videos')
          .update({ title: fixedTitle })
          .eq('id', video.id)

        if (updateError) {
          console.error(`❌ 更新失败 [${video.id}]:`, updateError.message)
          failedCount++
        } else {
          console.log(`✅ [${video.id}]`)
          console.log(`   原始: ${originalTitle.substring(0, 60)}...`)
          console.log(`   修复: ${fixedTitle.substring(0, 60)}...\n`)
          fixedCount++
        }
      } catch (e) {
        console.error(`⚠️ 跳过无效JSON [${video.id}]: ${originalTitle.substring(0, 40)}...`)
        failedCount++
      }
    } else {
      console.log(`⚠️ 无法提取JSON [${video.id}]: ${originalTitle.substring(0, 40)}...`)
      failedCount++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✨ 修复完成!`)
  console.log(`   ✅ 成功: ${fixedCount}`)
  console.log(`   ❌ 失败: ${failedCount}`)
  console.log(`   📊 总计: ${needFix.length}`)
  console.log('='.repeat(60))
}

fixTitleFormat().catch(console.error)
