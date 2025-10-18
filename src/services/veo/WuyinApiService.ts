/**
 * 无音科技 API Service for Video Generation
 * 支持多个VEO模型和端点的统一调度
 */

import type {
  IVeoApiService,
  VeoApiParams,
  VeoTaskResponse,
  VeoApiConfig,
  ModelEndpointMapping
} from './VeoApiAbstraction';
import { normalizeStatus } from './VeoApiAbstraction';

/**
 * 无音API的原始响应格式
 */
interface WuyinCreateResponse {
  code: number;
  msg: string;
  data: {
    id: number;
  };
}

interface WuyinQueryResponse {
  code: number;
  msg: string;
  data: {
    id: number;
    content: string;        // 视频URL
    status: number;         // 0:排队中, 1:成功, 2:失败, 3:生成中
    fail_reason: string;
    created_at: string;
    updated_at: string;
  };
}

/**
 * 无音API服务实现
 */
class WuyinApiService implements IVeoApiService {
  private config: VeoApiConfig;
  private headers: HeadersInit;
  // 🔧 FIX: 保存每个任务的上次进度值,确保单调递增
  private lastProgressMap = new Map<string, number>();

  /**
   * 模型到端点的映射配置
   */
  private readonly MODEL_ENDPOINTS: ModelEndpointMapping = {
    'veo3': {
      endpoint: '/api/video/veoPlus',
      supportedRatios: ['16:9', '9:16'],
      supportedTypes: ['text2video', 'img2video']
    },
    'veo3-fast': {
      endpoint: '/api/video/veo',
      supportedRatios: ['16:9', '9:16'],
      supportedTypes: ['text2video', 'img2video']
    },
    'veo3.1-fast': {
      endpoint: '/api/video/veo',
      supportedRatios: ['16:9', '9:16'],
      supportedTypes: ['text2video', 'img2video']
    },
    'veo3-pro': {
      endpoint: '/api/video/veoPro',
      supportedRatios: ['16:9', '9:16'],
      supportedTypes: ['text2video', 'img2video']
    },
    'veo3.1-pro': {
      endpoint: '/api/video/veoPro',
      supportedRatios: ['16:9', '9:16'],
      supportedTypes: ['text2video', 'img2video']
    }
  };

  constructor(config: VeoApiConfig) {
    this.config = {
      ...config,
      endpoint: config.endpoint || 'https://api.wuyinkeji.com',
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3
    };

    this.headers = {
      'Content-Type': 'application/json;charset=utf-8',
      'Authorization': config.apiKey
    };

    console.log('[WUYIN API] Service initialized');
    console.log('[WUYIN API] Endpoint:', this.config.endpoint);
  }

  /**
   * 根据模型名称选择正确的端点
   */
  private selectEndpoint(modelName: string): string {
    const mapping = this.MODEL_ENDPOINTS[modelName];
    if (!mapping) {
      console.warn(`[WUYIN API] Unknown model: ${modelName}, using default veo3 endpoint`);
      return this.MODEL_ENDPOINTS['veo3'].endpoint;
    }
    return mapping.endpoint;
  }

  /**
   * 验证参数是否符合模型要求
   */
  private validateParams(params: VeoApiParams): void {
    const mapping = this.MODEL_ENDPOINTS[params.model_name];
    if (!mapping) {
      throw new Error(`Unsupported model: ${params.model_name}`);
    }

    if (params.ratio && !mapping.supportedRatios.includes(params.ratio)) {
      throw new Error(`Model ${params.model_name} does not support ratio ${params.ratio}`);
    }

    if (!mapping.supportedTypes.includes(params.type)) {
      throw new Error(`Model ${params.model_name} does not support type ${params.type}`);
    }

    if (params.type === 'img2video' && (!params.img_url || params.img_url.length === 0)) {
      throw new Error('img_url is required for img2video type');
    }
  }

