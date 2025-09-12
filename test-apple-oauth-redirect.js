#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🍎 Apple OAuth重定向URL测试');
console.log('=================================\n');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Supabase环境变量未设置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAppleRedirectUrls() {
  try {
    console.log('🔍 生成Apple OAuth授权URL...\n');
    
    // 测试不同的重定向URL
    const redirectUrls = [
      'http://localhost:3000/auth/callback',
      'http://127.0.0.1:3000/auth/callback', 
      `${supabaseUrl}/auth/v1/callback`
    ];
    
    for (const redirectTo of redirectUrls) {
      console.log(`📋 测试重定向URL: ${redirectTo}`);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo,
          skipBrowserRedirect: true
        }
      });
      
      if (error) {
        console.log(`❌ 错误: ${error.message}`);
        continue;
      }
      
      if (data.url) {
        const url = new URL(data.url);
        
        console.log(`✅ URL生成成功`);
        console.log(`   主机: ${url.hostname}`);
        console.log(`   Client ID: ${url.searchParams.get('client_id')}`);
        console.log(`   Redirect URI: ${url.searchParams.get('redirect_uri')}`);
        console.log(`   Response Mode: ${url.searchParams.get('response_mode')}`);
        
        // 检查重定向URI是否正确
        const actualRedirectUri = url.searchParams.get('redirect_uri');
        if (actualRedirectUri && actualRedirectUri.includes('supabase.co')) {
          console.log(`✅ 重定向URI正确指向Supabase`);
        } else {
          console.log(`⚠️ 重定向URI可能有问题: ${actualRedirectUri}`);
        }
        
        if (url.hostname === 'appleid.apple.com') {
          console.log(`✅ 正确重定向到Apple`);
        } else {
          console.log(`❌ 未重定向到Apple: ${url.hostname}`);
        }
        
        console.log('');
      }
    }
    
    console.log('🔧 Apple Developer Console检查清单:');
    console.log('1. 确认Service ID: com.veo3video.webapp.web');
    console.log('2. 确认重定向URL已配置:');
    console.log(`   - ${supabaseUrl}/auth/v1/callback`);
    console.log('3. 确认"Sign In with Apple"已启用');
    console.log('4. 确认域名配置正确');
    
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
  }
}

testAppleRedirectUrls().catch(console.error);