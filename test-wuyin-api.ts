/**
 * Wuyin API 测试脚本
 *
 * 用法:
 * npx tsx test-wuyin-api.ts
 */

import * as dotenv from 'dotenv'
import { getWuyinApiService } from './src/services/veo/WuyinApiService'

// 加载环境变量
dotenv.config()

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(level: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN', message: string) {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const colorMap = {
    INFO: colors.blue,
    SUCCESS: colors.green,
    ERROR: colors.red,
    WARN: colors.yellow,
  }

  console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colorMap[level]}[${level}]${colors.reset} ${message}`)
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function testWuyinAPI() {
  log('INFO', '='.repeat(60))
  log('INFO', '开始 Wuyin API 完整测试')
  log('INFO', '='.repeat(60))

  // 1. 检查环境变量
  log('INFO', '步骤 1/4: 检查环境变量配置')

  const apiKey = process.env.VITE_WUYIN_API_KEY
  const endpoint = process.env.VITE_WUYIN_ENDPOINT || 'https://api.wuyinkeji.com'

  if (!apiKey) {
    log('ERROR', '❌ VITE_WUYIN_API_KEY 未配置')
    log('ERROR', '请在 .env 文件中配置: VITE_WUYIN_API_KEY=your_key_here')
    process.exit(1)
  }

  log('SUCCESS', `✅ API Key 已配置: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`)
  log('INFO', `   端点: ${endpoint}`)

  // 2. 初始化服务
  log('INFO', '步骤 2/4: 初始化 Wuyin 服务')

  let wuyinService
  try {
    wuyinService = getWuyinApiService({ apiKey, endpoint })
    log('SUCCESS', '✅ Wuyin 服务初始化成功')
  } catch (error) {
    log('ERROR', `❌ 服务初始化失败: ${error}`)
    process.exit(1)
  }

  // 3. 创建视频生成任务
  log('INFO', '步骤 3/4: 创建视频生成任务')

  const testPrompt = 'A beautiful sunset over the ocean with waves crashing on the beach, cinematic 4K'
  log('INFO', `   模型: veo3`)
  log('INFO', `   提示词: "${testPrompt}"`)
  log('INFO', `   宽高比: 16:9`)
  log('INFO', `   类型: text2video`)

  let taskId: string
  try {
    const startTime = Date.now()

    const response = await wuyinService.createVideo({
      endpoint_url: endpoint,
      key: apiKey,
      model_name: 'veo3',
      prompt: testPrompt,
      type: 'text2video',
      ratio: '16:9'
    })

    const elapsed = Date.now() - startTime
    taskId = response.taskId

    log('SUCCESS', `✅ 任务创建成功 (耗时: ${elapsed}ms)`)
    log('INFO', `   任务ID: ${taskId}`)
    log('INFO', `   初始状态: ${response.status}`)

  } catch (error) {
    log('ERROR', `❌ 任务创建失败: ${error}`)
    if (error instanceof Error) {
      log('ERROR', `   错误详情: ${error.message}`)
      log('ERROR', `   堆栈: ${error.stack}`)
    }
    process.exit(1)
  }

  // 4. 轮询任务状态直到完成
  log('INFO', '步骤 4/4: 轮询任务状态')
  log('INFO', '   轮询间隔: 5秒')
  log('INFO', '   最大等待时间: 10分钟')

  const maxPolls = 120 // 10分钟 (120 * 5秒)
  let pollCount = 0
  const pollStartTime = Date.now()

  while (pollCount < maxPolls) {
    pollCount++

    try {
      await sleep(5000) // 等待5秒

      const elapsed = Math.floor((Date.now() - pollStartTime) / 1000)
      log('INFO', `   [轮询 #${pollCount}] 已用时: ${elapsed}秒`)

      const status = await wuyinService.queryStatus(taskId)

      log('INFO', `   状态: ${status.status}`)
      log('INFO', `   进度: ${status.progress || 0}%`)

      if (status.status === 'completed') {
        const totalTime = Math.floor((Date.now() - pollStartTime) / 1000)
        log('SUCCESS', '='.repeat(60))
        log('SUCCESS', `✅ 视频生成成功！`)
        log('SUCCESS', `   总耗时: ${totalTime}秒 (${Math.floor(totalTime / 60)}分${totalTime % 60}秒)`)
        log('SUCCESS', `   轮询次数: ${pollCount}`)
        log('SUCCESS', `   视频URL: ${status.video_url}`)
        log('SUCCESS', '='.repeat(60))

        // 输出完整结果
        log('INFO', '完整结果:')
        console.log(JSON.stringify(status, null, 2))

        process.exit(0)
      } else if (status.status === 'failed') {
        log('ERROR', '='.repeat(60))
        log('ERROR', `❌ 视频生成失败`)
        log('ERROR', `   失败原因: ${status.fail_reason || 'Unknown error'}`)
        log('ERROR', '='.repeat(60))

        process.exit(1)
      } else if (status.status === 'processing' || status.status === 'queued') {
        // 继续轮询
        continue
      } else {
        log('WARN', `   未知状态: ${status.status}`)
      }

    } catch (error) {
      log('ERROR', `   轮询错误: ${error}`)
      // 不退出，继续尝试
    }
  }

  // 超时
  log('ERROR', '='.repeat(60))
  log('ERROR', `❌ 轮询超时 (超过10分钟)`)
  log('ERROR', `   最后轮询次数: ${pollCount}`)
  log('ERROR', '='.repeat(60))
  process.exit(1)
}

// 主程序
testWuyinAPI().catch(error => {
  log('ERROR', `未捕获的错误: ${error}`)
  process.exit(1)
})
