/**
 * 积分系统配置
 * 定义视频生成的积分消耗规则
 */

export const CREDIT_COSTS = {
  // 视频生成积分消耗
  VIDEO_GENERATION: {
    // 16:9 横屏视频
    '16:9': {
      STANDARD: 20,    // 标准质量视频
      HIGH_QUALITY: 100, // 高质量视频
    },
    // 9:16 竖屏视频
    '9:16': {
      STANDARD: 100,    // 标准质量视频
      HIGH_QUALITY: 160, // 高质量视频
    }
  },

  // 其他功能积分消耗（未来扩展）
  FEATURES: {
    // 可以添加其他功能的积分消耗
  }
} as const

export const SUBSCRIPTION_CREDITS = {
  basic: 200,
  pro: 1500,
  enterprise: 6000
} as const

/**
 * 根据视频质量和宽高比获取积分消耗
 */
export function getVideoCreditCost(
  quality: 'standard' | 'high',
  aspectRatio: '16:9' | '9:16' = '16:9'
): number {
  const costs = CREDIT_COSTS.VIDEO_GENERATION[aspectRatio]
  return quality === 'high' ? costs.HIGH_QUALITY : costs.STANDARD
}

/**
 * 格式化积分显示
 */
export function formatCredits(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`
  }
  return amount.toString()
}