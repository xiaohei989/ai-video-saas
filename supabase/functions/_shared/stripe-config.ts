/**
 * Supabase Edge Functions 共享 Stripe 配置
 * 用于webhook等后端函数的环境配置管理
 */

// Edge Functions Stripe配置类型
interface EdgeStripeConfig {
  secretKey: string;
  webhookSecret: string;
  prices: {
    basic: string;
    pro: string;
    enterprise: string;
    basicAnnual: string;
    proAnnual: string;
    enterpriseAnnual: string;
  };
}

// Edge Functions环境配置
const EDGE_STRIPE_CONFIGS: Record<'test' | 'production', EdgeStripeConfig> = {
  test: {
    secretKey: Deno.env.get('STRIPE_TEST_SECRET_KEY') || '',
    webhookSecret: '', // 必须使用环境变量 STRIPE_WEBHOOK_SIGNING_SECRET
    prices: {
      basic: Deno.env.get('VITE_STRIPE_TEST_BASIC_PRICE_ID') || '',
      pro: Deno.env.get('VITE_STRIPE_TEST_PRO_PRICE_ID') || '',
      enterprise: Deno.env.get('VITE_STRIPE_TEST_ENTERPRISE_PRICE_ID') || '',
      basicAnnual: Deno.env.get('VITE_STRIPE_TEST_BASIC_ANNUAL_PRICE_ID') || '',
      proAnnual: Deno.env.get('VITE_STRIPE_TEST_PRO_ANNUAL_PRICE_ID') || '',
      enterpriseAnnual: Deno.env.get('VITE_STRIPE_TEST_ENTERPRISE_ANNUAL_PRICE_ID') || ''
    }
  },
  production: {
    secretKey: Deno.env.get('STRIPE_PROD_SECRET_KEY') || '',
    webhookSecret: '', // 必须使用环境变量 STRIPE_WEBHOOK_SIGNING_SECRET
    prices: {
      basic: Deno.env.get('VITE_STRIPE_PROD_BASIC_PRICE_ID') || '',
      pro: Deno.env.get('VITE_STRIPE_PROD_PRO_PRICE_ID') || '',
      enterprise: Deno.env.get('VITE_STRIPE_PROD_ENTERPRISE_PRICE_ID') || '',
      basicAnnual: Deno.env.get('VITE_STRIPE_PROD_BASIC_ANNUAL_PRICE_ID') || '',
      proAnnual: Deno.env.get('VITE_STRIPE_PROD_PRO_ANNUAL_PRICE_ID') || '',
      enterpriseAnnual: Deno.env.get('VITE_STRIPE_PROD_ENTERPRISE_ANNUAL_PRICE_ID') || ''
    }
  }
};

/**
 * 获取Edge Functions当前Stripe环境模式
 * 优先级：环境变量 > 默认测试模式
 */
export function getEdgeStripeMode(): 'test' | 'production' {
  const mode = Deno.env.get('STRIPE_MODE') || Deno.env.get('VITE_STRIPE_MODE') || 'test';
  return mode === 'production' ? 'production' : 'test';
}

/**
 * 动态获取环境特定的配置
 * 优先从环境变量获取，回退到静态配置
 */
function getEnvironmentEdgeConfig(mode: 'test' | 'production'): EdgeStripeConfig {
  // 优先使用环境变量中的配置（支持动态切换）
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  
  // 🔧 修复：在生产模式下直接使用标准环境变量名
  const basicPrice = Deno.env.get('VITE_STRIPE_BASIC_PRICE_ID');
  const proPrice = Deno.env.get('VITE_STRIPE_PRO_PRICE_ID');
  const enterprisePrice = Deno.env.get('VITE_STRIPE_ENTERPRISE_PRICE_ID');
  
  // 🔧 修复：年度价格ID获取
  const basicAnnualPrice = Deno.env.get('VITE_STRIPE_BASIC_ANNUAL_PRICE_ID');
  const proAnnualPrice = Deno.env.get('VITE_STRIPE_PRO_ANNUAL_PRICE_ID');
  const enterpriseAnnualPrice = Deno.env.get('VITE_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID');
  
  console.log(`[EDGE_CONFIG] 🔍 Environment variables for ${mode}:`, {
    secretKey: secretKey ? '✅' : '❌',
    basicPrice: basicPrice || '❌',
    proPrice: proPrice || '❌', 
    enterprisePrice: enterprisePrice || '❌',
    basicAnnualPrice: basicAnnualPrice || '❌',
    proAnnualPrice: proAnnualPrice || '❌',
    enterpriseAnnualPrice: enterpriseAnnualPrice || '❌'
  });
  
  if (secretKey && basicPrice && proPrice && enterprisePrice && 
      basicAnnualPrice && proAnnualPrice && enterpriseAnnualPrice) {
    return {
      secretKey,
      webhookSecret: '', // 必须使用环境变量 STRIPE_WEBHOOK_SIGNING_SECRET
      prices: {
        basic: basicPrice,
        pro: proPrice,
        enterprise: enterprisePrice,
        basicAnnual: basicAnnualPrice,
        proAnnual: proAnnualPrice,
        enterpriseAnnual: enterpriseAnnualPrice
      }
    };
  }
  
  console.log(`[EDGE_CONFIG] ⚠️ Falling back to static config for ${mode}`);
  // 回退到静态配置
  return EDGE_STRIPE_CONFIGS[mode];
}

