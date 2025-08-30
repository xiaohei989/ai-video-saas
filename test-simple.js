/**
 * 简化的点赞功能测试
 */
const { chromium } = require('playwright')

async function simpleTest() {
  let browser, page

  try {
    console.log('🚀 启动浏览器...')
    browser = await chromium.launch({ headless: false, slowMo: 500 })
    const context = await browser.newContext()
    page = await context.newPage()
    
    // 监听Token相关日志
    page.on('console', msg => {
      if (msg.text().includes('定期检查Token') || msg.text().includes('Token')) {
        console.log('🔒 Token日志:', msg.text())
      }
      if (msg.text().includes('[AUTH]')) {
        console.log('🔐 认证日志:', msg.text())
      }
      if (msg.type() === 'error' && msg.text().includes('406')) {
        console.log('❌ 406错误:', msg.text())
      }
    })

    console.log('📱 导航到模板页面...')
    await page.goto('http://localhost:3000/templates')
    
    // 等待页面基本元素加载
    try {
      await page.waitForSelector('body', { timeout: 10000 })
      console.log('✅ 页面基本结构已加载')
    } catch (e) {
      console.log('⚠️ 页面加载超时，继续测试')
    }
    
    // 等待3秒让React组件完全渲染
    await page.waitForTimeout(3000)

    console.log('🔍 检查用户登录状态...')
    
    // 检查是否有登录相关元素
    const loginButton = await page.locator('button:has-text("登录")').count()
    const userAvatar = await page.locator('[data-testid="user-avatar"]').count()
    const userInfo = await page.locator('*:has-text("账户"), *:has-text("登出"), *:has-text("我的")').count()
    
    console.log(`登录按钮: ${loginButton}个, 用户头像: ${userAvatar}个, 用户信息: ${userInfo}个`)
    
    if (loginButton > 0) {
      console.log('❌ 用户未登录，需要先登录才能测试点赞功能')
      console.log('请访问 http://localhost:3000 并登录后再次运行测试')
    } else {
      console.log('✅ 用户可能已登录')
      
      console.log('🔍 搜索点赞按钮...')
      
      // 等待一会儿让模板加载
      await page.waitForTimeout(5000)
      
      // 尝试多种方式查找点赞按钮
      const likeButtons1 = await page.locator('[data-testid="like-button"]').count()
      const likeButtons2 = await page.locator('button:has([aria-label*="赞"], [title*="赞"])').count()
      const likeButtons3 = await page.locator('.like-button').count()
      const heartIcons = await page.locator('svg:has-text(""), *:has(svg)').count()
      
      console.log(`data-testid方式: ${likeButtons1}个`)
      console.log(`aria-label方式: ${likeButtons2}个`)
      console.log(`class方式: ${likeButtons3}个`)
      console.log(`心形图标: ${heartIcons}个`)
      
      if (likeButtons1 > 0) {
        console.log('✅ 找到点赞按钮，开始测试...')
        
        const likeButton = page.locator('[data-testid="like-button"]').first()
        const likeCount = page.locator('[data-testid="like-count"]').first()
        
        // 获取初始状态
        const initialPressed = await likeButton.getAttribute('aria-pressed')
        const initialCount = await likeCount.textContent()
        
        console.log(`📊 初始状态: aria-pressed=${initialPressed}, 计数=${initialCount}`)
        
        // 点击点赞按钮
        console.log('👆 点击点赞按钮...')
        await likeButton.click()
        
        // 等待响应
        await page.waitForTimeout(3000)
        
        // 检查变化
        const newPressed = await likeButton.getAttribute('aria-pressed')
        const newCount = await likeCount.textContent()
        
        console.log(`📊 点击后状态: aria-pressed=${newPressed}, 计数=${newCount}`)
        
        if (initialPressed !== newPressed) {
          console.log('✅ 点赞状态已改变！')
        } else {
          console.log('❌ 点赞状态未改变')
        }
        
        if (initialCount !== newCount) {
          console.log('✅ 点赞计数已改变！')
        } else {
          console.log('⚠️ 点赞计数未改变')
        }
      } else {
        console.log('❌ 未找到任何点赞按钮')
        
        // 调试：打印页面HTML结构
        console.log('🔍 调试：检查页面结构...')
        const bodyContent = await page.locator('body').innerHTML()
        const hasTemplates = bodyContent.includes('template') || bodyContent.includes('Template')
        const hasButtons = bodyContent.includes('<button')
        const hasLike = bodyContent.includes('like') || bodyContent.includes('Like') || bodyContent.includes('点赞')
        
        console.log(`页面包含模板相关内容: ${hasTemplates}`)
        console.log(`页面包含按钮: ${hasButtons}`)
        console.log(`页面包含点赞相关内容: ${hasLike}`)
      }
    }

    console.log('🕒 观察Token检查机制（等待35秒）...')
    await page.waitForTimeout(35000)

    console.log('✅ 测试完成!')

  } catch (error) {
    console.error('❌ 测试错误:', error)
  } finally {
    if (browser) {
      await page?.waitForTimeout(2000)
      await browser.close()
    }
  }
}

simpleTest().catch(console.error)