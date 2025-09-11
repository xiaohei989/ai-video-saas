/**
 * Stripe环境配置 - 兼容层
 * 重定向到新的环境配置系统
 * @deprecated 请使用 @/config/stripe-env 中的新配置
 */

import {
  isStripeTestMode,
  getStripePrices,
  getStripePriceId,
  getStripeEnvironmentInfo
} from './stripe-env'

/**
 * 检测当前是否为测试环境
 * @deprecated 请使用 isStripeTestMode
 */
export function isTestMode(): boolean {
  return isStripeTestMode()
}

/**
 * 获取当前环境的价格ID
 * @deprecated 请使用 getStripePrices
 */
export function getStripePriceIds() {
  return getStripePrices()
}

/**
 * 获取特定计划的价格ID
 * @deprecated 请使用 getStripePriceId
 */
export function getPriceId(planId: 'basic' | 'pro' | 'enterprise'): string {
  return getStripePriceId(planId)
}

/**
 * 获取当前环境信息
 * @deprecated 请使用 getStripeEnvironmentInfo
 */
export function getEnvironmentInfo() {
  const envInfo = getStripeEnvironmentInfo()
  return {
    isTestMode: envInfo.isTestMode,
    environment: envInfo.mode,
    priceIds: envInfo.prices
  }
}

// 向后兼容：导出价格映射
export const TEST_PRICE_IDS = {
  basic: 'price_1S0DRpGBOWryw3zINE9dAMkH',
  pro: 'price_1S0DSRGBOWryw3zIhUvxPGv5',
  enterprise: 'price_1S0DT6GBOWryw3zIDi08pwgl'
} as const

export const PRODUCTION_PRICE_IDS = {
  basic: 'price_1S0BmlGBOWryw3zITXUXsKsi',
  pro: 'price_1S0BnFGBOWryw3zl2Jtc9E9A',
  enterprise: 'price_1S0BoVGBOWryw3zIlxR8wwhr'
} as const