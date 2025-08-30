/**
 * 青云API Service for Video Generation
 * 支持4种模型组合：fast/pro × 纯文字/带图片
 */

export interface QingyunCreateRequest {
  prompt: string;
  model: 'veo3-fast' | 'veo3-pro' | 'veo3-fast-frames' | 'veo3-pro-frames';
  images?: string[];
  enhance_prompt?: boolean;
}

export interface QingyunTaskResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url: string | null;
  enhanced_prompt?: string;
  status_update_time: number;
}

export interface QingyunApiConfig {
  apiKey: string;
  endpoint: string;
  timeout?: number;
  maxRetries?: number;
}

class QingyunApiService {
  private config: QingyunApiConfig;
  private headers: HeadersInit;

  constructor(config: QingyunApiConfig) {
    this.config = {
      ...config,
      endpoint: config.endpoint || 'https://api.qingyuntop.top',
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3
    };
    
    this.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    };
    
    console.log('[QINGYUN API] Service initialized');
  }

  /**
   * 智能选择模型
   * @param quality - 质量设置：fast（快速）或 pro（高质量）
   * @param hasImages - 是否包含图片
   */
  selectModel(quality: 'fast' | 'pro', hasImages: boolean): QingyunCreateRequest['model'] {
    if (hasImages) {
      return quality === 'pro' ? 'veo3-pro-frames' : 'veo3-fast-frames';
    } else {
      return quality === 'pro' ? 'veo3-pro' : 'veo3-fast';
    }
  }

  /**
   * 创建视频生成任务
   */
  async createVideo(request: QingyunCreateRequest): Promise<QingyunTaskResponse> {
    console.log('[QINGYUN API] === 创建视频任务 ===');
    console.log('[QINGYUN API] Model:', request.model);
    console.log('[QINGYUN API] Prompt:', request.prompt);
    console.log('[QINGYUN API] Images:', request.images?.length || 0, 'images');
    console.log('[QINGYUN API] Enhance prompt:', request.enhance_prompt !== false);

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const response = await fetch(`${this.config.endpoint}/v1/video/create`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(this.config.timeout!)
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API Error (${response.status}): ${errorBody || response.statusText}`);
        }

        const result = await response.json();
        console.log('[QINGYUN API] Task created:', result.id);
        console.log('[QINGYUN API] Initial status:', result.status);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`[QINGYUN API] Attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.maxRetries!) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[QINGYUN API] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Failed to create video task');
  }

  /**
   * 查询任务状态
   */
  async queryStatus(taskId: string): Promise<QingyunTaskResponse> {
    try {
      const response = await fetch(
        `${this.config.endpoint}/v1/video/query?id=${encodeURIComponent(taskId)}`,
        {
          method: 'GET',
          headers: this.headers,
          signal: AbortSignal.timeout(this.config.timeout!)
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Query Error (${response.status}): ${errorBody || response.statusText}`);
      }

      const result = await response.json();
      
      // 添加详细的状态日志
      console.log('[QINGYUN API] Query response:', {
        id: result.id,
        status: result.status,
        video_url: result.video_url ? 'EXISTS' : 'NULL',
        progress: result.progress,
        message: result.message,
        full_response: JSON.stringify(result)
      });
      
      return result;
    } catch (error) {
      console.error('[QINGYUN API] Query status failed:', error);
      throw error;
    }
  }

  /**
   * 轮询任务直到完成
   */
  async pollUntilComplete(
    taskId: string,
    onProgress?: (progress: number) => void,
    maxAttempts: number = 60,
    baseInterval: number = 10000
  ): Promise<QingyunTaskResponse> {
    console.log('[QINGYUN API] === 开始轮询任务状态 ===');
    console.log(`[QINGYUN API] Task ID: ${taskId}`);
    console.log(`[QINGYUN API] Max attempts: ${maxAttempts}, Base interval: ${baseInterval}ms`);

    let attempts = 0;
    let lastStatus: string | null = null;
    const startTime = Date.now(); // 记录开始时间
    let statusStartTimes: Record<string, number> = {}; // 记录每个状态的开始时间

    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const status = await this.queryStatus(taskId);
        
        // 只在状态变化时打印日志和记录时间
        if (status.status !== lastStatus) {
          console.log(`[QINGYUN API] Status changed: ${lastStatus || 'initial'} -> ${status.status}`);
          statusStartTimes[status.status] = Date.now();
          lastStatus = status.status;
        }
        
        // 计算并报告进度（基于时间和状态的混合算法）
        const currentTime = Date.now();
        const totalElapsed = currentTime - startTime;
        const progress = this.calculateProgressImproved(status.status, attempts, maxAttempts, totalElapsed, statusStartTimes);
        console.log(`[QINGYUN API] Attempt ${attempts}/${maxAttempts}, Progress: ${progress}%, Elapsed: ${Math.round(totalElapsed/1000)}s`);
        onProgress?.(progress);

        // 检查多种完成条件
        const isCompleted = 
          status.status === 'completed' || 
          status.status === 'complete' ||   // 可能的变体
          status.status === 'success' ||    // 可能的变体
          status.status === 'finished' ||   // 可能的变体
          (status.video_url && status.video_url.length > 0); // 有视频URL就认为完成

        console.log('[QINGYUN API] Completion check:', {
          status: status.status,
          hasVideoUrl: !!status.video_url,
          isCompleted: isCompleted
        });

        // 调试模式 - 显示更多详细信息
        const DEBUG_MODE = process.env.REACT_APP_DEBUG_VIDEO === 'true';
        if (DEBUG_MODE) {
          console.log('[DEBUG VIDEO] 🔍 Full API Response:', JSON.stringify(status, null, 2));
          console.log('[DEBUG VIDEO] 📊 Progress calculation:', progress);
          console.log('[DEBUG VIDEO] ✅ Status check result:', isCompleted);
          console.log('[DEBUG VIDEO] ⏱️ Time elapsed:', totalElapsed);
        }

        if (isCompleted) {
          if (status.video_url) {
            console.log('[QINGYUN API] === 视频生成完成 ===');
            console.log('[QINGYUN API] Original Status:', status.status);
            console.log('[QINGYUN API] Video URL:', status.video_url);
            
            // 强制设置状态为completed（标准化）
            status.status = 'completed';
            onProgress?.(100);
            return status;
          } else {
            console.warn('[QINGYUN API] Status shows completed but no video URL:', status.status);
            // 继续轮询，可能URL还在准备中
          }
        }

        // 检查失败状态
        if (status.status === 'failed') {
          console.error('[QINGYUN API] Task failed');
          throw new Error('Video generation failed');
        }

        // 在轮询即将超时前，最后检查一次是否有video_url
        if (attempts >= maxAttempts - 2) {
          console.log('[QINGYUN API] Near timeout, performing final URL check...');
          try {
            const finalStatus = await this.queryStatus(taskId);
            if (finalStatus.video_url && finalStatus.video_url.length > 0) {
              console.log('[QINGYUN API] === 找到视频URL (最终检查) ===');
              console.log('[QINGYUN API] Final Status:', finalStatus.status);
              console.log('[QINGYUN API] Video URL:', finalStatus.video_url);
              
              finalStatus.status = 'completed';
              onProgress?.(100);
              return finalStatus;
            }
          } catch (finalError) {
            console.warn('[QINGYUN API] Final check failed:', finalError);
          }
        }

        // 智能轮询间隔
        const interval = this.getPollingInterval(attempts, baseInterval);
        console.log(`[QINGYUN API] Next check in ${interval / 1000}s`);
        await this.sleep(interval);
        
      } catch (error) {
        console.error(`[QINGYUN API] Polling error (attempt ${attempts}):`, error);
        
        // 如果是最后一次尝试或者是致命错误，抛出异常
        if (attempts >= maxAttempts || this.isFatalError(error)) {
          throw error;
        }
        
        // 否则继续尝试
        await this.sleep(baseInterval);
      }
    }

    // 轮询超时前的最后努力
    console.log('[QINGYUN API] Polling timeout, making final attempt...');
    try {
      const timeoutStatus = await this.queryStatus(taskId);
      if (timeoutStatus.video_url && timeoutStatus.video_url.length > 0) {
        console.log('[QINGYUN API] === 超时救援成功！找到视频URL ===');
        console.log('[QINGYUN API] Timeout Status:', timeoutStatus.status);
        console.log('[QINGYUN API] Video URL:', timeoutStatus.video_url);
        
        timeoutStatus.status = 'completed';
        onProgress?.(100);
        return timeoutStatus;
      }
    } catch (timeoutError) {
      console.error('[QINGYUN API] Timeout rescue failed:', timeoutError);
    }

    console.error('[QINGYUN API] Polling timeout - no video URL found');
    throw new Error(`Video generation timeout after ${maxAttempts} attempts`);
  }

  /**
   * 计算进度百分比
   */
  /**
   * 改进的进度计算算法，基于时间和状态的混合模式
   */
  private calculateProgressImproved(
    status: string, 
    attempts: number, 
    maxAttempts: number, 
    totalElapsed: number,
    statusStartTimes: Record<string, number>
  ): number {
    // 预期总时长（毫秒） - 基于实际观察的平均时长
    const expectedDuration = 90000; // 90秒 (1.5分钟)
    
    // 基于时间的基础进度（0-80%）
    const timeBasedProgress = Math.min((totalElapsed / expectedDuration) * 80, 80);
    
    switch (status) {
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      case 'pending':
        // 等待中：5-25%，主要基于时间
        const pendingTime = statusStartTimes['pending'] ? Date.now() - statusStartTimes['pending'] : totalElapsed;
        const pendingProgress = Math.min(5 + (pendingTime / 20000) * 20, 25); // 20秒内达到25%
        return Math.max(timeBasedProgress * 0.3, pendingProgress);
        
      case 'video_generating':
        // 视频生成中：25-85%，混合时间和尝试次数
        const generateTime = statusStartTimes['video_generating'] ? Date.now() - statusStartTimes['video_generating'] : 0;
        const generateProgress = 25 + (generateTime / 60000) * 60; // 60秒内从25%到85%
        const attemptProgress = 25 + (attempts * 60 / maxAttempts);
        return Math.min(Math.max(generateProgress, attemptProgress, timeBasedProgress * 0.6), 85);
        
      case 'processing':
        // 后处理中：85-95%
        const processTime = statusStartTimes['processing'] ? Date.now() - statusStartTimes['processing'] : 0;
        const processProgress = 85 + (processTime / 10000) * 10; // 10秒内从85%到95%
        return Math.min(Math.max(processProgress, timeBasedProgress * 0.9), 99);
        
      default:
        // 未知状态：使用时间基础进度
        return Math.min(timeBasedProgress, 40);
    }
  }

  /**
   * 保留原始方法作为备用
   */
  private calculateProgress(status: string, attempts: number, maxAttempts: number): number {
    switch (status) {
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      case 'processing':
        // 处理中：50-95%
        return Math.min(50 + (attempts * 49 / maxAttempts), 99);
      case 'pending':
        // 等待中：10-50%
        return Math.min(10 + (attempts * 40 / maxAttempts), 50);
      case 'video_generating':
        // 视频生成中：20-90%
        return Math.min(20 + (attempts * 70 / maxAttempts), 90);
      default:
        // 未知状态
        return Math.min(5 + attempts, 45);
    }
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
    return message.includes('401') || // 认证失败
           message.includes('403') || // 权限不足
           message.includes('404') || // 任务不存在
           message.includes('failed'); // 任务失败
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 验证API密钥
   */
  async validateApiKey(): Promise<boolean> {
    try {
      console.log('[QINGYUN API] Validating API key...');
      
      // 尝试创建一个简单的任务来验证密钥
      const testRequest: QingyunCreateRequest = {
        prompt: 'test',
        model: 'veo3-fast',
        enhance_prompt: false
      };
      
      const response = await fetch(`${this.config.endpoint}/v1/video/create`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(testRequest),
        signal: AbortSignal.timeout(5000)
      });
      
      // 如果返回401，说明密钥无效
      if (response.status === 401) {
        console.error('[QINGYUN API] API key is invalid');
        return false;
      }
      
      // 其他状态码都认为密钥有效（包括配额限制等）
      console.log('[QINGYUN API] API key is valid');
      return true;
    } catch (error) {
      console.error('[QINGYUN API] API key validation failed:', error);
      return false;
    }
  }

  /**
   * 处理图片：将base64或File转换为URL
   * 注意：这里假设图片已经是URL格式，如果需要上传功能，需要额外实现
   */
  async processImages(images: (string | File)[]): Promise<string[]> {
    const processedImages: string[] = [];
    
    for (const image of images) {
      if (typeof image === 'string') {
        // 如果已经是URL，直接使用
        if (image.startsWith('http://') || image.startsWith('https://')) {
          processedImages.push(image);
        } else {
          // 如果是base64，需要上传到存储服务
          // 这里需要实现图片上传逻辑
          console.warn('[QINGYUN API] Base64 image upload not implemented yet');
          // const url = await this.uploadImage(image);
          // processedImages.push(url);
        }
      } else {
        // File对象需要转换并上传
        console.warn('[QINGYUN API] File upload not implemented yet');
        // const url = await this.uploadFile(image);
        // processedImages.push(url);
      }
    }
    
    return processedImages;
  }
}

// 导出单例
let instance: QingyunApiService | null = null;

export function getQingyunApiService(config?: QingyunApiConfig): QingyunApiService {
  if (!instance && config) {
    instance = new QingyunApiService(config);
  } else if (!instance) {
    throw new Error('QingyunApiService not initialized. Please provide configuration.');
  }
  return instance;
}

export default QingyunApiService;