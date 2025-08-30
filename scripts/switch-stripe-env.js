#!/usr/bin/env node

/**
 * 增强版Stripe环境切换脚本
 * 支持测试和生产环境的一键切换，自动更新配置文件
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');
const ENV_TEST_FILE = path.join(__dirname, '..', '.env.test');
const ENV_PROD_FILE = path.join(__dirname, '..', '.env.production');

/**
 * 读取环境文件
 */
function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=');
      env[key] = value;
    }
  });
  
  return env;
}

/**
 * 写入环境文件
 */
function writeEnvFile(filePath, env) {
  const content = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n') + '\n';
  
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * 更新主.env文件中的活动配置
 */
function updateActiveConfig(mode) {
  // 读取主配置文件
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  let lines = envContent.split('\n');
  
  // 读取源配置
  const sourceEnv = readEnvFile(mode === 'test' ? ENV_TEST_FILE : ENV_PROD_FILE);
  
  // 更新模式标志
  lines = lines.map(line => {
    if (line.startsWith('VITE_STRIPE_MODE=')) {
      return `VITE_STRIPE_MODE=${mode}`;
    }
    if (line.startsWith('STRIPE_MODE=')) {
      return `STRIPE_MODE=${mode}`;
    }
    return line;
  });
  
  // 找到当前活动配置区域的开始和结束
  const activeStartIndex = lines.findIndex(line => 
    line.includes('当前活动的Stripe配置') || line.includes('current active Stripe config')
  );
  
  if (activeStartIndex === -1) {
    throw new Error('找不到活动配置区域标记');
  }
  
  // 更新活动配置
  const configsToUpdate = [
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY', 
    'STRIPE_WEBHOOK_SIGNING_SECRET',
    'VITE_STRIPE_BASIC_PRICE_ID',
    'VITE_STRIPE_PRO_PRICE_ID',
    'VITE_STRIPE_ENTERPRISE_PRICE_ID'
  ];
  
  lines = lines.map(line => {
    const trimmedLine = line.trim();
    for (const configKey of configsToUpdate) {
      if (trimmedLine.startsWith(`${configKey}=`)) {
        const newValue = sourceEnv[configKey];
        if (newValue) {
          return `${configKey}=${newValue}`;
        }
      }
    }
    return line;
  });
  
  // 写回文件
  fs.writeFileSync(ENV_FILE, lines.join('\n'), 'utf8');
}

/**
 * 获取当前环境模式
 */
function getCurrentMode() {
  const env = readEnvFile(ENV_FILE);
  return env.VITE_STRIPE_MODE || env.STRIPE_MODE || 'test';
}

/**
 * 验证配置一致性
 */
function validateConfig(mode) {
  const errors = [];
  const env = readEnvFile(ENV_FILE);
  
  const publishableKey = env.VITE_STRIPE_PUBLISHABLE_KEY || '';
  const secretKey = env.STRIPE_SECRET_KEY || '';
  const webhookSecret = env.STRIPE_WEBHOOK_SIGNING_SECRET || '';
  
  // 验证密钥格式
  if (!publishableKey.startsWith('pk_')) {
    errors.push('无效的Stripe公钥格式');
  }
  
  if (!secretKey.startsWith('sk_')) {
    errors.push('无效的Stripe私钥格式');
  }
  
  if (!webhookSecret.startsWith('whsec_')) {
    errors.push('无效的Webhook签名密钥格式');
  }
  
  // 验证环境一致性
  const isTestPublishable = publishableKey.startsWith('pk_test_');
  const isLivePublishable = publishableKey.startsWith('pk_live_');
  const isTestSecret = secretKey.startsWith('sk_test_');
  const isLiveSecret = secretKey.startsWith('sk_live_');
  
  if (mode === 'test') {
    if (!isTestPublishable) errors.push('测试模式应使用测试公钥');
    if (!isTestSecret) errors.push('测试模式应使用测试私钥');
  } else {
    if (!isLivePublishable) errors.push('生产模式应使用生产公钥');
    if (!isLiveSecret) errors.push('生产模式应使用生产私钥');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * 切换到测试环境
 */
function switchToTest() {
  console.log('🔄 切换到Stripe测试环境...');
  
  // 检查测试配置文件
  if (!fs.existsSync(ENV_TEST_FILE)) {
    console.error(`❌ 测试配置文件不存在: ${ENV_TEST_FILE}`);
    process.exit(1);
  }
  
  // 更新主配置文件
  updateActiveConfig('test');
  
  // 验证配置
  const validation = validateConfig('test');
  if (!validation.valid) {
    console.warn('⚠️  配置验证警告:', validation.errors);
  }
  
  console.log('✅ 已切换到 Stripe 测试环境');
  console.log('📝 配置详情:');
  console.log('   - 模式: 测试环境 (test)');
  console.log('   - 公钥: pk_test_...');
  console.log('   - 基础版: price_1S0DRpGBOWryw3zINE9dAMkH');
  console.log('   - 专业版: price_1S0DSRGBOWryw3zIhUvxPGv5');
  console.log('   - 企业版: price_1S0DT6GBOWryw3zIDi08pwgl');
  console.log('');
  console.log('⚠️  请重启应用以应用新配置');
}

/**
 * 切换到生产环境
 */
function switchToProduction() {
  console.log('⚠️  警告: 即将切换到生产环境!');
  console.log('');
  console.log('生产环境将使用真实的Stripe配置:');
  console.log('   - 真实的付款处理');
  console.log('   - 真实的客户数据');
  console.log('   - 真实的订阅计费');
  console.log('');
  
  // 在生产环境切换时需要确认
  if (process.argv.includes('--confirm')) {
    // 检查生产配置文件
    if (!fs.existsSync(ENV_PROD_FILE)) {
      console.error(`❌ 生产配置文件不存在: ${ENV_PROD_FILE}`);
      process.exit(1);
    }
    
    // 更新主配置文件
    updateActiveConfig('production');
    
    // 验证配置
    const validation = validateConfig('production');
    if (!validation.valid) {
      console.warn('⚠️  配置验证警告:', validation.errors);
    }
    
    console.log('✅ 已切换到 Stripe 生产环境');
    console.log('📝 配置详情:');
    console.log('   - 模式: 生产环境 (production)');
    console.log('   - 公钥: pk_live_...');
    console.log('   - 基础版: price_1S0BmlGBOWryw3zITXUXsKsi');
    console.log('   - 专业版: price_1S0BnFGBOWryw3zl2Jtc9E9A');
    console.log('   - 企业版: price_1S0BoVGBOWryw3zIlxR8wwhr');
    console.log('');
    console.log('⚠️  请重启应用以应用新配置');
    console.log('');
    console.log('🚀 部署到Supabase:');
    console.log('   npm run stripe:deploy-prod -- --confirm');
  } else {
    console.log('❌ 切换到生产环境需要确认，请使用: --confirm');
    console.log('   npm run stripe:prod -- --confirm');
    process.exit(1);
  }
}

/**
 * 显示当前状态
 */
function showStatus() {
  const currentMode = getCurrentMode();
  const env = readEnvFile(ENV_FILE);
  const validation = validateConfig(currentMode);
  
  console.log('🔧 Stripe 环境状态');
  console.log('==================');
  console.log(`当前模式: ${currentMode === 'test' ? '测试环境 (test)' : '生产环境 (production)'}`);
  
  if (currentMode === 'test') {
    console.log('✅ 使用测试配置:');
    console.log('   - 公钥: pk_test_51RLf1pGBOWryw3zI...');
    console.log('   - 基础版价格: price_1S0DRpGBOWryw3zINE9dAMkH');
    console.log('   - 专业版价格: price_1S0DSRGBOWryw3zIhUvxPGv5');
    console.log('   - 企业版价格: price_1S0DT6GBOWryw3zIDi08pwgl');
  } else {
    console.log('⚠️  使用生产配置:');
    console.log('   - 公钥: pk_live_51RLf1pGBOWryw3zI...');
    console.log('   - 基础版价格: price_1S0BmlGBOWryw3zITXUXsKsi');
    console.log('   - 专业版价格: price_1S0BnFGBOWryw3zl2Jtc9E9A');
    console.log('   - 企业版价格: price_1S0BoVGBOWryw3zIlxR8wwhr');
  }
  
  // 显示验证结果
  if (validation.valid) {
    console.log('✅ 配置验证通过');
  } else {
    console.log('❌ 配置验证失败:');
    validation.errors.forEach(error => {
      console.log(`   - ${error}`);
    });
  }
  
  console.log('');
  console.log('可用命令:');
  console.log('   npm run stripe:test     - 切换到测试环境');
  console.log('   npm run stripe:prod     - 切换到生产环境 (需要 --confirm)');
  console.log('   npm run stripe:status   - 查看当前状态');
  console.log('   npm run stripe:deploy-test   - 部署测试配置到Supabase');
  console.log('   npm run stripe:deploy-prod   - 部署生产配置到Supabase (需要 --confirm)');
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log('增强版Stripe环境切换工具');
  console.log('==========================');
  console.log('');
  console.log('用法:');
  console.log('  node scripts/switch-stripe-env.js [命令] [选项]');
  console.log('');
  console.log('命令:');
  console.log('  test        切换到测试环境');
  console.log('  production  切换到生产环境');
  console.log('  status      显示当前状态 (默认)');
  console.log('  help        显示帮助信息');
  console.log('');
  console.log('选项:');
  console.log('  --confirm   确认切换到生产环境');
  console.log('');
  console.log('示例:');
  console.log('  npm run stripe:test');
  console.log('  npm run stripe:prod -- --confirm');
  console.log('  npm run stripe:status');
  console.log('');
  console.log('功能特性:');
  console.log('  - 自动验证密钥格式和环境一致性');
  console.log('  - 安全的生产环境切换（需要确认）');
  console.log('  - 支持配置快照文件(.env.test, .env.production)');
  console.log('  - 一键更新Supabase Edge Functions配置');
}

// 主程序
function main() {
  const command = process.argv[2] || 'status';
  
  switch (command) {
    case 'test':
      switchToTest();
      break;
      
    case 'production':
    case 'prod':
      switchToProduction();
      break;
      
    case 'status':
      showStatus();
      break;
      
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
      
    default:
      console.error(`❌ 未知命令: ${command}`);
      console.log('使用 --help 查看可用命令');
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getCurrentMode,
  switchToTest,
  switchToProduction,
  showStatus,
  validateConfig,
  readEnvFile,
  writeEnvFile
};