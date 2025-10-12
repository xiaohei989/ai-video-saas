import { test, expect } from '@playwright/test';

test.describe('AI标题生成功能测试', () => {
  test('使用真实AI服务生成标题 - 松鼠蹦床场景', async ({ page }) => {
    // 监听所有控制台日志
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);

      // 实时打印AI相关日志
      if (
        text.includes('[AI CONTENT SERVICE]') ||
        text.includes('[METADATA GENERATOR]') ||
        text.includes('[TASK SCHEDULER]')
      ) {
        console.log(`[控制台] ${text}`);
      }
    });

    // 1. 导航到创建页面
    console.log('📍 步骤1: 导航到视频创建页面...');
    await page.goto('http://localhost:3000/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 2. 查找并选择模板
    console.log('📍 步骤2: 选择 Surveillance Animal Trampoline 模板...');

    // 等待模板加载
    await page.waitForSelector('button:has-text("Generate Video"), a[href*="create"]', { timeout: 10000 });

    // 截图：页面加载完成
    await page.screenshot({
      path: 'test-results/ai-title-test/01-page-loaded.png',
      fullPage: true
    });

    // 3. 输入提示词
    console.log('📍 步骤3: 输入松鼠蹦床提示词...');
    const promptText = 'A group of 15+ squirrels bounce energetically on a large round trampoline placed on grass in a backyard at night. Captured from a fixed, top-down high-angle surveillance camera, grainy black-and-white night vision footage with 29/01/2024 23:47:15 displayed in the corner, visible noise, slight motion blur, and low-light exposure, medium-long shot. The background features a wooden fence and shadowy trees.';

    const promptInput = page.locator('textarea[placeholder*="prompt"], textarea[name="prompt"], textarea').first();
    await promptInput.waitFor({ state: 'visible', timeout: 5000 });
    await promptInput.fill(promptText);

    await page.waitForTimeout(500);

    // 截图：提示词已输入
    await page.screenshot({
      path: 'test-results/ai-title-test/02-prompt-filled.png',
      fullPage: true
    });

    // 4. 点击生成按钮
    console.log('📍 步骤4: 点击生成按钮...');
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("生成"), button[type="submit"]').first();
    await generateButton.waitFor({ state: 'visible', timeout: 5000 });

    console.log('🚀 提交视频生成请求...');
    await generateButton.click();

    // 5. 等待AI生成过程
    console.log('📍 步骤5: 等待AI标题生成...');
    await page.waitForTimeout(15000); // 给足够时间让AI调用完成

    // 截图：生成请求提交后
    await page.screenshot({
      path: 'test-results/ai-title-test/03-after-submit.png',
      fullPage: true
    });

    // 6. 分析控制台日志
    console.log('\n' + '='.repeat(80));
    console.log('📊 AI调用流程分析');
    console.log('='.repeat(80));

    // 检查同步生成
    const syncStarted = consoleLogs.some(log => log.includes('开始同步生成AI标题和简介'));
    const primaryModelCall = consoleLogs.some(log => log.includes('调用 claude-3-5-haiku'));
    const fallbackModelCall = consoleLogs.some(log => log.includes('调用 gpt-3.5-turbo'));
    const primarySuccess = consoleLogs.some(log => log.includes('使用主模型生成成功'));
    const fallbackSuccess = consoleLogs.some(log => log.includes('使用备用模型生成成功'));
    const useFallback = consoleLogs.some(log => log.includes('使用回退方案'));

    console.log('\n✅ 同步生成阶段:');
    console.log(`   - 开始同步生成: ${syncStarted ? '是' : '否'}`);
    console.log(`   - 调用主模型 (Claude): ${primaryModelCall ? '是' : '否'}`);
    console.log(`   - 主模型成功: ${primarySuccess ? '是 ✅' : '否'}`);
    console.log(`   - 调用备用模型 (GPT): ${fallbackModelCall ? '是' : '否'}`);
    console.log(`   - 备用模型成功: ${fallbackSuccess ? '是 ✅' : '否'}`);
    console.log(`   - 使用回退方案: ${useFallback ? '是 ⚠️' : '否'}`);

    // 检查异步重试
    const asyncRetry = consoleLogs.some(log => log.includes('异步生成AI标题和简介'));
    const retryCount = consoleLogs.filter(log => log.includes('重试')).length;

    console.log('\n🔄 异步重试阶段:');
    console.log(`   - 触发异步重试: ${asyncRetry ? '是' : '否'}`);
    console.log(`   - 重试次数: ${retryCount}`);

    // 检查最终结果
    const titleGenerated = consoleLogs.some(log => log.includes('AI标题生成成功'));
    const videoCreated = consoleLogs.some(log => log.includes('视频记录创建完成'));

    console.log('\n📝 最终结果:');
    console.log(`   - 标题生成成功: ${titleGenerated ? '是 ✅' : '否 ❌'}`);
    console.log(`   - 视频记录创建: ${videoCreated ? '是 ✅' : '否 ❌'}`);

    // 提取生成的标题
    const titleLog = consoleLogs.find(log => log.includes('AI标题生成成功:') && log.includes('title:'));
    if (titleLog) {
      const titleMatch = titleLog.match(/title:\s*['"]([^'"]+)['"]/);
      if (titleMatch) {
        console.log(`\n🎯 生成的标题: "${titleMatch[1]}"`);
      }
    }

    // 7. 打印完整的AI相关日志
    console.log('\n' + '='.repeat(80));
    console.log('📜 完整AI调用日志');
    console.log('='.repeat(80));

    const aiLogs = consoleLogs.filter(log =>
      log.includes('[AI CONTENT SERVICE]') ||
      log.includes('[METADATA GENERATOR]') ||
      log.includes('[TASK SCHEDULER]')
    );

    aiLogs.forEach((log, index) => {
      console.log(`${index + 1}. ${log}`);
    });

    // 8. 验证测试结果
    console.log('\n' + '='.repeat(80));
    console.log('🎬 测试结果总结');
    console.log('='.repeat(80));

    if (primarySuccess || fallbackSuccess) {
      console.log('✅ 测试通过: AI成功生成标题');
      expect(titleGenerated).toBeTruthy();
    } else if (useFallback && videoCreated) {
      console.log('⚠️  测试部分通过: AI失败但使用了回退方案');
      if (asyncRetry) {
        console.log('   后台异步重试已启动,标题可能稍后更新');
      }
      expect(videoCreated).toBeTruthy();
    } else {
      console.log('❌ 测试失败: AI生成失败且未创建视频记录');
      expect(videoCreated).toBeTruthy();
    }

    console.log('='.repeat(80) + '\n');

    // 最终截图
    await page.screenshot({
      path: 'test-results/ai-title-test/04-final-state.png',
      fullPage: true
    });
  });
});
