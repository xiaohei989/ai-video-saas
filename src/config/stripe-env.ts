/**
 * Stripe环境配置中心
 * 统一管理测试和生产环境的所有Stripe相关配置
 */

// Stripe配置类型定义
interface StripeConfig {
  publishableKey: string;
  prices: {
    basic: string;
    pro: string;
    enterprise: string;
    basicAnnual: string;
    proAnnual: string;
    enterpriseAnnual: string;
  };
}

// 所有Stripe配置
const STRIPE_CONFIGS: Record<'test' | 'production', StripeConfig> = {
  test: {
    publishableKey: import.meta.env.VITE_STRIPE_TEST_PUBLISHABLE_KEY || '',
    prices: {
      basic: import.meta.env.VITE_STRIPE_TEST_BASIC_PRICE_ID || '',
      pro: import.meta.env.VITE_STRIPE_TEST_PRO_PRICE_ID || '',
      enterprise: import.meta.env.VITE_STRIPE_TEST_ENTERPRISE_PRICE_ID || '',
      basicAnnual: import.meta.env.VITE_STRIPE_TEST_BASIC_ANNUAL_PRICE_ID || '',
      proAnnual: import.meta.env.VITE_STRIPE_TEST_PRO_ANNUAL_PRICE_ID || '',
      enterpriseAnnual: import.meta.env.VITE_STRIPE_TEST_ENTERPRISE_ANNUAL_PRICE_ID || ''
    }
  },
  production: {
    publishableKey: import.meta.env.VITE_STRIPE_PROD_PUBLISHABLE_KEY || '',
    prices: {
      basic: import.meta.env.VITE_STRIPE_PROD_BASIC_PRICE_ID || '',
      pro: import.meta.env.VITE_STRIPE_PROD_PRO_PRICE_ID || '',
      enterprise: import.meta.env.VITE_STRIPE_PROD_ENTERPRISE_PRICE_ID || '',
      basicAnnual: import.meta.env.VITE_STRIPE_PROD_BASIC_ANNUAL_PRICE_ID || '',
      proAnnual: import.meta.env.VITE_STRIPE_PROD_PRO_ANNUAL_PRICE_ID || '',
      enterpriseAnnual: import.meta.env.VITE_STRIPE_PROD_ENTERPRISE_ANNUAL_PRICE_ID || ''
    }
  }
};

/**
 * 获取当前Stripe模式（从环境变量）
 */
export function getStripeMode(): 'test' | 'production' {
  const mode = import.meta.env.VITE_STRIPE_MODE || 'test';
  return mode === 'production' ? 'production' : 'test';
}

/**
 * 动态获取环境特定的配置
 * 优先从环境变量获取，回退到静态配置
 */
function getEnvironmentConfig(mode: 'test' | 'production'): StripeConfig {
  // 优先使用环境变量中的配置（支持动态切换）
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  const basicPrice = import.meta.env.VITE_STRIPE_BASIC_PRICE_ID;
  const proPrice = import.meta.env.VITE_STRIPE_PRO_PRICE_ID;
  const enterprisePrice = import.meta.env.VITE_STRIPE_ENTERPRISE_PRICE_ID;
  const basicAnnualPrice = import.meta.env.VITE_STRIPE_BASIC_ANNUAL_PRICE_ID;
  const proAnnualPrice = import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID;
  const enterpriseAnnualPrice = import.meta.env.VITE_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID;
  
  if (publishableKey && basicPrice && proPrice && enterprisePrice && 
      basicAnnualPrice && proAnnualPrice && enterpriseAnnualPrice) {
    return {
      publishableKey,
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
  
  // 回退到静态配置
  return STRIPE_CONFIGS[mode];
}

/**
 * 检测是否为测试模式
 */
export function isStripeTestMode(): boolean {
  return getStripeMode() === 'test';
}

/**
 * 获取当前环境的Stripe配置
 */
export function getStripeConfig(): StripeConfig {
  const mode = getStripeMode();
  return getEnvironmentConfig(mode);
}

/**
 * 获取Stripe公钥
 */
export function getStripePublishableKey(): string {
  return getStripeConfig().publishableKey;
}

/**
 * 获取价格ID
 */
export function getStripePrices() {
  return getStripeConfig().prices;
}

/**
 * 获取特定计划的价格ID
 */
export function getStripePriceId(planId: 'basic' | 'pro' | 'enterprise'): string {
  const prices = getStripePrices();
  return prices[planId];
}

/**
 * 获取特定计划的年度价格ID
 */
export function getStripeAnnualPriceId(planId: 'basic' | 'pro' | 'enterprise'): string {
  const prices = getStripePrices();
  return prices[`${planId}Annual` as keyof typeof prices];
}

/**
 * 获取指定计划和计费周期的价格ID
 */
export function getStripePriceIdByInterval(
  planId: 'basic' | 'pro' | 'enterprise', 
  interval: 'month' | 'year'
): string {
  return interval === 'year' ? getStripeAnnualPriceId(planId) : getStripePriceId(planId);
}

/**
 * 获取环境信息（用于调试和显示）
 */
export function getStripeEnvironmentInfo() {
  const mode = getStripeMode();
  const config = getStripeConfig();
  
  return {
    mode,
    isTestMode: mode === 'test',
    environment: mode === 'test' ? '测试环境' : '生产环境',
    publishableKey: config.publishableKey,
    prices: config.prices
  };
}

/**
 * 验证当前配置是否有效
 */
export function validateStripeConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = getStripeConfig();
  
  // 验证公钥格式
  if (!config.publishableKey.startsWith('pk_')) {
    errors.push('无效的Stripe公钥格式');
  }
  
  // 验证测试/生产环境一致性
  const mode = getStripeMode();
  const isTestKey = config.publishableKey.startsWith('pk_test_');
  const isLiveKey = config.publishableKey.startsWith('pk_live_');
  
  if (mode === 'test' && !isTestKey) {
    errors.push('测试模式应使用测试密钥');
  }
  
  if (mode === 'production' && !isLiveKey) {
    errors.push('生产模式应使用生产密钥');
  }
  
  // 验证价格ID
  Object.entries(config.prices).forEach(([plan, priceId]) => {
    if (!priceId.startsWith('price_')) {
      errors.push(`无效的${plan}计划价格ID格式`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 导出配置对象（用于向后兼容）
export const stripeConfig = getStripeConfig();

// 在开发环境下打印配置信息
if (import.meta.env.DEV) {
  console.log('🔧 [Stripe Env Debug] VITE_STRIPE_MODE:', import.meta.env.VITE_STRIPE_MODE);
  console.log('🔧 [Stripe Env Debug] Current Mode:', getStripeMode());
  console.log('🔧 [Stripe Env Debug] PublishableKey:', getStripePublishableKey()?.substring(0, 20) + '...');

  // 验证配置
  const validation = validateStripeConfig();
  if (!validation.valid) {
    console.warn('⚠️  Stripe配置问题:', validation.errors);
  }
}