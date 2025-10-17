/**
 * 积分系统配置
 * 定义视频生成的积分消耗规则
 */

// 视频质量类型
export type VideoQuality = 'veo3' | 'veo3-pro' | 'veo3.1-fast' | 'veo3.1-pro'

export const CREDIT_COSTS = {
  // 视频生成积分消耗（不再区分16:9和9:16）
  VIDEO_GENERATION: {
    'veo3': 20,           // Veo 3.0 Fast - 快速生成
    'veo3-pro': 100,      // Veo 3.0 High Quality - 高质量
    'veo3.1-fast': 20,    // Veo 3.1 Fast - 新快速
    'veo3.1-pro': 100,    // Veo 3.1 High Quality - 新高质量
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
 * 根据视频质量获取积分消耗
 * @param quality - 视频质量类型
 * @returns 积分消耗数量
 */
export function getVideoCreditCost(quality: VideoQuality): number {
  return CREDIT_COSTS.VIDEO_GENERATION[quality] || 20
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

/**
 * 获取质量选项的显示信息
 */
export function getQualityInfo(quality: VideoQuality) {
  const infoMap = {
    'veo3': {
      name: 'Veo 3.0 Fast',
      credits: 20,
      time: '1-2分钟',
      description: '快速生成'
    },
    'veo3-pro': {
      name: 'Veo 3.0 High Quality',
      credits: 100,
      time: '3-6分钟',
      description: '高质量'
    },
    'veo3.1-fast': {
      name: 'Veo 3.1 Fast',
      credits: 20,
      time: '1-2分钟',
      description: '新快速'
    },
    'veo3.1-pro': {
      name: 'Veo 3.1 High Quality',
      credits: 100,
      time: '3-6分钟',
      description: '新高质量'
    }
  }
  return infoMap[quality]
}
