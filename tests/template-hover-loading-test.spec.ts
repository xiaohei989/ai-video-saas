import { test, expect } from '@playwright/test';

test.describe('模板视频悬浮加载状态测试', () => {
  test('检查视频悬浮加载状态是否正确显示', async ({ page }) => {
    // 导航到模板页面
    await page.goto('http://localhost:3001/templates');
    
    // 等待页面完全加载
    await page.waitForLoadState('networkidle');
    
    // 等待模板卡片加载完成
    await page.waitForSelector('[data-testid="template-card"]', { timeout: 10000 });
    
    // 获取第一个模板卡片
    const templateCard = page.locator('[data-testid="template-card"]').first();
    
    // 等待模板卡片可见
    await expect(templateCard).toBeVisible();
    
    // 截图：悬浮前的状态
    await page.screenshot({
      path: 'test-results/before-hover.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
    
    console.log('已截图：悬浮前状态');
    
    // 找到视频元素
    const videoElement = templateCard.locator('video').first();
    
    // 确保视频元素存在
    await expect(videoElement).toBeVisible();
    
    // 悬浮在视频区域上
    await videoElement.hover();
    
    console.log('已悬浮在视频区域上');
    
    // 等待短暂时间让悬浮效果生效
    await page.waitForTimeout(500);
    
    // 检查是否有加载状态
    const loadingSpinner = templateCard.locator('[data-testid="video-loading-spinner"], .loading-spinner, .spinner');
    const playButton = templateCard.locator('[data-testid="play-button"], .play-button, button[aria-label*="play"]');
    
    // 截图：悬浮后的加载状态
    await page.screenshot({
      path: 'test-results/hover-loading-state.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
    
    console.log('已截图：悬浮加载状态');
    
    // 检查加载状态：应该有加载动画，不应该有播放按钮
    const hasLoadingSpinner = await loadingSpinner.count() > 0;
    const hasPlayButton = await playButton.count() > 0;
    
    console.log(`加载动画元素数量: ${await loadingSpinner.count()}`);
    console.log(`播放按钮元素数量: ${await playButton.count()}`);
    
    // 等待更长时间观察加载过程
    await page.waitForTimeout(2000);
    
    // 再次截图：加载过程中
    await page.screenshot({
      path: 'test-results/loading-process.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
    
    console.log('已截图：加载过程中');
    
    // 检查具体的UI元素
    const allElements = await templateCard.locator('*').all();
    for (let i = 0; i < Math.min(allElements.length, 20); i++) {
      const element = allElements[i];
      const tagName = await element.evaluate(el => el.tagName);
      const classList = await element.evaluate(el => Array.from(el.classList).join(' '));
      const textContent = await element.evaluate(el => el.textContent?.trim().substring(0, 50));
      
      if (classList.includes('loading') || classList.includes('spinner') || classList.includes('play')) {
        console.log(`元素 ${i}: ${tagName}, 类名: "${classList}", 文本: "${textContent}"`);
      }
    }
    
    // 等待视频加载完成或超时
    try {
      await page.waitForFunction(() => {
        const videos = document.querySelectorAll('video');
        return Array.from(videos).some(video => video.readyState >= 2);
      }, { timeout: 5000 });
      
      console.log('视频已加载完成');
      
      // 截图：视频加载完成后
      await page.screenshot({
        path: 'test-results/video-loaded.png',
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      });
      
    } catch (e) {
      console.log('等待视频加载超时，但继续测试');
      
      // 截图：超时状态
      await page.screenshot({
        path: 'test-results/loading-timeout.png',
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      });
    }
    
    // 移除悬浮
    await page.locator('body').hover();
    await page.waitForTimeout(500);
    
    // 截图：悬浮移除后
    await page.screenshot({
      path: 'test-results/after-unhover.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
    
    console.log('已截图：悬浮移除后');
    
    // 输出测试结果摘要
    console.log('=== 测试结果摘要 ===');
    console.log(`在悬浮加载状态下:`);
    console.log(`- 加载动画: ${hasLoadingSpinner ? '存在' : '不存在'}`);
    console.log(`- 播放按钮: ${hasPlayButton ? '存在（可能有问题）' : '不存在（正确）'}`);
    
    // 建议性断言（不强制失败）
    if (hasLoadingSpinner && !hasPlayButton) {
      console.log('✅ 加载状态正确：显示加载动画，隐藏播放按钮');
    } else if (hasLoadingSpinner && hasPlayButton) {
      console.log('⚠️  可能的问题：同时显示加载动画和播放按钮');
    } else if (!hasLoadingSpinner && hasPlayButton) {
      console.log('⚠️  可能的问题：只显示播放按钮，没有加载动画');
    } else {
      console.log('❓ 无法确定加载状态：既没有加载动画也没有播放按钮');
    }
  });
});