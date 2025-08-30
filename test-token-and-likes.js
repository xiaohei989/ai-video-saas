/**
 * 测试Token刷新和点赞功能
 * 使用Playwright进行端到端测试
 */
const { chromium } = require('playwright')

async function testTokenAndLikes() {
  let browser, context, page

  try {
    console.log('🚀 启动浏览器...')
    browser = await chromium.launch({ 
      headless: false, // 显示浏览器窗口便于观察
      slowMo: 1000 // 操作间隔1秒
    })
    
    context = await browser.newContext()
    page = await context.newPage()
    
    // 监听控制台消息
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ 浏览器错误:', msg.text())
      } else if (msg.text().includes('Token') || msg.text().includes('定期检查')) {
        console.log('🔒 Token相关日志:', msg.text())
      }
    })

    console.log('📱 导航到应用首页...')
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')
    
    // 等待页面完全加载
    await page.waitForTimeout(2000)

    console.log('🔐 测试Google登录...')
    // 找到登录按钮并点击
    const loginButton = page.locator('button:has-text("登录")')
    if (await loginButton.count() > 0) {
      await loginButton.first().click()
      await page.waitForTimeout(1000)
      
      // 点击Google登录
      const googleButton = page.locator('button:has-text("Google")')
      if (await googleButton.count() > 0) {
        console.log('⚠️  即将跳转到Google登录页面，请手动登录后返回应用')
        await googleButton.click()
        
        // 等待用户完成Google登录并返回
        console.log('⏳ 等待登录完成...')
        await page.waitForFunction(
          () => window.location.pathname.includes('templates') || 
                document.querySelector('[data-testid="user-avatar"]'),
          { timeout: 60000 }
        )
        
        console.log('✅ 登录成功！')
      } else {
        console.log('❌ 未找到Google登录按钮')
        return
      }
    } else {
      console.log('👤 用户可能已登录，跳过登录步骤')
    }

    console.log('📋 导航到模板页面...')
    await page.goto('http://localhost:3000/templates')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    console.log('🔍 查找点赞按钮...')
    // 查找第一个可用的点赞按钮
    const likeButtons = page.locator('[data-testid="like-button"]')
    const buttonCount = await likeButtons.count()
    
    console.log(`找到 ${buttonCount} 个点赞按钮`)
    
    if (buttonCount > 0) {
      const firstLikeButton = likeButtons.first()
      
      // 获取初始状态
      const isInitiallyLiked = await firstLikeButton.getAttribute('aria-pressed') === 'true'
      const initialCountText = await page.locator('[data-testid="like-count"]').first().textContent()
      const initialCount = parseInt(initialCountText || '0')
      
      console.log(`📊 初始状态: ${isInitiallyLiked ? '已点赞' : '未点赞'}, 点赞数: ${initialCount}`)

      console.log('👆 测试点赞功能...')
      await firstLikeButton.click()
      
      // 等待API响应
      await page.waitForTimeout(2000)
      
      // 检查状态变化
      const newIsLiked = await firstLikeButton.getAttribute('aria-pressed') === 'true'
      const newCountText = await page.locator('[data-testid="like-count"]').first().textContent()
      const newCount = parseInt(newCountText || '0')
      
      console.log(`📊 点击后状态: ${newIsLiked ? '已点赞' : '未点赞'}, 点赞数: ${newCount}`)
      
      if (isInitiallyLiked !== newIsLiked) {
        console.log('✅ 点赞状态切换成功！')
        
        // 再次点击测试取消点赞
        console.log('👆 测试取消点赞...')
        await firstLikeButton.click()
        await page.waitForTimeout(2000)
        
        const finalIsLiked = await firstLikeButton.getAttribute('aria-pressed') === 'true'
        const finalCountText = await page.locator('[data-testid="like-count"]').first().textContent()
        const finalCount = parseInt(finalCountText || '0')
        
        console.log(`📊 最终状态: ${finalIsLiked ? '已点赞' : '未点赞'}, 点赞数: ${finalCount}`)
        
        if (finalIsLiked !== newIsLiked) {
          console.log('✅ 取消点赞成功！')
        } else {
          console.log('❌ 取消点赞失败')
        }
      } else {
        console.log('❌ 点赞状态未改变，可能有错误')
      }
    } else {
      console.log('❌ 未找到点赞按钮')
    }

    console.log('🕒 等待Token检查定时器触发...')
    // 等待30秒以观察Token检查
    await page.waitForTimeout(35000)
    
    console.log('🔄 刷新页面测试Session恢复...')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    
    // 检查用户是否仍然登录
    const userInfo = page.locator('[data-testid="user-avatar"]')
    if (await userInfo.count() > 0) {
      console.log('✅ Session恢复成功，用户仍然登录！')
    } else {
      console.log('❌ Session恢复失败，用户需要重新登录')
    }

    console.log('🎯 测试完成！')

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error)
  } finally {
    if (browser) {
      console.log('🔚 关闭浏览器...')
      // 等待5秒让用户观察结果
      await page?.waitForTimeout(5000)
      await browser.close()
    }
  }
}

// 运行测试
testTokenAndLikes().catch(console.error)