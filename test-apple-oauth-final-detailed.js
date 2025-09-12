#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🍎 Apple OAuth 最终详细诊断');
console.log('=============================\n');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ 缺少Supabase环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticAppleOAuth() {
  console.log('📋 当前配置信息:');
  console.log(`   项目URL: ${supabaseUrl}`);
  console.log(`   项目ID: hvkzwrnvxsleeonqqrzq`);
  console.log('');

  console.log('🔍 测试不同的OAuth配置...\n');

  // 测试1: 基本Apple OAuth
  console.log('1️⃣ 测试基本Apple OAuth URL生成');
  try {
    const result1 = await supabase.auth.signInWithOAuth({
      provider: 'apple'
    });
    
    if (result1.error) {
      console.log(`   ❌ 错误: ${result1.error.message}`);
    } else if (result1.data.url) {
      console.log(`   🔗 生成的URL: ${result1.data.url.substring(0, 100)}...`);
      const url1 = new URL(result1.data.url);
      console.log(`   🌐 主机: ${url1.hostname}`);
      console.log(`   🔑 Provider: ${url1.searchParams.get('provider')}`);
    }
  } catch (error) {
    console.log(`   ❌ 异常: ${error.message}`);
  }
  console.log('');

  // 测试2: 带skipBrowserRedirect的Apple OAuth
  console.log('2️⃣ 测试带skipBrowserRedirect的Apple OAuth');
  try {
    const result2 = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        skipBrowserRedirect: true
      }
    });
    
    if (result2.error) {
      console.log(`   ❌ 错误: ${result2.error.message}`);
    } else if (result2.data.url) {
      const url2 = new URL(result2.data.url);
      console.log(`   🌐 主机: ${url2.hostname}`);
      
      if (url2.hostname === 'appleid.apple.com') {
        console.log('   ✅ 成功！URL指向Apple');
        console.log(`   🔑 Client ID: ${url2.searchParams.get('client_id')}`);
        console.log(`   📮 Redirect URI: ${url2.searchParams.get('redirect_uri')}`);
        console.log(`   🔄 Response Mode: ${url2.searchParams.get('response_mode')}`);
        console.log(`   🎯 State: ${url2.searchParams.get('state') ? 'present' : 'null'}`);
        console.log(`   📝 Scope: ${url2.searchParams.get('scope')}`);
      } else {
        console.log(`   ❌ 仍指向: ${url2.hostname}`);
        console.log('   💡 Dashboard配置可能需要更多时间生效');
      }
    }
  } catch (error) {
    console.log(`   ❌ 异常: ${error.message}`);
  }
  console.log('');

  // 测试3: 带完整选项的Apple OAuth
  console.log('3️⃣ 测试带完整选项的Apple OAuth');
  try {
    const result3 = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback',
        skipBrowserRedirect: true,
        scopes: 'name email'
      }
    });
    
    if (result3.error) {
      console.log(`   ❌ 错误: ${result3.error.message}`);
    } else if (result3.data.url) {
      const url3 = new URL(result3.data.url);
      console.log(`   🌐 主机: ${url3.hostname}`);
      
      if (url3.hostname === 'appleid.apple.com') {
        console.log('   ✅ 成功！完整配置工作正常');
      } else {
        console.log('   ⚠️ 仍在等待配置生效');
      }
    }
  } catch (error) {
    console.log(`   ❌ 异常: ${error.message}`);
  }
  console.log('');

  // 测试4: 检查auth状态
  console.log('4️⃣ 检查当前auth状态');
  try {
    const { data: session } = await supabase.auth.getSession();
    console.log(`   📊 当前会话: ${session.session ? '有活跃会话' : '无会话'}`);
    
    const { data: user } = await supabase.auth.getUser();
    console.log(`   👤 当前用户: ${user.user ? user.user.email || '匿名用户' : '未登录'}`);
  } catch (error) {
    console.log(`   ❌ 获取auth状态失败: ${error.message}`);
  }
  console.log('');

  // 总结诊断
  console.log('📊 诊断总结:');
  console.log('如果所有测试都显示URL指向Supabase而非Apple，可能的原因:');
  console.log('1. Dashboard配置保存失败 - 请重新检查Dashboard');
  console.log('2. 配置同步延迟 - 可能需要5-10分钟');  
  console.log('3. 浏览器缓存问题 - 尝试无痕模式');
  console.log('4. Apple Developer Console配置问题');
  console.log('5. 需要重启Supabase服务');
}

diagnosticAppleOAuth().catch(console.error);