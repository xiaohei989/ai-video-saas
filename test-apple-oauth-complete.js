#!/usr/bin/env node

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🍎 Apple OAuth 完整流程测试');
console.log('=============================\n');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ 缺少Supabase环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCompleteAppleOAuth() {
  let browser;
  let page;
  
  try {
    console.log('1️⃣ 启动浏览器...');
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 1000
    });
    
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 }
    });
    
    page = await context.newPage();
    
    // 监听控制台日志
    page.on('console', (msg) => {
      if (msg.text().includes('[AUTH]') || msg.text().includes('OAuth')) {
        console.log(`🖥️  浏览器日志: ${msg.text()}`);
      }
    });
    
    // 监听网络请求
    page.on('request', (request) => {
      if (request.url().includes('apple') || request.url().includes('auth')) {
        console.log(`📡 网络请求: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', (response) => {
      if (response.url().includes('apple') || response.url().includes('auth')) {
        console.log(`📥 网络响应: ${response.status()} ${response.url()}`);
      }
    });
    
    console.log('2️⃣ 访问应用首页...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    
    // 检查初始状态
    console.log('3️⃣ 检查初始登录状态...');
    const initialAuthState = await page.evaluate(() => {
      // 简化选择器，避免CSS4语法
      const loginButton = document.querySelector('[data-testid="login-button"]') || 
                         document.querySelector('button[aria-label*="登录"]') ||
                         Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('登录'));
      
      const userAvatar = document.querySelector('[data-testid="user-avatar"]') || 
                        document.querySelector('.user-avatar');
      
      return {
        hasLoginButton: !!loginButton,
        hasUserAvatar: !!userAvatar,
        currentPath: window.location.pathname,
        localStorageKeys: Object.keys(localStorage),
        hasSupabaseSession: localStorage.getItem('sb-hvkzwrnvxsleeonqqrzq-auth-token') ? true : false
      };
    });
    
    console.log(`   路径: ${initialAuthState.currentPath}`);
    console.log(`   有登录按钮: ${initialAuthState.hasLoginButton}`);
    console.log(`   有用户头像: ${initialAuthState.hasUserAvatar}`);
    console.log(`   有会话: ${initialAuthState.hasSupabaseSession}`);
    
    if (initialAuthState.hasUserAvatar) {
      console.log('⚠️  用户似乎已登录，先退出...');
      // 尝试退出登录 - 使用更兼容的选择器
      const logoutButtons = await page.locator('button').all();
      for (const button of logoutButtons) {
        const text = await button.textContent();
        if (text && (text.includes('退出') || text.includes('登出'))) {
          await button.click();
          await page.waitForTimeout(1000);
          break;
        }
      }
    }
    
    console.log('4️⃣ 寻找登录按钮...');
    await page.waitForTimeout(2000);
    
    // 多种方式查找登录按钮
    let loginButton = page.locator('[data-testid="login-button"]');
    if (await loginButton.count() === 0) {
      // 从截图中看到右上角有"Sign In"按钮
      loginButton = page.locator('text="Sign In"').first();
    }
    
    // 如果还是找不到，尝试其他方式
    if (await loginButton.count() === 0) {
      const buttons = await page.locator('button, a').all();
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && (text.includes('登录') || text.includes('Sign In'))) {
          loginButton = btn;
          break;
        }
      }
    }
    
    if (await loginButton.count() === 0) {
      // 截图调试
      await page.screenshot({ path: 'debug-no-login-button.png', fullPage: true });
      console.log('❌ 找不到登录按钮，已保存截图到 debug-no-login-button.png');
      
      const allButtons = await page.locator('button, a[href*="login"]').allTextContents();
      console.log('   页面上的按钮:', allButtons);
      return;
    }
    
    console.log('5️⃣ 点击登录按钮...');
    await loginButton.first().click();
    await page.waitForTimeout(2000);
    
    console.log('6️⃣ 查找Apple登录按钮...');
    
    // 等待登录模态框加载
    await page.waitForSelector('[role="dialog"], .modal, .login-modal', { timeout: 5000 }).catch(() => {
      console.log('   未检测到登录模态框');
    });
    
    await page.waitForTimeout(1000);
    
    // 使用更兼容的方式查找Apple按钮
    let appleButton = null;
    const allButtons = await page.locator('button').all();
    
    for (const btn of allButtons) {
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      
      if ((text && (text.includes('Apple') || text.includes('苹果'))) ||
          (ariaLabel && ariaLabel.includes('Apple'))) {
        appleButton = btn;
        break;
      }
    }
    
    // 如果没找到，尝试查找包含Apple图标的按钮
    if (!appleButton) {
      const buttonsWithSvg = await page.locator('button svg').all();
      for (const svg of buttonsWithSvg) {
        const svgContent = await svg.innerHTML();
        if (svgContent.includes('Apple') || svgContent.includes('apple')) {
          appleButton = svg.locator('xpath=ancestor::button[1]');
          break;
        }
      }
    }
    
    if (!appleButton) {
      await page.screenshot({ path: 'debug-no-apple-button.png', fullPage: true });
      console.log('❌ 找不到Apple登录按钮，已保存截图到 debug-no-apple-button.png');
      
      const allButtons = await page.locator('button').allTextContents();
      console.log('   页面上的按钮:', allButtons);
      return;
    }
    
    console.log('7️⃣ 点击Apple登录按钮...');
    
    // 在点击之前，先测试OAuth URL生成
    console.log('8️⃣ 验证OAuth URL生成...');
    const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback',
        skipBrowserRedirect: true
      }
    });
    
    if (oauthError) {
      console.log(`❌ OAuth URL生成失败: ${oauthError.message}`);
      return;
    }
    
    if (oauthData.url) {
      const url = new URL(oauthData.url);
      console.log(`   OAuth URL主机: ${url.hostname}`);
      console.log(`   Client ID: ${url.searchParams.get('client_id')}`);
      console.log(`   Response Mode: ${url.searchParams.get('response_mode')}`);
      
      if (url.hostname !== 'appleid.apple.com') {
        console.log('❌ OAuth URL未指向Apple，配置可能有问题');
        console.log(`   完整URL: ${oauthData.url}`);
        return;
      } else {
        console.log('✅ OAuth URL配置正确');
      }
    }
    
    // 点击Apple登录按钮
    await appleButton.click();
    console.log('⏳ 等待重定向到Apple...');
    
    // 等待页面跳转到Apple或处理重定向
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`9️⃣ 当前URL: ${currentUrl}`);
    
    if (currentUrl.includes('appleid.apple.com')) {
      console.log('✅ 成功重定向到Apple授权页面');
      
      // 截图保存Apple授权页面
      await page.screenshot({ path: 'apple-oauth-page.png', fullPage: true });
      console.log('📸 已保存Apple授权页面截图: apple-oauth-page.png');
      
      console.log('🔟 Apple OAuth流程测试完成');
      console.log('✅ 结果: Apple OAuth重定向正常工作');
      console.log('⚠️  后续需要手动测试完整的授权和回调流程');
      
    } else if (currentUrl.includes('localhost:3000')) {
      console.log('⚠️  仍在本地页面，可能是配置问题或重定向失败');
      
      // 检查控制台错误
      const consoleErrors = await page.evaluate(() => {
        const errors = [];
        console.error = (function(originalConsoleError) {
          return function(...args) {
            errors.push(args.join(' '));
            return originalConsoleError.apply(this, arguments);
          };
        })(console.error);
        return errors;
      });
      
      console.log('控制台错误:', consoleErrors);
      
      await page.screenshot({ path: 'apple-oauth-failed.png', fullPage: true });
      console.log('📸 已保存失败页面截图: apple-oauth-failed.png');
      
    } else {
      console.log('❓ 重定向到了未预期的页面');
      await page.screenshot({ path: 'apple-oauth-unexpected.png', fullPage: true });
    }
    
  } catch (error) {
    console.log(`❌ 测试过程中出错: ${error.message}`);
    if (page) {
      await page.screenshot({ path: 'apple-oauth-error.png', fullPage: true });
      console.log('📸 已保存错误页面截图: apple-oauth-error.png');
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testCompleteAppleOAuth().catch(console.error);