/**
 * 获取Edge Functions当前环境的Stripe配置
 */
export function getEdgeStripeConfig(): EdgeStripeConfig {
  const mode = getEdgeStripeMode();
  return getEnvironmentEdgeConfig(mode);
}

/**
 * 获取Stripe密钥（优先从环境变量获取）
 */
export function getStripeSecretKey(): string {
  // 优先使用环境变量中的密钥
  const envSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (envSecretKey) {
    return envSecretKey;
  }
  
  // 回退到配置文件
  const config = getEdgeStripeConfig();
  return config.secretKey;
}

/**
 * 获取Webhook签名密钥（优先从环境变量获取）
 */
export function getWebhookSecret(): string {
  // 必须从环境变量获取webhook密钥
  const envWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
  
  if (!envWebhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SIGNING_SECRET environment variable is required');
  }
  
  if (!envWebhookSecret.startsWith('whsec_')) {
    throw new Error('Invalid webhook secret format. Must start with whsec_');
  }
  
  return envWebhookSecret;
}

/**
 * 获取价格ID（优先从配置文件获取，保证一致性）
 */
export function getEdgeStripePrices() {
  const config = getEdgeStripeConfig();
  return config.prices;
}

/**
 * 获取特定计划的价格ID
 */
export function getEdgeStripePriceId(planId: 'basic' | 'pro' | 'enterprise'): string {
  const prices = getEdgeStripePrices();
  return prices[planId];
}

/**
 * 价格ID到等级映射（用于webhook处理）
 * 返回完整的planId，包括年度标识
 */
export function mapPriceIdToTier(priceId: string): string {
  console.log(`[PRICE_MAPPING] 🔍 Input Price ID: ${priceId}`)
  
  // 🔧 修复：获取当前实际配置（包含环境变量）
  const currentConfig = getEdgeStripeConfig();
  const allConfigs = [currentConfig, EDGE_STRIPE_CONFIGS.test, EDGE_STRIPE_CONFIGS.production];
  
  console.log(`[PRICE_MAPPING] 🔍 Current mode: ${getEdgeStripeMode()}`)
  console.log(`[PRICE_MAPPING] 🔍 Current config prices:`, currentConfig.prices)
  
  for (const config of allConfigs) {
    console.log(`[PRICE_MAPPING] 🔍 Checking config:`, config.prices)
    
    // 月度计划
    if (config.prices.basic === priceId) {
      console.log(`[PRICE_MAPPING] ✅ Matched basic monthly: ${priceId}`)
      return 'basic';
    }
    if (config.prices.pro === priceId) {
      console.log(`[PRICE_MAPPING] ✅ Matched pro monthly: ${priceId}`)
      return 'pro';
    }
    if (config.prices.enterprise === priceId) {
      console.log(`[PRICE_MAPPING] ✅ Matched enterprise monthly: ${priceId}`)
      return 'enterprise';
    }
    
    // 年度计划
    if (config.prices.basicAnnual === priceId) {
      console.log(`[PRICE_MAPPING] ✅ Matched basic annual: ${priceId}`)
      return 'basic-annual';
    }
    if (config.prices.proAnnual === priceId) {
      console.log(`[PRICE_MAPPING] ✅ Matched pro annual: ${priceId}`)
      return 'pro-annual';
    }
    if (config.prices.enterpriseAnnual === priceId) {
      console.log(`[PRICE_MAPPING] ✅ Matched enterprise annual: ${priceId}`)
      return 'enterprise-annual';
    }
  }
  
  console.log(`[PRICE_MAPPING] ⚠️ No exact match found, trying fallback matching...`)
  
  // 🔧 改进：更精确的fallback匹配逻辑
  // 先检查已知的测试价格ID模式
  const knownTestPrices = {
    'price_1S0DRpGBOWryw3zINE9dAMkH': 'basic',          // 测试基础版月付
    'price_1S0DSRGBOWryw3zIhUvxPGv5': 'pro',            // 测试专业版月付  
    'price_1S0DT6GBOWryw3zIDi08pwgl': 'enterprise',     // 测试企业版月付
    'price_1S1f6ZGBOWryw3zI6Spn5iNf': 'basic-annual',   // 测试基础版年付
    'price_1S1fHBGBOWryw3zIK8731Uhx': 'pro-annual',     // 测试专业版年付
    'price_1S1fHoGBOWryw3zIxME77BMZ': 'enterprise-annual' // 测试企业版年付
  };
  
  if (knownTestPrices[priceId]) {
    const result = knownTestPrices[priceId];
    console.log(`[PRICE_MAPPING] ✅ Known test price matched: ${priceId} -> ${result}`);
    return result;
  }
  
  // 兜底模式匹配（字符串包含检查）
  if (priceId.includes('basic')) {
    const result = priceId.includes('annual') || priceId.includes('year') ? 'basic-annual' : 'basic';
    console.log(`[PRICE_MAPPING] 🎯 Fallback basic result: ${result}`)
    return result;
  }
  if (priceId.includes('pro')) {
    const result = priceId.includes('annual') || priceId.includes('year') ? 'pro-annual' : 'pro';
    console.log(`[PRICE_MAPPING] 🎯 Fallback pro result: ${result}`)
    return result;
  }
  if (priceId.includes('enterprise')) {
    const result = priceId.includes('annual') || priceId.includes('year') ? 'enterprise-annual' : 'enterprise';
    console.log(`[PRICE_MAPPING] 🎯 Fallback enterprise result: ${result}`)
    return result;
  }
  
  console.error(`[PRICE_MAPPING] ❌ Unknown price ID: ${priceId}, defaulting to basic`);
  console.error(`[PRICE_MAPPING] ❌ Available configs:`, allConfigs.map(c => c.prices));
  return 'basic'; // 默认基础版
}

