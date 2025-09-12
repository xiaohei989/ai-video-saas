#!/usr/bin/env node

console.log('🔍 Apple OAuth配置诊断工具');
console.log('================================\n');

// 检查环境变量
const requiredEnvVars = [
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID', 
  'APPLE_CLIENT_ID',
  'APPLE_PRIVATE_KEY',
  'APPLE_CLIENT_SECRET',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
];

console.log('📋 环境变量检查:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    if (varName.includes('KEY') || varName.includes('SECRET')) {
      console.log(`✅ ${varName}: ${value.substring(0, 20)}...（已截断）`);
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  } else {
    console.log(`❌ ${varName}: 未设置`);
  }
});

console.log('\n🔧 Apple OAuth配置分析:');

// 验证Client Secret JWT格式
const clientSecret = process.env.APPLE_CLIENT_SECRET;
if (clientSecret) {
  try {
    const parts = clientSecret.split('.');
    if (parts.length === 3) {
      console.log('✅ Client Secret JWT格式正确（3个部分）');
      
      // 解码header
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      console.log(`✅ JWT Header: ${JSON.stringify(header)}`);
      
      // 解码payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      console.log(`✅ JWT Payload: ${JSON.stringify(payload)}`);
      
      // 检查过期时间
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp > now) {
        console.log(`✅ JWT未过期 (过期时间: ${new Date(payload.exp * 1000).toISOString()})`);
      } else {
        console.log(`❌ JWT已过期 (过期时间: ${new Date(payload.exp * 1000).toISOString()})`);
      }
    } else {
      console.log('❌ Client Secret JWT格式错误');
    }
  } catch (error) {
    console.log(`❌ Client Secret解析失败: ${error.message}`);
  }
} else {
  console.log('❌ Client Secret未设置');
}

console.log('\n🌐 重定向URL验证:');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
  const expectedRedirectUrl = `${supabaseUrl}/auth/v1/callback`;
  console.log(`✅ 预期的重定向URL: ${expectedRedirectUrl}`);
  
  // 检查URL格式
  try {
    new URL(expectedRedirectUrl);
    console.log('✅ 重定向URL格式有效');
  } catch {
    console.log('❌ 重定向URL格式无效');
  }
} else {
  console.log('❌ Supabase URL未设置');
}

console.log('\n📝 建议检查项目:');
console.log('1. 在Apple Developer Console中验证:');
console.log('   - Client ID是否正确');
console.log('   - 重定向URL是否已配置');
console.log('   - 服务ID是否启用');
console.log('2. 在Supabase Dashboard中验证:');
console.log('   - Apple OAuth提供商是否启用');
console.log('   - Client ID和Client Secret是否正确');
console.log('3. 检查网络连接和CORS设置');

console.log('\n🔚 诊断完成');