  /**
   * 创建视频生成任务
   */
  async createVideo(params: VeoApiParams): Promise<VeoTaskResponse> {
    console.log('[WUYIN API] === 创建视频任务 ===');
    console.log('[WUYIN API] Model:', params.model_name);
    console.log('[WUYIN API] Prompt:', params.prompt);
    console.log('[WUYIN API] Type:', params.type);
    console.log('[WUYIN API] Ratio:', params.ratio || '默认');

    // 验证参数
    this.validateParams(params);

    // 选择端点
    const endpoint = this.selectEndpoint(params.model_name);
    const fullUrl = `${this.config.endpoint}${endpoint}`;

    console.log('[WUYIN API] Selected endpoint:', fullUrl);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        // 构建请求体
        const requestBody: any = {
          model: params.model_name,
          prompt: params.prompt,
          type: params.type
        };

        // 添加可选参数
        if (params.ratio) {
          requestBody.ratio = params.ratio;
        }
        if (params.img_url && params.img_url.length > 0) {
          // 无音API只支持1张图片
          requestBody.img_url = params.img_url[0];
        }

        console.log('[WUYIN API] Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(this.config.timeout!)
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API Error (${response.status}): ${errorBody || response.statusText}`);
        }

        const result: WuyinCreateResponse = await response.json();

        console.log('[WUYIN API] Response:', JSON.stringify(result, null, 2));

        if (result.code !== 200) {
          throw new Error(`API returned error code ${result.code}: ${result.msg}`);
        }

        if (!result.data || !result.data.id) {
          throw new Error('No task ID in response');
        }

        console.log('[WUYIN API] Task created successfully, ID:', result.data.id);

        // 返回标准化的响应
        return {
          taskId: String(result.data.id),
          status: 'queued',
          created_at: new Date().toISOString()
        };

      } catch (error) {
        lastError = error as Error;
        console.error(`[WUYIN API] Attempt ${attempt} failed:`, error);

        if (attempt < this.config.maxRetries!) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[WUYIN API] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Failed to create video task');
  }

  /**
   * 查询任务状态
   */
  async queryStatus(taskId: string, quality?: 'fast' | 'pro', startTime?: Date): Promise<VeoTaskResponse> {
    try {
      // 无音API使用GET请求查询，参数通过URL传递
      const queryUrl = `${this.config.endpoint}/api/video/veoDetail?id=${encodeURIComponent(taskId)}`;

      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(this.config.timeout!)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Query Error (${response.status}): ${errorBody}`);
      }

      const result: WuyinQueryResponse = await response.json();

      // 详细日志
      console.log('[WUYIN API] Query response:', {
        taskId: taskId,
        code: result.code,
        status: result.data?.status,
        video_url: result.data?.content ? 'EXISTS' : 'NULL'
      });

      if (result.code !== 200) {
        throw new Error(`Query failed with code ${result.code}: ${result.msg}`);
      }

      // 标准化状态
      const normalizedStatus = normalizeStatus(result.data.status);

      // 🔧 智能进度计算 - 基于状态和已用时间
      let progress = 0;
      const elapsedSeconds = startTime ? Math.floor((Date.now() - startTime.getTime()) / 1000) : 0;

      switch (result.data.status) {
        case 0: // 排队中
          // 排队阶段: 10-15% 之间波动
          progress = Math.min(15, 10 + Math.floor(elapsedSeconds / 5));
          break;

        case 3: // 生成中 - 根据质量和时间智能估算
          if (quality === 'fast') {
            // Fast模式: 2分钟(120秒)完成
            // 生成阶段通常在20-110秒之间
            if (elapsedSeconds < 20) {
              progress = 20 + Math.floor(elapsedSeconds * 0.5); // 20-30%
            } else if (elapsedSeconds < 60) {
              progress = 30 + Math.floor((elapsedSeconds - 20) * 0.75); // 30-60%
            } else if (elapsedSeconds < 100) {
              progress = 60 + Math.floor((elapsedSeconds - 60) * 0.75); // 60-90%
            } else {
              progress = Math.min(95, 90 + Math.floor((elapsedSeconds - 100) / 4)); // 90-95%
            }
          } else {
            // Pro模式: 5分钟(300秒)完成
            // 生成阶段通常在60-280秒之间
            if (elapsedSeconds < 60) {
              progress = 15 + Math.floor(elapsedSeconds / 6); // 15-25%
            } else if (elapsedSeconds < 180) {
              progress = 25 + Math.floor((elapsedSeconds - 60) * 0.292); // 25-60%
            } else if (elapsedSeconds < 240) {
              progress = 60 + Math.floor((elapsedSeconds - 180) * 0.417); // 60-85%
            } else {
              progress = Math.min(95, 85 + Math.floor((elapsedSeconds - 240) / 6)); // 85-95%
            }
          }
          break;

        case 1: // 成功
          progress = 100;
          break;

        case 2: // 失败
          progress = 0;
          break;
      }

      // 🔧 FIX: 强制单调递增保护 - 避免移动端进度回退(50→25)
      const lastProgress = this.lastProgressMap.get(taskId) || 0;
      if (progress < lastProgress && lastProgress < 100) {
        console.log(`[WUYIN API] 🚫 进度回退保护: ${taskId} 保持${lastProgress}%, 拒绝${progress}% (elapsed: ${elapsedSeconds}s)`);
        progress = lastProgress;
      } else if (progress > lastProgress) {
        this.lastProgressMap.set(taskId, progress);
        console.log(`[WUYIN API] 📈 进度更新: ${taskId} ${lastProgress}% → ${progress}% (elapsed: ${elapsedSeconds}s)`);
      }

