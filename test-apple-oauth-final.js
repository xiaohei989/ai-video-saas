#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🍎 最终Apple OAuth配置测试');
console.log('==============================\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAppleOAuthFinal() {
  console.log('1️⃣ 测试Apple OAuth提供商状态...');
  
  try {
    // 尝试生成Apple OAuth URL
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback',
        skipBrowserRedirect: true
      }
    });

    if (error) {
      console.log(`❌ Apple OAuth错误: ${error.message}`);
      
      if (error.message.includes('Provider apple is not enabled')) {
        console.log('💡 Apple OAuth提供商未启用 - 配置可能还未生效');
        console.log('💡 请等待几分钟后重试');
        return;
      }
      
      return;
    }

    console.log(`✅ Apple OAuth URL生成成功: ${data.url.length > 100 ? 'URL过长，截断显示' : data.url}`);
    
    // 详细分析URL
    const url = new URL(data.url);
    console.log('\n2️⃣ URL详细分析:');
    console.log(`主机: ${url.hostname}`);
    console.log(`路径: ${url.pathname}`);
    
    if (url.hostname === 'appleid.apple.com') {
      console.log('✅ 正确重定向到Apple授权端点！');
      
      // 检查关键参数
      const clientId = url.searchParams.get('client_id');
      const responseMode = url.searchParams.get('response_mode');
      const redirectUri = url.searchParams.get('redirect_uri');
      
      console.log('\n3️⃣ 关键参数检查:');
      console.log(`Client ID: ${clientId}`);
      console.log(`Response Mode: ${responseMode}`);
      console.log(`Redirect URI: ${redirectUri}`);
      
      if (clientId === 'com.veo3video.webapp.web') {
        console.log('✅ Client ID正确');
      } else {
        console.log('❌ Client ID不正确');
      }
      
      if (responseMode === 'form_post') {
        console.log('✅ Response Mode正确设置为form_post');
      } else {
        console.log('⚠️ Response Mode不是form_post');
      }
      
      if (redirectUri && redirectUri.includes('supabase.co')) {
        console.log('✅ Redirect URI指向Supabase');
      } else {
        console.log('❌ Redirect URI异常');
      }
      
    } else {
      console.log(`❌ 未重定向到Apple，而是: ${url.hostname}`);
      console.log('💡 这表示配置可能还未完全生效');
    }
    
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
  }
}

// 等待几秒后开始测试
console.log('⏳ 等待配置生效...');
setTimeout(async () => {
  await testAppleOAuthFinal();
  
  console.log('\n📋 测试总结:');
  console.log('如果看到Apple授权URL，说明配置成功！');
  console.log('如果仍然显示Supabase URL，请等待几分钟后重试。');
  console.log('Supabase配置更新通常需要1-2分钟生效。');
}, 3000);