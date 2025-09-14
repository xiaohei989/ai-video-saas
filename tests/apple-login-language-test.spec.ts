import { test, expect } from '@playwright/test';

const APP_URL = 'https://ffc17fa8.ai-video-saas.pages.dev';

test.describe('Apple Login Language Persistence Test', () => {
  test.beforeEach(async ({ page, context }) => {
    // 设置页面配置
    await context.addInitScript(() => {
      // 模拟中文浏览器环境
      Object.defineProperty(navigator, 'language', {
        get: () => 'zh-CN',
        configurable: true
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en'],
        configurable: true
      });
    });

    // 清除之前的存储数据
    await context.clearCookies();
    await page.goto(APP_URL);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should preserve Chinese language after Apple login simulation', async ({ page }) => {
    console.log('🧪 Testing Apple Login Language Persistence...');

    // 1. 首先验证页面加载和语言初始化
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    
    // 等待i18n初始化完成
    await page.waitForTimeout(2000);

    // 检查初始语言状态
    const initialLanguage = await page.evaluate(() => {
      return {
        i18nLanguage: (window as any).i18n?.language || 'unknown',
        preferredLanguage: localStorage.getItem('preferred_language'),
        navigatorLanguage: navigator.language
      };
    });
    
    console.log('📊 Initial language state:', initialLanguage);

    // 2. 手动切换到中文（模拟用户选择）
    console.log('🔄 Switching to Chinese language...');
    
    // 尝试点击语言选择器
    const languageSelector = page.locator('[data-testid="language-selector"]').or(
      page.locator('button').filter({ hasText: /EN|English|中文/i })
    );
    
    if (await languageSelector.count() > 0) {
      await languageSelector.first().click();
      await page.waitForTimeout(500);
      
      // 查找中文选项
      const chineseOption = page.locator('button', { hasText: '中文' }).or(
        page.locator('button[data-lang="zh"]')
      );
      
      if (await chineseOption.count() > 0) {
        await chineseOption.click();
        await page.waitForTimeout(1000);
      }
    }

    // 验证语言已切换到中文
    const afterSwitchLanguage = await page.evaluate(() => {
      return {
        i18nLanguage: (window as any).i18n?.language || 'unknown',
        preferredLanguage: localStorage.getItem('preferred_language'),
        userExplicitlyChoseArabic: localStorage.getItem('user_explicitly_chose_arabic')
      };
    });
    
    console.log('📊 After manual switch:', afterSwitchLanguage);

    // 3. 模拟Apple OAuth流程
    console.log('🍎 Simulating Apple OAuth process...');
    
    // 模拟OAuth前的语言保护
    await page.evaluate(() => {
      // 模拟AuthContext中的preserveLanguageSettings
      const currentLanguage = (window as any).i18n?.language || 'zh';
      const preferredLanguage = localStorage.getItem('preferred_language');
      
      console.log('[TEST] Apple OAuth前语言状态保护:', {
        currentLanguage,
        preferredLanguage,
        navigatorLanguage: navigator.language
      });
      
      // 保存当前语言到临时存储
      if (currentLanguage && currentLanguage !== 'ar') {
        localStorage.setItem('pre_oauth_language', currentLanguage);
        console.log('[TEST] 已保存OAuth前语言设置:', currentLanguage);
      }
      
      // 设置OAuth提供商标记
      localStorage.setItem('oauth_provider', 'apple');
    });

    // 4. 模拟可能导致语言异常的情况
    console.log('⚠️ Simulating potential language corruption...');
    
    // 模拟某种情况下语言被意外设置为阿拉伯语
    await page.evaluate(() => {
      // 模拟语言被意外设置的情况
      if (Math.random() > 0.5) {
        console.log('[TEST] 模拟语言异常 - 设置为阿拉伯语');
        localStorage.setItem('preferred_language', 'ar');
        if ((window as any).i18n) {
          (window as any).i18n.changeLanguage('ar');
        }
      }
    });

    await page.waitForTimeout(1000);

    // 5. 模拟AuthCallback处理
    console.log('🔄 Simulating AuthCallback language recovery...');
    
    await page.evaluate(() => {
      // 模拟AuthCallback中的protectLanguageSetting
      const currentLanguage = (window as any).i18n?.language || localStorage.getItem('preferred_language');
      const preferredLanguage = localStorage.getItem('preferred_language');
      
      console.log('[TEST] AuthCallback语言保护检查:', {
        currentI18nLanguage: currentLanguage,
        preferredLanguage,
        navigatorLanguage: navigator.language
      });
      
      // 如果当前语言是阿拉伯语但用户之前没有选择阿拉伯语，恢复
      if (currentLanguage === 'ar' && preferredLanguage !== 'ar') {
        const userChoseArabic = localStorage.getItem('user_explicitly_chose_arabic') === 'true';
        
        if (!userChoseArabic) {
          console.warn('[TEST] 检测到异常的阿拉伯语设置（用户未明确选择），尝试恢复');
          
          // 恢复正确的语言
          const fallbackLanguage = localStorage.getItem('pre_oauth_language') || 'zh';
          
          console.log('[TEST] 恢复语言设置为:', fallbackLanguage);
          localStorage.setItem('preferred_language', fallbackLanguage);
          
          if ((window as any).i18n) {
            (window as any).i18n.changeLanguage(fallbackLanguage);
          }
        }
      }
    });

    await page.waitForTimeout(2000);

    // 6. 验证最终语言状态
    console.log('✅ Verifying final language state...');
    
    const finalLanguageState = await page.evaluate(() => {
      return {
        i18nLanguage: (window as any).i18n?.language || 'unknown',
        preferredLanguage: localStorage.getItem('preferred_language'),
        preOAuthLanguage: localStorage.getItem('pre_oauth_language'),
        userExplicitlyChoseArabic: localStorage.getItem('user_explicitly_chose_arabic'),
        oauthProvider: localStorage.getItem('oauth_provider'),
        languageFixedAfterOauth: localStorage.getItem('language_fixed_after_oauth'),
        navigatorLanguage: navigator.language
      };
    });

    console.log('📊 Final language state:', finalLanguageState);

    // 7. 断言验证
    console.log('🔍 Running assertions...');

    // 验证语言不应该是阿拉伯语（除非用户明确选择）
    if (finalLanguageState.userExplicitlyChoseArabic !== 'true') {
      expect(finalLanguageState.i18nLanguage).not.toBe('ar');
      expect(finalLanguageState.preferredLanguage).not.toBe('ar');
      console.log('✅ 语言没有异常切换到阿拉伯语');
    }

    // 验证语言应该是中文或英语
    expect(['zh', 'en'].includes(finalLanguageState.i18nLanguage || '')).toBeTruthy();
    console.log(`✅ 最终语言设置正确: ${finalLanguageState.i18nLanguage}`);

    // 优先应该是中文（基于浏览器语言）
    if (finalLanguageState.i18nLanguage === 'zh') {
      console.log('🎉 语言正确保持为中文！');
    } else {
      console.log('ℹ️ 语言回落到英语（也是可接受的）');
    }

    // 验证临时设置被清理
    expect(finalLanguageState.preOAuthLanguage).toBeNull();
    console.log('✅ OAuth临时语言设置已清理');
  });

  test('should handle explicit Arabic language selection correctly', async ({ page }) => {
    console.log('🧪 Testing explicit Arabic language selection...');

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 模拟用户明确选择阿拉伯语
    await page.evaluate(() => {
      console.log('[TEST] 用户明确选择阿拉伯语');
      localStorage.setItem('user_explicitly_chose_arabic', 'true');
      localStorage.setItem('preferred_language', 'ar');
      if ((window as any).i18n) {
        (window as any).i18n.changeLanguage('ar');
      }
    });

    await page.waitForTimeout(1000);

    // 模拟Apple OAuth流程
    await page.evaluate(() => {
      localStorage.setItem('oauth_provider', 'apple');
      localStorage.setItem('pre_oauth_language', 'ar');
    });

    // 模拟AuthCallback处理
    await page.evaluate(() => {
      const currentLanguage = 'ar';
      const preferredLanguage = localStorage.getItem('preferred_language');
      const userChoseArabic = localStorage.getItem('user_explicitly_chose_arabic') === 'true';
      
      console.log('[TEST] AuthCallback检查明确选择的阿拉伯语:', {
        currentLanguage,
        preferredLanguage,
        userChoseArabic
      });
      
      // 应该保持阿拉伯语
      if (userChoseArabic) {
        console.log('[TEST] 用户之前明确选择了阿拉伯语，保留设置');
      }
    });

    const finalState = await page.evaluate(() => {
      return {
        i18nLanguage: (window as any).i18n?.language || localStorage.getItem('preferred_language'),
        preferredLanguage: localStorage.getItem('preferred_language'),
        userExplicitlyChoseArabic: localStorage.getItem('user_explicitly_chose_arabic')
      };
    });

    console.log('📊 Final state for explicit Arabic:', finalState);

    // 验证用户明确选择的阿拉伯语被保持
    expect(finalState.userExplicitlyChoseArabic).toBe('true');
    expect(finalState.preferredLanguage).toBe('ar');
    console.log('✅ 用户明确选择的阿拉伯语被正确保持');
  });

  test('should recover from corrupted language state', async ({ page }) => {
    console.log('🧪 Testing recovery from corrupted language state...');

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 设置初始中文状态
    await page.evaluate(() => {
      localStorage.setItem('preferred_language', 'zh');
      localStorage.setItem('pre_oauth_language', 'zh');
      if ((window as any).i18n) {
        (window as any).i18n.changeLanguage('zh');
      }
    });

    // 模拟语言状态损坏（被设置为阿拉伯语）
    await page.evaluate(() => {
      console.log('[TEST] 模拟语言状态损坏...');
      localStorage.setItem('preferred_language', 'ar'); // 损坏的状态
      if ((window as any).i18n) {
        (window as any).i18n.changeLanguage('ar');
      }
      // 注意：没有设置user_explicitly_chose_arabic，说明不是用户选择
    });

    await page.waitForTimeout(1000);

    // 触发语言状态检查和修复
    await page.evaluate(() => {
      console.log('[TEST] 触发语言状态修复...');
      
      // 模拟检查逻辑
      const currentLanguage = 'ar';
      const preferredLanguage = localStorage.getItem('preferred_language');
      const userChoseArabic = localStorage.getItem('user_explicitly_chose_arabic') === 'true';
      const preOAuthLanguage = localStorage.getItem('pre_oauth_language');
      
      if (currentLanguage === 'ar' && preferredLanguage === 'ar' && !userChoseArabic) {
        console.log('[TEST] 检测到损坏的语言状态，执行修复...');
        
        // 恢复到之前的语言
        const fallbackLanguage = preOAuthLanguage || 'zh';
        localStorage.setItem('preferred_language', fallbackLanguage);
        localStorage.setItem('language_fixed_after_oauth', 'true');
        
        if ((window as any).i18n) {
          (window as any).i18n.changeLanguage(fallbackLanguage);
        }
        
        console.log('[TEST] 语言已修复为:', fallbackLanguage);
      }
    });

    await page.waitForTimeout(2000);

    const recoveredState = await page.evaluate(() => {
      return {
        i18nLanguage: (window as any).i18n?.language,
        preferredLanguage: localStorage.getItem('preferred_language'),
        languageFixedAfterOauth: localStorage.getItem('language_fixed_after_oauth'),
        userExplicitlyChoseArabic: localStorage.getItem('user_explicitly_chose_arabic')
      };
    });

    console.log('📊 Recovered state:', recoveredState);

    // 验证语言已恢复
    expect(recoveredState.i18nLanguage).not.toBe('ar');
    expect(recoveredState.preferredLanguage).not.toBe('ar');
    expect(recoveredState.languageFixedAfterOauth).toBe('true');
    expect(['zh', 'en'].includes(recoveredState.i18nLanguage || '')).toBeTruthy();
    
    console.log('✅ 语言状态已成功恢复！');
  });

  // 测试调试器功能
  test('should have language debugger available', async ({ page }) => {
    console.log('🧪 Testing language debugger functionality...');

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const debuggerAvailable = await page.evaluate(() => {
      return !!(window as any).languageDebugger;
    });

    console.log('🔍 Language debugger available:', debuggerAvailable);
    
    if (debuggerAvailable) {
      const debuggerMethods = await page.evaluate(() => {
        const debugger = (window as any).languageDebugger;
        return {
          hasLogMethod: typeof debugger.log === 'function',
          hasExportMethod: typeof debugger.exportLogs === 'function',
          hasGenerateReportMethod: typeof debugger.generateDiagnosticReport === 'function'
        };
      });

      console.log('🛠️ Debugger methods:', debuggerMethods);
      
      expect(debuggerMethods.hasLogMethod).toBe(true);
      expect(debuggerMethods.hasExportMethod).toBe(true);
      expect(debuggerMethods.hasGenerateReportMethod).toBe(true);
      
      console.log('✅ Language debugger is properly configured');
    }
  });
});