#!/usr/bin/env node

/**
 * Supabase Edge Functions Stripe环境部署脚本
 * 自动将Stripe配置部署到Supabase Edge Functions
 */

const { spawn } = require('child_process');
const { readEnvFile } = require('./switch-stripe-env');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');
const ENV_TEST_FILE = path.join(__dirname, '..', '.env.test');
const ENV_PROD_FILE = path.join(__dirname, '..', '.env.production');
const SUPABASE_PROJECT_REF = 'hvkzwrnvxsleeonqqrzq';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb';

/**
 * 执行命令
 */
function execCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 执行命令: ${command} ${args.join(' ')}`);
    
    const proc = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, ...env }
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`命令执行失败，退出码: ${code}\n${stderr}`));
      }
    });
  });
}

/**
 * 部署测试环境到Supabase
 */
async function deployTestEnvironment() {
  console.log('🚀 部署Stripe测试环境到Supabase...');
  
  const testEnv = readEnvFile(ENV_TEST_FILE);
  
  if (!testEnv.STRIPE_SECRET_KEY || !testEnv.STRIPE_WEBHOOK_SIGNING_SECRET) {
    throw new Error('测试环境配置缺失关键密钥');
  }
  
  // 设置环境变量
  const secrets = [
    ['STRIPE_SECRET_KEY', testEnv.STRIPE_SECRET_KEY],
    ['STRIPE_WEBHOOK_SIGNING_SECRET', testEnv.STRIPE_WEBHOOK_SIGNING_SECRET],
    ['STRIPE_MODE', 'test'],
    ['VITE_STRIPE_MODE', 'test'],
    ['VITE_STRIPE_BASIC_PRICE_ID', testEnv.VITE_STRIPE_BASIC_PRICE_ID],
    ['VITE_STRIPE_PRO_PRICE_ID', testEnv.VITE_STRIPE_PRO_PRICE_ID],
    ['VITE_STRIPE_ENTERPRISE_PRICE_ID', testEnv.VITE_STRIPE_ENTERPRISE_PRICE_ID]
  ];
  
  console.log('📝 更新Supabase Edge Functions环境变量...');
  
  for (const [key, value] of secrets) {
    if (value) {
      try {
        await execCommand('supabase', [
          'secrets', 'set',
          `${key}=${value}`,
          '--project-ref', SUPABASE_PROJECT_REF
        ], {
          SUPABASE_ACCESS_TOKEN
        });
        console.log(`✅ 设置 ${key}`);
      } catch (error) {
        console.error(`❌ 设置 ${key} 失败:`, error.message);
        throw error;
      }
    }
  }
  
  // 重新部署Edge Functions
  console.log('🔄 重新部署Stripe webhook函数...');
  try {
    await execCommand('supabase', [
      'functions', 'deploy', 'stripe-webhook',
      '--project-ref', SUPABASE_PROJECT_REF,
      '--no-verify-jwt'
    ], {
      SUPABASE_ACCESS_TOKEN
    });
    console.log('✅ Stripe webhook函数部署成功');
  } catch (error) {
    console.error('❌ Edge Functions部署失败:', error.message);
    throw error;
  }
  
  console.log('');
  console.log('🎉 测试环境部署完成！');
  console.log('📋 部署摘要:');
  console.log('   - 环境: 测试环境 (test)');
  console.log('   - Stripe密钥: sk_test_...');
  console.log('   - Webhook密钥: whsec_...');
  console.log('   - 基础版价格: price_1S0DRpGBOWryw3zINE9dAMkH');
  console.log('   - 专业版价格: price_1S0DSRGBOWryw3zIhUvxPGv5');
  console.log('   - 企业版价格: price_1S0DT6GBOWryw3zIDi08pwgl');
}

/**
 * 部署生产环境到Supabase
 */
async function deployProductionEnvironment() {
  console.log('⚠️  警告: 即将部署生产环境到Supabase!');
  console.log('');
  console.log('这将影响真实的支付处理和webhook配置。');
  console.log('请确保你已经:');
  console.log('1. 在Stripe Dashboard生产环境配置了正确的webhook');
  console.log('2. 验证了所有价格ID和密钥');
  console.log('3. 备份了当前配置');
  console.log('');
  
  // 在生产环境部署时需要确认
  if (!process.argv.includes('--confirm')) {
    console.log('❌ 部署生产环境需要确认，请使用: --confirm');
    console.log('   npm run stripe:deploy-prod -- --confirm');
    process.exit(1);
  }
  
  console.log('🚀 部署Stripe生产环境到Supabase...');
  
  const prodEnv = readEnvFile(ENV_PROD_FILE);
  
  if (!prodEnv.STRIPE_SECRET_KEY || !prodEnv.STRIPE_WEBHOOK_SIGNING_SECRET) {
    throw new Error('生产环境配置缺失关键密钥');
  }
  
  // 验证生产环境密钥格式
  if (!prodEnv.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
    throw new Error('生产环境必须使用生产密钥 (sk_live_)');
  }
  
  if (!prodEnv.VITE_STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_')) {
    throw new Error('生产环境必须使用生产公钥 (pk_live_)');
  }
  
  // 设置环境变量
  const secrets = [
    ['STRIPE_SECRET_KEY', prodEnv.STRIPE_SECRET_KEY],
    ['STRIPE_WEBHOOK_SIGNING_SECRET', prodEnv.STRIPE_WEBHOOK_SIGNING_SECRET],
    ['STRIPE_MODE', 'production'],
    ['VITE_STRIPE_MODE', 'production'],
    ['VITE_STRIPE_BASIC_PRICE_ID', prodEnv.VITE_STRIPE_BASIC_PRICE_ID],
    ['VITE_STRIPE_PRO_PRICE_ID', prodEnv.VITE_STRIPE_PRO_PRICE_ID],
    ['VITE_STRIPE_ENTERPRISE_PRICE_ID', prodEnv.VITE_STRIPE_ENTERPRISE_PRICE_ID]
  ];
  
  console.log('📝 更新Supabase Edge Functions环境变量...');
  
  for (const [key, value] of secrets) {
    if (value) {
      try {
        await execCommand('supabase', [
          'secrets', 'set',
          `${key}=${value}`,
          '--project-ref', SUPABASE_PROJECT_REF
        ], {
          SUPABASE_ACCESS_TOKEN
        });
        console.log(`✅ 设置 ${key}`);
      } catch (error) {
        console.error(`❌ 设置 ${key} 失败:`, error.message);
        throw error;
      }
    }
  }
  
  // 重新部署Edge Functions
  console.log('🔄 重新部署Stripe webhook函数...');
  try {
    await execCommand('supabase', [
      'functions', 'deploy', 'stripe-webhook',
      '--project-ref', SUPABASE_PROJECT_REF,
      '--no-verify-jwt'
    ], {
      SUPABASE_ACCESS_TOKEN
    });
    console.log('✅ Stripe webhook函数部署成功');
  } catch (error) {
    console.error('❌ Edge Functions部署失败:', error.message);
    throw error;
  }
  
  console.log('');
  console.log('🎉 生产环境部署完成！');
  console.log('📋 部署摘要:');
  console.log('   - 环境: 生产环境 (production)');
  console.log('   - Stripe密钥: sk_live_...');
  console.log('   - Webhook密钥: whsec_...');
  console.log('   - 基础版价格: price_1S0BmlGBOWryw3zITXUXsKsi');
  console.log('   - 专业版价格: price_1S0BnFGBOWryw3zl2Jtc9E9A');
  console.log('   - 企业版价格: price_1S0BoVGBOWryw3zIlxR8wwhr');
  console.log('');
  console.log('⚠️  重要提醒:');
  console.log('   1. 请在Stripe Dashboard验证webhook端点状态');
  console.log('   2. 测试一次支付以确保配置正确');
  console.log('   3. 监控Edge Functions日志确保没有错误');
}

/**
 * 显示当前Supabase环境状态
 */
async function showSupabaseStatus() {
  console.log('🔧 Supabase Edge Functions环境状态');
  console.log('===================================');
  
  try {
    console.log('📋 当前环境变量:');
    await execCommand('supabase', [
      'secrets', 'list',
      '--project-ref', SUPABASE_PROJECT_REF
    ], {
      SUPABASE_ACCESS_TOKEN
    });
  } catch (error) {
    console.error('❌ 获取环境变量失败:', error.message);
  }
  
  try {
    console.log('');
    console.log('📋 Edge Functions状态:');
    await execCommand('supabase', [
      'functions', 'list',
      '--project-ref', SUPABASE_PROJECT_REF
    ], {
      SUPABASE_ACCESS_TOKEN
    });
  } catch (error) {
    console.error('❌ 获取函数日志失败:', error.message);
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log('Supabase Edge Functions Stripe环境部署工具');
  console.log('==========================================');
  console.log('');
  console.log('用法:');
  console.log('  node scripts/deploy-stripe-env.js [命令] [选项]');
  console.log('');
  console.log('命令:');
  console.log('  test        部署测试环境配置到Supabase');
  console.log('  production  部署生产环境配置到Supabase');
  console.log('  status      显示当前Supabase环境状态 (默认)');
  console.log('  help        显示帮助信息');
  console.log('');
  console.log('选项:');
  console.log('  --confirm   确认部署到生产环境');
  console.log('');
  console.log('示例:');
  console.log('  npm run stripe:deploy-test');
  console.log('  npm run stripe:deploy-prod -- --confirm');
  console.log('  npm run stripe:deploy-status');
  console.log('');
  console.log('注意事项:');
  console.log('  - 部署前请先使用 npm run stripe:test/prod 切换本地环境');
  console.log('  - 生产环境部署需要 --confirm 标志确认');
  console.log('  - 部署会自动重启Edge Functions');
}

// 主程序
async function main() {
  const command = process.argv[2] || 'status';
  
  try {
    switch (command) {
      case 'test':
        await deployTestEnvironment();
        break;
        
      case 'production':
      case 'prod':
        await deployProductionEnvironment();
        break;
        
      case 'status':
        await showSupabaseStatus();
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
  } catch (error) {
    console.error('❌ 部署失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}