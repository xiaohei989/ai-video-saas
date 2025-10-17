/**
 * VEO API 抽象层
 * 统一定义所有VEO视频生成API的通用接口
 */

/**
 * 统一的API调用参数
 */
export interface VeoApiParams {
  endpoint_url: string;           // API基础地址
  key: string;                    // API密钥
  model_name: string;             // 模型名称 (veo3, veo3-fast, veo3-pro, veo3.1-fast, veo3.1-pro等)
  prompt: string;                 // 提示词
  type: 'text2video' | 'img2video';  // 生成类型
  img_url?: string[];             // 图片URL列表 (img2video时必填)
  ratio?: '16:9' | '9:16';        // 视频比例
}

/**
 * 统一的任务响应格式
 */
export interface VeoTaskResponse {
  taskId: string;                 // 任务ID
  status: 'queued' | 'processing' | 'completed' | 'failed';  // 标准化状态
  video_url?: string;             // 视频URL
  fail_reason?: string;           // 失败原因
  progress?: number;              // 进度百分比 (0-100)
  created_at?: string;            // 创建时间
  updated_at?: string;            // 更新时间
}

/**
 * API配置接口
 */
export interface VeoApiConfig {
  apiKey: string;
  endpoint: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * VEO API 服务抽象接口
 * 所有具体的API服务类都需要实现这个接口
 */
export interface IVeoApiService {
  /**
   * 创建视频生成任务
   */
  createVideo(params: VeoApiParams): Promise<VeoTaskResponse>;

  /**
   * 查询任务状态
   */
  queryStatus(taskId: string): Promise<VeoTaskResponse>;

  /**
   * 轮询任务直到完成
   */
  pollUntilComplete(
    taskId: string,
    onProgress?: (progress: number) => void,
    maxAttempts?: number,
    baseInterval?: number
  ): Promise<VeoTaskResponse>;

  /**
   * 验证API密钥
   */
  validateApiKey(): Promise<boolean>;

  /**
   * 获取支持的模型列表
   */
  getSupportedModels(): string[];
}

/**
 * 模型到端点的映射配置
 */
export interface ModelEndpointMapping {
  [modelName: string]: {
    endpoint: string;           // 相对端点路径
    supportedRatios: string[];  // 支持的比例
    supportedTypes: string[];   // 支持的类型
  };
}

/**
 * 标准化状态码映射
 */
export const STATUS_MAPPING = {
  QUEUED: ['queued', 'pending', 0, '0'],
  PROCESSING: ['processing', 'generating', 'in_progress', 3, '3'],
  COMPLETED: ['completed', 'success', 'finished', 1, '1'],
  FAILED: ['failed', 'error', 2, '2']
} as const;

/**
 * 标准化状态工具函数
 */
export function normalizeStatus(status: any): VeoTaskResponse['status'] {
  const statusStr = String(status).toLowerCase();

  if (STATUS_MAPPING.QUEUED.some(s => String(s) === statusStr || String(s).toLowerCase() === statusStr)) {
    return 'queued';
  }
  if (STATUS_MAPPING.PROCESSING.some(s => String(s) === statusStr || String(s).toLowerCase() === statusStr)) {
    return 'processing';
  }
  if (STATUS_MAPPING.COMPLETED.some(s => String(s) === statusStr || String(s).toLowerCase() === statusStr)) {
    return 'completed';
  }
  if (STATUS_MAPPING.FAILED.some(s => String(s) === statusStr || String(s).toLowerCase() === statusStr)) {
    return 'failed';
  }

  return 'queued'; // 默认返回排队中
}
