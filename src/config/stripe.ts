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