/**
 * 获取环境信息（用于调试和日志）
 */
export function getEdgeStripeEnvironmentInfo() {
  const mode = getEdgeStripeMode();
  const config = getEdgeStripeConfig();
  const secretKey = getStripeSecretKey();

  // 🔧 修复：webhook secret是可选的，只在webhook处理时需要
  let webhookSecret = '';
  let webhookSecretSource = 'none';
  try {
    webhookSecret = getWebhookSecret();
    webhookSecretSource = webhookSecret === config.webhookSecret ? 'config' : 'env';
  } catch (error) {
    // Webhook secret不是必需的，忽略错误
    console.log('[STRIPE_CONFIG] ℹ️ Webhook secret not configured (optional for checkout)');
  }

  return {
    mode,
    isTestMode: mode === 'test',
    environment: mode === 'test' ? '测试环境' : '生产环境',
    secretKeySource: secretKey === config.secretKey ? 'config' : 'env',
    webhookSecretSource,
    prices: config.prices
  };
}

/**
 * 验证Edge Functions Stripe配置
 */
export function validateEdgeStripeConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const secretKey = getStripeSecretKey();
  const webhookSecret = getWebhookSecret();
  const mode = getEdgeStripeMode();
  
  // 验证密钥格式
  if (!secretKey.startsWith('sk_')) {
    errors.push('无效的Stripe密钥格式');
  }
  
  if (!webhookSecret.startsWith('whsec_')) {
    errors.push('无效的Webhook签名密钥格式');
  }
  
  // 验证测试/生产环境一致性
  const isTestKey = secretKey.startsWith('sk_test_');
  const isLiveKey = secretKey.startsWith('sk_live_');
  
  if (mode === 'test' && !isTestKey) {
    errors.push('测试模式应使用测试密钥');
  }
  
  if (mode === 'production' && !isLiveKey) {
    errors.push('生产模式应使用生产密钥');
  }
  
  // 验证价格ID
  const prices = getEdgeStripePrices();
  Object.entries(prices).forEach(([plan, priceId]) => {
    if (!priceId.startsWith('price_')) {
      errors.push(`无效的${plan}计划价格ID格式`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 在开发或调试模式下打印配置信息
const debugMode = Deno.env.get('DEBUG') === 'true' || Deno.env.get('NODE_ENV') === 'development';
if (debugMode) {
  const envInfo = getEdgeStripeEnvironmentInfo();
  console.log(`🔧 Edge Functions Stripe配置: ${envInfo.environment} (${envInfo.mode})`);
  console.log(`🔑 密钥来源: ${envInfo.secretKeySource}, Webhook来源: ${envInfo.webhookSecretSource}`);
  
  // 验证配置
  const validation = validateEdgeStripeConfig();
  if (!validation.valid) {
    console.warn('⚠️  Edge Functions Stripe配置问题:', validation.errors);
  }
}