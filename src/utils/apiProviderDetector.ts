/**
 * API提供商识别工具
 * 根据Task ID格式自动识别使用的API提供商
 */

export type ApiProvider = 'qingyun' | 'apicore';

/**
 * 根据Task ID格式自动检测API提供商
 * @param taskId - 任务ID
 * @returns API提供商类型
 */
export function detectApiProvider(taskId: string): ApiProvider {
  if (!taskId || typeof taskId !== 'string') {
    console.warn('[API DETECTOR] Invalid task ID, defaulting to apicore:', taskId);
    return 'apicore'; // 默认改为APICore
  }

  // APICore任务ID格式: 标准UUID (36位，包含4个连字符)
  // 例如: 096caa9f-418a-44cd-9012-c90eb0072f7f, 856dc0eb-bed4-4898-a23a-804a1d87e35a
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
  
  if (isUUID) {
    // console.log(`[API DETECTOR] 检测到APICore任务: ${taskId}`);
    return 'apicore';
  }

  // 青云API任务ID格式: 前缀:时间戳-随机字符
  // 例如: veo3-fast:1756778834-g0upf2aqu, qingyun-xxx-xxx
  const hasPrefix = taskId.includes(':') || taskId.startsWith('qingyun-') || taskId.startsWith('veo3-');
  
  if (hasPrefix) {
    // console.log(`[API DETECTOR] 检测到青云API任务: ${taskId}`);
    return 'qingyun';
  }

  // 如果都不匹配，默认使用APICore（因为现在主要使用APICore）
  console.warn(`[API DETECTOR] 无法识别Task ID格式，默认使用APICore: ${taskId}`);
  return 'apicore';
}

/**
 * 检查Task ID是否为有效的APICore UUID格式
 */
export function isApicoreTaskId(taskId: string): boolean {
  return detectApiProvider(taskId) === 'apicore';
}

/**
 * 检查Task ID是否为青云API格式
 */
export function isQingyunTaskId(taskId: string): boolean {
  return detectApiProvider(taskId) === 'qingyun';
}

/**
 * 获取适合的API服务实例
 */
export async function getApiServiceForTaskId(taskId: string) {
  const provider = detectApiProvider(taskId);
  
  if (provider === 'apicore') {
    const { getApicoreApiService } = await import('../services/veo/ApicoreApiService');
    const apiKey = import.meta.env.VITE_APICORE_API_KEY;
    const endpoint = import.meta.env.VITE_APICORE_ENDPOINT || 'https://api.apicore.ai';
    
    if (!apiKey) {
      throw new Error('APICore API key not configured');
    }
    
    return getApicoreApiService({ apiKey, endpoint });
  } else {
    const { getQingyunApiService } = await import('../services/veo/QingyunApiService');
    const apiKey = import.meta.env.QINGYUN_API_KEY || process.env.QINGYUN_API_KEY;
    const endpoint = import.meta.env.QINGYUN_API_ENDPOINT || process.env.QINGYUN_API_ENDPOINT || 'https://api.qingyuntop.top';
    
    if (!apiKey) {
      throw new Error('Qingyun API key not configured');
    }
    
    return getQingyunApiService({ apiKey, endpoint });
  }
}

/**
 * 格式化Task ID用于显示
 */
export function formatTaskIdForDisplay(taskId: string): string {
  const provider = detectApiProvider(taskId);
  
  if (provider === 'apicore') {
    return `APICore:${taskId.slice(0, 8)}...${taskId.slice(-8)}`;
  } else {
    return `青云:${taskId}`;
  }
}

/**
 * 获取API提供商的显示名称
 */
export function getApiProviderDisplayName(provider: ApiProvider): string {
  switch (provider) {
    case 'apicore':
      return 'APICore';
    case 'qingyun':
      return '青云API';
    default:
      return '未知API';
  }
}