      // 返回标准化的响应
      return {
        taskId: String(result.data.id),
        status: normalizedStatus,
        video_url: result.data.content || undefined,
        fail_reason: result.data.fail_reason || undefined,
        progress: progress,
        created_at: result.data.created_at,
        updated_at: result.data.updated_at
      };

    } catch (error) {
      console.error('[WUYIN API] Query status failed:', error);
      throw error;
    }
  }

  /**
   * 轮询任务直到完成
   * @param externalStartTime - 🔧 FIX: 从外部传入统一的开始时间,避免移动端进度跳动
   */
  async pollUntilComplete(
    taskId: string,
    onProgress?: (progress: number) => void,
    maxAttempts: number = 60,
    baseInterval: number = 10000,
    quality: 'fast' | 'pro' = 'pro',
    externalStartTime?: Date  // 🔧 FIX: 新增参数,接收外部统一的开始时间
  ): Promise<VeoTaskResponse> {
    console.log('[WUYIN API] === 开始轮询任务状态 ===');
    console.log(`[WUYIN API] Task ID: ${taskId}`);
    console.log(`[WUYIN API] Max attempts: ${maxAttempts}, Base interval: ${baseInterval}ms, Quality: ${quality}`);

    let attempts = 0;
    let lastStatus: string | null = null;
    // 🔧 FIX: 优先使用外部传入的开始时间,确保时间计算的一致性
    const startTime = externalStartTime || new Date();

    if (externalStartTime) {
      console.log('[WUYIN API] 📅 Using external start time:', externalStartTime.toISOString());
    } else {
      console.log('[WUYIN API] ⚠️ No external start time provided, using current time');
    }

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const status = await this.queryStatus(taskId, quality, startTime);

        // 只在状态变化时打印日志
        if (status.status !== lastStatus) {
          console.log(`[WUYIN API] Status changed: ${lastStatus || 'initial'} -> ${status.status}`);
          lastStatus = status.status;
        }

        // 报告进度
        if (status.progress !== undefined && onProgress) {
          onProgress(status.progress);
        }

        // 检查完成条件
        if (status.status === 'completed' && status.video_url) {
          console.log('[WUYIN API] === 视频生成完成 ===');
          console.log('[WUYIN API] Video URL:', status.video_url);
          onProgress?.(100);
          // 🔧 FIX: 清理进度缓存
          this.lastProgressMap.delete(taskId);
          return status;
        }

        // 检查失败状态
        if (status.status === 'failed') {
          console.error('[WUYIN API] Task failed:', status.fail_reason);
          // 🔧 FIX: 清理进度缓存
          this.lastProgressMap.delete(taskId);
          throw new Error(`Video generation failed: ${status.fail_reason || 'Unknown error'}`);
        }

        // 智能轮询间隔
        const interval = this.getPollingInterval(attempts, baseInterval);
        console.log(`[WUYIN API] Attempt ${attempts}/${maxAttempts}, next check in ${interval / 1000}s`);
        await this.sleep(interval);

      } catch (error) {
        console.error(`[WUYIN API] Polling error (attempt ${attempts}):`, error);

        // 如果是最后一次尝试或者是致命错误，抛出异常
        if (attempts >= maxAttempts || this.isFatalError(error)) {
          throw error;
        }

        await this.sleep(baseInterval);
      }
    }

    // 轮询超时
    console.error('[WUYIN API] Polling timeout');
    throw new Error(`Video generation timeout after ${maxAttempts} attempts`);
  }

  /**
   * 验证API密钥
   */
  async validateApiKey(): Promise<boolean> {
    try {
      console.log('[WUYIN API] Validating API key...');

      // 尝试创建一个简单的任务来验证密钥
      const testParams: VeoApiParams = {
        endpoint_url: this.config.endpoint,
        key: this.config.apiKey,
        model_name: 'veo3-fast',
        prompt: 'test',
        type: 'text2video',
        ratio: '16:9'
      };

      // 只发送请求，不管结果
      const endpoint = this.selectEndpoint(testParams.model_name);
      const response = await fetch(`${this.config.endpoint}${endpoint}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: testParams.model_name,
          prompt: testParams.prompt,
          type: testParams.type
        }),
        signal: AbortSignal.timeout(5000)
      });

      // 如果返回401，说明密钥无效
      if (response.status === 401 || response.status === 403) {
        console.error('[WUYIN API] API key is invalid');
        return false;
      }

      console.log('[WUYIN API] API key is valid');
      return true;
    } catch (error) {
      console.error('[WUYIN API] API key validation failed:', error);
      return false;
    }
  }

  /**
   * 获取支持的模型列表
   */
  getSupportedModels(): string[] {
    return Object.keys(this.MODEL_ENDPOINTS);
  }

  /**
   * 智能轮询间隔
   */
  private getPollingInterval(attemptCount: number, baseInterval: number): number {
    if (attemptCount < 5) return baseInterval;           // 前5次：10秒
    if (attemptCount < 15) return baseInterval * 1.5;    // 5-15次：15秒
    if (attemptCount < 30) return baseInterval * 2;      // 15-30次：20秒
    return baseInterval * 3;                              // 之后：30秒
  }

  /**
   * 判断是否为致命错误
   */
  private isFatalError(error: any): boolean {
    const message = error?.message || '';
    return message.includes('401') ||
           message.includes('403') ||
           message.includes('404') ||
           message.includes('failed');
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
let instance: WuyinApiService | null = null;

export function getWuyinApiService(config?: VeoApiConfig): WuyinApiService {
  if (!instance && config) {
    instance = new WuyinApiService(config);
  } else if (!instance) {
    throw new Error('WuyinApiService not initialized. Please provide configuration.');
  }
  return instance;
}

export default WuyinApiService;
