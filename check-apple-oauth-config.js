#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 检查Apple OAuth配置状态');
console.log('===========================\n');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ 缺少Supabase环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAppleOAuthConfig() {
  console.log('1️⃣ 项目信息:');
  console.log(`   Supabase URL: ${supabaseUrl}`);
  console.log(`   项目引用ID: hvkzwrnvxsleeonqqrzq\n`);
  
  console.log('2️⃣ 测试Apple OAuth URL生成...\n');
  
  // 测试多种重定向URL
  const testCases = [
    'http://localhost:3000/auth/callback',
    'https://hvkzwrnvxsleeonqqrzq.supabase.co/auth/v1/callback'
  ];
  
  for (const redirectTo of testCases) {
    console.log(`📋 测试重定向: ${redirectTo}`);
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo,
          skipBrowserRedirect: true
        }
      });
      
      if (error) {
        console.log(`   ❌ 错误: ${error.message}`);
        
        if (error.message.includes('Provider apple is disabled')) {
          console.log('   💡 Apple OAuth提供商被禁用');
          console.log('   🔧 需要在Supabase Dashboard中启用Apple提供商');
        }
        
        if (error.message.includes('not configured')) {
          console.log('   💡 Apple OAuth未配置');
          console.log('   🔧 需要配置Client ID和Client Secret');
        }
        
        continue;
      }
      
      if (data.url) {
        const url = new URL(data.url);
        
        console.log(`   ✅ URL生成成功`);
        console.log(`   🌐 主机: ${url.hostname}`);
        console.log(`   📍 路径: ${url.pathname}`);
        
        // 详细参数分析
        const params = {};
        url.searchParams.forEach((value, key) => {
          params[key] = value;
        });
        
        console.log(`   🔑 Client ID: ${params.client_id || 'null'}`);
        console.log(`   🔄 Response Mode: ${params.response_mode || 'query'}`);
        console.log(`   📮 Redirect URI: ${params.redirect_uri || 'null'}`);
        console.log(`   🎯 Provider: ${params.provider || 'unknown'}`);
        
        if (url.hostname === 'appleid.apple.com') {
          console.log('   ✅ 正确指向Apple授权端点');
          
          if (params.client_id === 'com.veo3video.webapp.web') {
            console.log('   ✅ Client ID配置正确');
          } else {
            console.log(`   ❌ Client ID不匹配: 期望 'com.veo3video.webapp.web', 实际 '${params.client_id}'`);
          }
          
          if (params.response_mode === 'form_post') {
            console.log('   ✅ Response Mode配置正确');
          } else {
            console.log(`   ⚠️  Response Mode: ${params.response_mode} (应该是 form_post)`);
          }
          
        } else {
          console.log(`   ❌ 未指向Apple: ${url.hostname}`);
          console.log('   💡 这表示Apple OAuth提供商配置不完整');
        }
        
      } else {
        console.log('   ❌ 未生成授权URL');
      }
      
    } catch (error) {
      console.log(`   ❌ 异常: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('3️⃣ 配置诊断结果:');
  
  // 基于测试结果给出诊断
  const { data: testData, error: testError } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: 'http://localhost:3000/auth/callback',
      skipBrowserRedirect: true
    }
  });
  
  if (testError) {
    console.log('❌ Apple OAuth提供商存在配置问题');
    console.log('🔧 推荐解决方案:');
    console.log('   1. 登录Supabase Dashboard');
    console.log('   2. 前往 Authentication > Providers');  
    console.log('   3. 启用Apple提供商');
    console.log('   4. 配置:');
    console.log('      - Client ID: com.veo3video.webapp.web');
    console.log('      - Client Secret: [Apple JWT Token]');
    console.log('      - Redirect URL: https://hvkzwrnvxsleeonqqrzq.supabase.co/auth/v1/callback');
    
  } else if (testData.url && !testData.url.includes('appleid.apple.com')) {
    console.log('⚠️  Apple OAuth提供商已启用但配置不完整');
    console.log('🔧 推荐解决方案:');
    console.log('   1. 验证Client ID和Client Secret已正确填入');
    console.log('   2. 确保Apple Developer Console中Service ID配置正确');  
    console.log('   3. 等待1-2分钟让配置生效');
    
  } else if (testData.url && testData.url.includes('appleid.apple.com')) {
    console.log('✅ Apple OAuth配置正确，可以开始测试授权流程');
    
  } else {
    console.log('❓ 无法确定配置状态，建议手动检查');
  }
}

checkAppleOAuthConfig().catch(console.error);