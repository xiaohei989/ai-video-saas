import { test } from '@playwright/test'

test('采集我的视频页面控制台日志', async ({ page }) => {
  const logs: { type: string; text: string }[] = []

  page.on('console', message => {
    logs.push({
      type: message.type(),
      text: message.text()
    })
  })

  // 尝试打开受保护的页面，记录首屏加载阶段日志
  await page.goto('/videos', { waitUntil: 'domcontentloaded' })

  // 给页面一点时间执行 quickLoad / backgroundLoad 日志
  await page.waitForTimeout(5000)

  console.log('--- 控制台日志开始 ---')
  for (const entry of logs) {
    console.log(`[${entry.type}] ${entry.text}`)
  }
  console.log('--- 控制台日志结束 ---')
})
