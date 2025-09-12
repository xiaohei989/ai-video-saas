#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 详细检查Apple OAuth授权URL');
console.log('=================================\n');

async function analyzeOAuthURL() {
  try {
    const result = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback',
        skipBrowserRedirect: true
      }
    });

    if (result.data.url) {
      console.log('🔗 完整授权URL:');
      console.log(result.data.url);
      console.log('\n📋 URL参数解析:');
      
      const url = new URL(result.data.url);
      console.log(`主机: ${url.hostname}`);
      console.log(`路径: ${url.pathname}`);
      
      // 解析所有查询参数
      const params = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      
      console.log('\n参数详情:');
      Object.entries(params).forEach(([key, value]) => {
        if (key === 'state' && value.length > 50) {
          console.log(`${key}: ${value.substring(0, 50)}... (JWT token)`);
        } else {
          console.log(`${key}: ${value}`);
        }
      });
      
      // 检查是否是Apple的授权端点
      if (url.hostname === 'appleid.apple.com') {
        console.log('\n✅ 正确重定向到Apple授权端点');
      } else {
        console.log(`\n❌ 未重定向到Apple，而是: ${url.hostname}`);
      }
      
      // 检查关键参数
      console.log('\n🔍 关键参数检查:');
      const clientId = params.client_id;
      const redirectUri = params.redirect_uri;
      const responseMode = params.response_mode;
      
      if (clientId === 'com.veo3video.webapp.web') {
        console.log('✅ Client ID正确');
      } else {
        console.log(`❌ Client ID不匹配: 期望 'com.veo3video.webapp.web', 实际 '${clientId}'`);
      }
      
      if (redirectUri && redirectUri.includes('supabase.co/auth/v1/callback')) {
        console.log('✅ Redirect URI指向Supabase回调');
      } else {
        console.log(`❌ Redirect URI异常: ${redirectUri}`);
      }
      
      if (responseMode === 'form_post') {
        console.log('✅ Response Mode设置为form_post');
      } else {
        console.log(`⚠️ Response Mode为: ${responseMode || 'query'} (应该是form_post)`);
      }
    }
    
  } catch (error) {
    console.log(`❌ 分析失败: ${error.message}`);
  }
}

analyzeOAuthURL().catch(console.error);