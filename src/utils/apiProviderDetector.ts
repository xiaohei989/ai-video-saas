/**
 * API提供商识别工具
 * 根据Task ID格式自动识别使用的API提供商
 */

export type ApiProvider = 'apicore' | 'wuyin' | 'unknown';

/**
 * 根据Task ID格式自动检测API提供商
 * @param taskId - 任务ID
 * @returns API提供商类型
 */
export function detectApiProvider(taskId: string): ApiProvider {
  if (!taskId || typeof taskId !== 'string') {
    console.warn('[API DETECTOR] Invalid task ID, defaulting to unknown:', taskId);
    return 'unknown';
  }

  // Wuyin任务ID格式: 纯数字
  // 例如: 123, 1352, 13
  const isNumericOnly = /^\d+$/.test(taskId);
  if (isNumericOnly) {
    // console.log(`[API DETECTOR] 检测到Wuyin任务: ${taskId}`);
    return 'wuyin';
  }

  // APICore任务ID格式: 标准UUID (36位，包含4个连字符)
  // 例如: 096caa9f-418a-44cd-9012-c90eb0072f7f, 856dc0eb-bed4-4898-a23a-804a1d87e35a
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);

  if (isUUID) {
    // console.log(`[API DETECTOR] 检测到APICore任务: ${taskId}`);
    return 'apicore';
  }

  // 如果都不匹配，返回unknown
  console.warn(`[API DETECTOR] 无法识别Task ID格式: ${taskId}`);
  return 'unknown';
}

/**
 * 检查Task ID是否为有效的APICore UUID格式
 */
export function isApicoreTaskId(taskId: string): boolean {
  return detectApiProvider(taskId) === 'apicore';
}

/**
 * 检查Task ID是否为Wuyin格式
 */
export function isWuyinTaskId(taskId: string): boolean {
  return detectApiProvider(taskId) === 'wuyin';
}

/**
 * 获取适合的API服务实例
 */
export async function getApiServiceForTaskId(taskId: string) {
  const provider = detectApiProvider(taskId);

  if (provider === 'wuyin') {
    const { getWuyinApiService } = await import('../services/veo/WuyinApiService');
    const apiKey = import.meta.env.VITE_WUYIN_API_KEY;
    const endpoint = import.meta.env.VITE_WUYIN_ENDPOINT || 'https://api.wuyinkeji.com';

    if (!apiKey) {
      throw new Error('Wuyin API key not configured');
    }

    return getWuyinApiService({ apiKey, endpoint });
  } else if (provider === 'apicore') {
    const { getApicoreApiService } = await import('../services/veo/ApicoreApiService');
    const apiKey = import.meta.env.VITE_APICORE_API_KEY;
    const endpoint = import.meta.env.VITE_APICORE_ENDPOINT || 'https://api.apicore.ai';

    if (!apiKey) {
      throw new Error('APICore API key not configured');
    }

    return getApicoreApiService({ apiKey, endpoint });
  } else {
    throw new Error(`Unsupported API provider: ${provider}`);
  }
}

/**
 * 格式化Task ID用于显示
 */
export function formatTaskIdForDisplay(taskId: string): string {
  const provider = detectApiProvider(taskId);

  if (provider === 'wuyin') {
    return `Wuyin:${taskId}`;
  } else if (provider === 'apicore') {
    return `APICore:${taskId.slice(0, 8)}...${taskId.slice(-8)}`;
  } else {
    return taskId;
  }
}

/**
 * 获取API提供商的显示名称
 */
export function getApiProviderDisplayName(provider: ApiProvider): string {
  switch (provider) {
    case 'wuyin':
      return '无音科技';
    case 'apicore':
      return 'APICore';
    case 'unknown':
      return '未知API';
    default:
      return '未知API';
  }
}