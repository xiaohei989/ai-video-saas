#!/usr/bin/env node

/**
 * Apple OAuth Client Secret (JWT) 生成工具
 * 
 * 使用方法：
 * node scripts/generate-apple-jwt.js
 * 
 * 从.env文件读取配置信息：
 * - APPLE_TEAM_ID
 * - APPLE_KEY_ID
 * - APPLE_PRIVATE_KEY
 * - APPLE_CLIENT_ID
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateAppleClientSecret(config) {
  const {
    teamId,
    keyId, 
    privateKey,
    clientId
  } = config;

  // JWT Header
  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT'
  };

  // JWT Payload
  const payload = {
    iss: teamId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (6 * 30 * 24 * 60 * 60), // 6个月后过期
    aud: 'https://appleid.apple.com',
    sub: clientId
  };

  // 编码Header和Payload
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  // 创建签名
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  
  // 确保私钥格式正确
  const formattedPrivateKey = privateKey.includes('-----BEGIN PRIVATE KEY-----') 
    ? privateKey 
    : `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    
  const signature = crypto
    .createSign('sha256')
    .update(signingInput)
    .sign(formattedPrivateKey, 'base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// 读取.env文件
function loadEnvFile() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('找不到.env文件');
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=');
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    }
  }
  
  return env;
}

try {
  // 从.env文件加载配置
  const env = loadEnvFile();
  
  // 直接从.p8文件读取私钥
  const p8FilePath = path.resolve(__dirname, '../AuthKey_AM2T6V5BK2.p8');
  let privateKey;
  
  if (fs.existsSync(p8FilePath)) {
    privateKey = fs.readFileSync(p8FilePath, 'utf8');
    console.log('✅ 从.p8文件读取私钥');
  } else {
    privateKey = env.APPLE_PRIVATE_KEY;
    console.log('✅ 从.env文件读取私钥');
  }
  
  const config = {
    teamId: env.APPLE_TEAM_ID || 'Y544ALSVAS',
    keyId: env.APPLE_KEY_ID || 'AM2T6V5BK2',
    privateKey: privateKey,
    clientId: env.APPLE_CLIENT_ID || 'com.veo3video.webapp.web'
  };

  // 验证配置
  if (!config.teamId || !config.keyId || !config.privateKey || !config.clientId) {
    console.log('❌ 缺少必要的Apple OAuth配置:');
    console.log('- APPLE_TEAM_ID:', config.teamId ? '✅' : '❌');
    console.log('- APPLE_KEY_ID:', config.keyId ? '✅' : '❌');
    console.log('- APPLE_PRIVATE_KEY:', config.privateKey ? '✅' : '❌');
    console.log('- APPLE_CLIENT_ID:', config.clientId ? '✅' : '❌');
    process.exit(1);
  }

  const clientSecret = generateAppleClientSecret(config);
  
  console.log('✅ Apple OAuth Client Secret 生成成功!');
  console.log('');
  console.log('Client ID:', config.clientId);
  console.log('Client Secret:', clientSecret);
  console.log('');
  console.log('请将以上信息复制到Supabase Dashboard的Apple Provider配置中');
  
} catch (error) {
  console.error('❌ 生成Client Secret失败:', error.message);
  console.log('');
  console.log('常见问题:');
  console.log('1. 确保Private Key格式正确');
  console.log('2. 确保Team ID和Key ID长度正确(都是10位)');
  console.log('3. 确保使用了正确的.p8文件内容');
}