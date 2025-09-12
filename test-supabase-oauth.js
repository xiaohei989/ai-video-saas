#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🧪 Supabase OAuth配置测试');
console.log('==========================\n');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Supabase环境变量未设置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log(`✅ Supabase URL: ${supabaseUrl}`);
console.log(`✅ Supabase Key: ${supabaseKey.substring(0, 20)}...`);

// 测试Apple OAuth配置
async function testAppleOAuth() {
  console.log('\n🍎 测试Apple OAuth配置...');
  
  try {
    // 尝试启动Apple OAuth流程（但不实际重定向）
    const result = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${supabaseUrl}/auth/v1/callback`,
        skipBrowserRedirect: true // 重要：跳过浏览器重定向
      }
    });

    if (result.error) {
      console.log(`❌ Apple OAuth错误: ${result.error.message}`);
      
      // 分析错误类型
      if (result.error.message.includes('Provider apple is not enabled')) {
        console.log('💡 建议: 在Supabase Dashboard中启用Apple OAuth提供商');
      } else if (result.error.message.includes('Invalid configuration')) {
        console.log('💡 建议: 检查Apple OAuth配置（Client ID, Client Secret）');
      }
    } else if (result.data.url) {
      console.log('✅ Apple OAuth提供商已启用');
      console.log(`✅ 授权URL已生成: ${result.data.url.substring(0, 100)}...`);
      
      // 解析授权URL参数
      const url = new URL(result.data.url);
      console.log(`✅ Client ID: ${url.searchParams.get('client_id')}`);
      console.log(`✅ Redirect URI: ${url.searchParams.get('redirect_uri')}`);
      console.log(`✅ Response Mode: ${url.searchParams.get('response_mode') || 'query (默认)'}`);
      console.log(`✅ Scope: ${url.searchParams.get('scope')}`);
    }
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
  }
}

// 测试session状态
async function testSession() {
  console.log('\n🔒 测试当前会话状态...');
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log(`❌ 会话检查错误: ${error.message}`);
    } else if (session) {
      console.log('✅ 检测到活动会话');
      console.log(`   用户: ${session.user.email}`);
      console.log(`   提供商: ${session.user.app_metadata.provider || 'email'}`);
      console.log(`   过期时间: ${new Date(session.expires_at * 1000).toISOString()}`);
    } else {
      console.log('ℹ️ 当前无活动会话');
    }
  } catch (error) {
    console.log(`❌ 会话测试失败: ${error.message}`);
  }
}

// 运行测试
async function runTests() {
  await testSession();
  await testAppleOAuth();
  
  console.log('\n📋 总结:');
  console.log('如果Apple OAuth提供商已启用，问题可能在于:');
  console.log('1. Apple Developer Console中重定向URL配置');
  console.log('2. form_post模式的特殊处理需求');
  console.log('3. 网络延迟或CORS问题');
}

runTests().catch(console.error);