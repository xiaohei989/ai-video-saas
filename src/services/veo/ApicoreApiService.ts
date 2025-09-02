/**
 * APICore Service for Video Generation
 * 支持8种Veo3模型组合：fast/pro × 纯文字/带图片 × 16:9/9:16
 */

export interface ApicoreCreateRequest {
  prompt: string;
  model: 'veo3-fast' | 'veo3-fast-aspect' | 'veo3-fast-frames' | 'veo3-fast-frames-aspect' |
         'veo3-pro' | 'veo3-pro-aspect' | 'veo3-pro-frames' | 'veo3-pro-frames-aspect';
  enhance_prompt?: boolean;
  aspect_ratio?: '16:9' | '9:16';
  images?: string[];
}

export interface ApicoreTaskResponse {
  code?: string;  // API响应状态码 (success/error)
  message?: string;
  data?: {
    taskId?: string;
    status?: 'SUCCESS' | 'PROCESSING' | 'FAILED' | 'IN_PROGRESS';
    progress?: string;
    videoUrl?: string;
    fail_reason?: string;
  };
  // 向后兼容字段
  status?: 'SUCCESS' | 'PROCESSING' | 'FAILED' | 'IN_PROGRESS';
  videoUrl?: string;
  video_url?: string;
}

export interface ApicoreApiConfig {
  apiKey: string;
  endpoint: string;
  timeout?: number;
  maxRetries?: number;
}

class ApicoreApiService {
  private config: ApicoreApiConfig;
  private headers: HeadersInit;

  constructor(config: ApicoreApiConfig) {
    this.config = {
      ...config,
      endpoint: config.endpoint || 'https://api.apicore.ai',
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3
    };
    
    // 🔧 按API官方示例，使用Headers构造函数和最简化配置
    this.headers = new Headers();
    this.headers.append('Authorization', `Bearer ${config.apiKey}`);
    
    console.log('[APICORE API] Service initialized');
  }

  /**
   * 智能选择模型
   * @param quality - 质量设置：fast（快速）或 pro（高质量）
   * @param hasImages - 是否包含图片
   * @param aspectRatio - 宽高比：16:9 或 9:16
   */
  selectModel(
    quality: 'fast' | 'pro', 
    hasImages: boolean, 
    aspectRatio: '16:9' | '9:16' = '16:9'
  ): ApicoreCreateRequest['model'] {
    let model = `veo3-${quality}` as string;
    
    if (hasImages) {
      model += '-frames';
    }
    
    if (aspectRatio === '9:16') {
      model += '-aspect';
    }
    
    return model as ApicoreCreateRequest['model'];
  }

  /**
   * 创建视频生成任务
   */
  async createVideo(request: ApicoreCreateRequest): Promise<ApicoreTaskResponse> {
    console.log('[APICORE API] === 创建视频任务 ===');
    console.log('[APICORE API] Model:', request.model);
    console.log('[APICORE API] Prompt:', request.prompt);
    console.log('[APICORE API] Images:', request.images?.length || 0, 'images');
    console.log('[APICORE API] Aspect Ratio:', request.aspect_ratio);
    console.log('[APICORE API] Enhance prompt:', request.enhance_prompt !== false);

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        // 🔧 为POST请求需要添加Content-Type，与GET不同
        const postHeaders = new Headers();
        postHeaders.append('Authorization', `Bearer ${this.config.apiKey}`);
        postHeaders.append('Content-Type', 'application/json');
        
        const requestOptions = {
          method: 'POST' as const,
          headers: postHeaders,
          body: JSON.stringify({
            ...request,
            enhance_prompt: request.enhance_prompt !== false
          }),
          redirect: 'follow' as RequestRedirect
        };
        
        console.log(`[APICORE API] 🛠️ POST请求配置:`, {
          method: requestOptions.method,
          headers: Array.from(postHeaders.entries()),
          bodyLength: requestOptions.body.length
        });
        
        const response = await fetch(`${this.config.endpoint}/v1/video/generations`, requestOptions);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API Error (${response.status}): ${errorBody || response.statusText}`);
        }

        const result = await response.json();
        console.log('[APICORE API] Task created successfully');
        console.log('[APICORE API] Full response:', JSON.stringify(result, null, 2));
        console.log('[APICORE API] Task ID:', result.data);
        console.log('[APICORE API] Status:', result.code);
        console.log('[APICORE API] Message:', result.message);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`[APICORE API] Attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.maxRetries!) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[APICORE API] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Failed to create video task');
  }

  /**
   * 查询任务状态
   */
  async queryStatus(taskId: string): Promise<ApicoreTaskResponse> {
    // 🔍 详细ID追踪日志
    console.log(`[APICORE API] 🎯 查询任务状态 - 原始Task ID: ${taskId}`);
    console.log(`[APICORE API] 🎯 Task ID类型: ${typeof taskId}`);
    console.log(`[APICORE API] 🎯 Task ID长度: ${taskId.length}`);
    
    const encodedTaskId = encodeURIComponent(taskId);
    const queryUrl = `${this.config.endpoint}/v1/video/generations/${encodedTaskId}`;
    console.log(`[APICORE API] 🔗 完整查询URL: ${queryUrl}`);
    console.log(`[APICORE API] 🔗 编码后Task ID: ${encodedTaskId}`);
    
    try {
      // 🔧 完全按照API官方示例实现
      const requestOptions = {
        method: 'GET' as const,
        headers: this.headers,
        redirect: 'follow' as RequestRedirect
      };
      
      console.log(`[APICORE API] 🛠️ 请求配置:`, requestOptions);
      console.log(`[APICORE API] 🛠️ Headers:`, Array.from((this.headers as Headers).entries()));
      
      const response = await fetch(queryUrl, requestOptions);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[APICORE API] Query failed - Status: ${response.status}, Body: ${errorBody}`);
        throw new Error(`Query Error (${response.status}): ${errorBody || response.statusText}`);
      }

      // 🔧 按API官方示例：先使用response.text()再解析
      const responseText = await response.text();
      console.log(`[APICORE API] 📝 原始响应: ${responseText}`);
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from APICore');
      }
      
      let result;
      try {
        result = JSON.parse(responseText);
        console.log(`[APICORE API] ✅ JSON解析成功:`, result);
      } catch (parseError) {
        console.error(`[APICORE API] ❌ JSON解析失败: ${parseError}`);
        console.error(`[APICORE API] 原始文本: ${responseText}`);
        throw new Error(`Invalid JSON response: ${parseError}`);
      }
      
      // 添加详细的状态日志
      console.log('[APICORE API] Query response:', {
        taskId,
        status: result.status,
        progress: result.progress,
        video_url: result.videoUrl || result.video_url ? 'EXISTS' : 'NULL',
        full_response: JSON.stringify(result)
      });
      
      return result;
    } catch (error) {
      console.error('[APICORE API] Query status failed:', error);
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
  ): Promise<ApicoreTaskResponse> {
    console.log('[APICORE API] === 开始轮询任务状态 ===');
    console.log(`[APICORE API] 🎯 接收到的Task ID: ${taskId}`);
    console.log(`[APICORE API] 🎯 Task ID类型: ${typeof taskId}`);
    console.log(`[APICORE API] 🎯 Task ID长度: ${taskId ? taskId.length : 'undefined'}`);
    console.log(`[APICORE API] 🎯 Task ID格式检查: ${taskId && /^[0-9a-f-]{36}$/.test(taskId) ? 'UUID格式正确' : 'UUID格式错误'}`);
    console.log(`[APICORE API] Max attempts: ${maxAttempts}, Base interval: ${baseInterval}ms`);

    let attempts = 0;
    let lastStatus: string | null = null;
    const startTime = Date.now();
    let statusStartTimes: Record<string, number> = {};

    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const status = await this.queryStatus(taskId);
        
        // 处理双层嵌套的数据结构（根据curl测试结果更新）
        // curl显示响应格式：{ code, data: { status, data: { videoUrl } } }
        const currentStatus = status.data?.status || status.data?.data?.status || status.status || 'UNKNOWN';
        const videoUrl = status.data?.data?.videoUrl || status.data?.videoUrl || status.videoUrl || status.video_url;
        const failReason = status.data?.fail_reason;
        const apiProgress = status.data?.progress;
        
        // 只在状态变化时打印日志和记录时间
        if (currentStatus !== lastStatus) {
          console.log(`[APICORE API] Status changed: ${lastStatus || 'initial'} -> ${currentStatus}`);
          statusStartTimes[currentStatus] = Date.now();
          lastStatus = currentStatus;
        }
        
        // 计算并报告进度
        const currentTime = Date.now();
        const totalElapsed = currentTime - startTime;
        const calculatedProgress = this.calculateProgress(currentStatus, attempts, maxAttempts, totalElapsed, statusStartTimes, apiProgress);
        console.log(`[APICORE API] Attempt ${attempts}/${maxAttempts}, Progress: ${calculatedProgress}%, Elapsed: ${Math.round(totalElapsed/1000)}s`);
        console.log(`[APICORE API] API Progress: ${apiProgress}, Calculated Progress: ${calculatedProgress}`);
        onProgress?.(calculatedProgress);

        // 检查完成条件
        const isCompleted = 
          currentStatus === 'SUCCESS' || 
          currentStatus === 'COMPLETED' ||
          currentStatus === 'COMPLETE' ||
          (videoUrl && videoUrl.length > 0);

        console.log('[APICORE API] Completion check:', {
          status: currentStatus,
          hasVideoUrl: !!videoUrl,
          isCompleted: isCompleted
        });

        if (isCompleted) {
          if (videoUrl) {
            console.log('[APICORE API] === 视频生成完成 ===');
            console.log('[APICORE API] Original Status:', currentStatus);
            console.log('[APICORE API] Video URL:', videoUrl);
            
            // 标准化返回格式
            const finalResult: ApicoreTaskResponse = {
              ...status,
              status: 'SUCCESS',
              data: {
                ...status.data,
                status: 'SUCCESS',
                data: {
                  ...status.data?.data,
                  status: 'SUCCESS',
                  videoUrl: videoUrl
                }
              },
              video_url: videoUrl,
              videoUrl: videoUrl
            };
            onProgress?.(100);
            return finalResult;
          } else {
            console.warn('[APICORE API] Status shows completed but no video URL:', currentStatus);
            // 继续轮询，可能URL还在准备中
          }
        }

        // 检查失败状态
        if (currentStatus === 'FAILED' || currentStatus === 'ERROR') {
          const errorMsg = failReason || currentStatus;
          console.error('[APICORE API] Task failed:', errorMsg);
          throw new Error(`Video generation failed: ${errorMsg}`);
        }

        // 在轮询即将超时前，最后检查一次是否有video_url
        if (attempts >= maxAttempts - 2) {
          console.log('[APICORE API] Near timeout, performing final URL check...');
          try {
            const finalStatus = await this.queryStatus(taskId);
            const finalVideoUrl = finalStatus.data?.data?.videoUrl || finalStatus.data?.videoUrl || finalStatus.videoUrl || finalStatus.video_url;
            if (finalVideoUrl && finalVideoUrl.length > 0) {
              console.log('[APICORE API] === 找到视频URL (最终检查) ===');
              console.log('[APICORE API] Final Status:', finalStatus.data?.status || finalStatus.data?.data?.status || finalStatus.status || finalStatus.code);
              console.log('[APICORE API] Video URL:', finalVideoUrl);
              
              const finalResult: ApicoreTaskResponse = {
                ...finalStatus,
                status: 'SUCCESS',
                data: {
                  ...finalStatus.data,
                  status: 'SUCCESS',
                  videoUrl: finalVideoUrl
                },
                video_url: finalVideoUrl,
                videoUrl: finalVideoUrl
              };
              onProgress?.(100);
              return finalResult;
            }
          } catch (finalError) {
            console.warn('[APICORE API] Final check failed:', finalError);
          }
        }

        // 智能轮询间隔
        const interval = this.getPollingInterval(attempts, baseInterval);
        console.log(`[APICORE API] Next check in ${interval / 1000}s`);
        await this.sleep(interval);
        
      } catch (error) {
        console.error(`[APICORE API] Polling error (attempt ${attempts}):`, error);
        
        // 如果是最后一次尝试或者是致命错误，抛出异常
        if (attempts >= maxAttempts || this.isFatalError(error)) {
          throw error;
        }
        
        // 否则继续尝试
        await this.sleep(baseInterval);
      }
    }

    // 轮询超时前的最后努力
    console.log('[APICORE API] Polling timeout, making final attempt...');
    try {
      const timeoutStatus = await this.queryStatus(taskId);
      const timeoutVideoUrl = timeoutStatus.data?.data?.videoUrl || timeoutStatus.data?.videoUrl || timeoutStatus.videoUrl || timeoutStatus.video_url;
      if (timeoutVideoUrl && timeoutVideoUrl.length > 0) {
        console.log('[APICORE API] === 超时救援成功！找到视频URL ===');
        console.log('[APICORE API] Timeout Status:', timeoutStatus.data?.status || timeoutStatus.data?.data?.status || timeoutStatus.status || timeoutStatus.code);
        console.log('[APICORE API] Video URL:', timeoutVideoUrl);
        
        const finalResult: ApicoreTaskResponse = {
          ...timeoutStatus,
          status: 'SUCCESS',
          data: {
            ...timeoutStatus.data,
            status: 'SUCCESS',
            videoUrl: timeoutVideoUrl
          },
          video_url: timeoutVideoUrl,
          videoUrl: timeoutVideoUrl
        };
        onProgress?.(100);
        return finalResult;
      }
    } catch (timeoutError) {
      console.error('[APICORE API] Timeout rescue failed:', timeoutError);
    }

    console.error('[APICORE API] Polling timeout - no video URL found');
    throw new Error(`Video generation timeout after ${maxAttempts} attempts`);
  }

  /**
   * 改进的进度计算算法
   */
  private calculateProgress(
    status: string, 
    attempts: number, 
    maxAttempts: number, 
    totalElapsed: number,
    statusStartTimes: Record<string, number>,
    apiProgress?: string
  ): number {
    // 如果API返回了进度百分比，优先使用
    if (apiProgress) {
      const match = apiProgress.match(/(\d+)%?/);
      if (match) {
        const progressNum = parseInt(match[1]);
        if (!isNaN(progressNum) && progressNum >= 0 && progressNum <= 100) {
          return progressNum;
        }
      }
    }

    // 预期总时长（毫秒）
    const expectedDuration = 90000; // 90秒
    
    // 基于时间的基础进度（0-80%）
    const timeBasedProgress = Math.min((totalElapsed / expectedDuration) * 80, 80);
    
    switch (status) {
      case 'SUCCESS':
      case 'COMPLETED':
      case 'COMPLETE':
        return 100;
      case 'FAILED':
      case 'ERROR':
        return 0;
      case 'IN_PROGRESS':
      case 'PROCESSING':
        // 处理中：根据时间和尝试次数计算
        const processTime = statusStartTimes[status] ? Date.now() - statusStartTimes[status] : 0;
        const processProgress = 20 + (processTime / 70000) * 75; // 70秒内从20%到95%
        const attemptProgress = 20 + (attempts * 75 / maxAttempts);
        return Math.min(Math.max(processProgress, attemptProgress, timeBasedProgress * 0.8), 99);
      default:
        // 未知状态：使用时间基础进度
        return Math.min(timeBasedProgress, 40);
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
           message.includes('FAILED') || // 任务失败
           message.includes('ERROR');   // 错误状态
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
      console.log('[APICORE API] Validating API key...');
      
      // 尝试创建一个简单的任务来验证密钥
      const testRequest: ApicoreCreateRequest = {
        prompt: 'test',
        model: 'veo3-fast',
        enhance_prompt: false
      };
      
      const response = await fetch(`${this.config.endpoint}/v1/video/generations`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(testRequest),
        signal: AbortSignal.timeout(5000)
      });
      
      // 如果返回401，说明密钥无效
      if (response.status === 401) {
        console.error('[APICORE API] API key is invalid');
        return false;
      }
      
      // 其他状态码都认为密钥有效（包括配额限制等）
      console.log('[APICORE API] API key is valid');
      return true;
    } catch (error) {
      console.error('[APICORE API] API key validation failed:', error);
      return false;
    }
  }

  /**
   * 获取支持的模型列表
   */
  getSupportedModels(): ApicoreCreateRequest['model'][] {
    return [
      'veo3-fast',
      'veo3-fast-aspect',
      'veo3-fast-frames',
      'veo3-fast-frames-aspect',
      'veo3-pro',
      'veo3-pro-aspect',
      'veo3-pro-frames',
      'veo3-pro-frames-aspect'
    ];
  }

  /**
   * 检查模型是否支持特定功能
   */
  modelSupportsFeature(model: ApicoreCreateRequest['model'], feature: 'images' | 'aspect_9_16'): boolean {
    if (feature === 'images') {
      return model.includes('-frames');
    }
    if (feature === 'aspect_9_16') {
      return model.includes('-aspect');
    }
    return false;
  }
}

// 导出单例
let instance: ApicoreApiService | null = null;

export function getApicoreApiService(config?: ApicoreApiConfig): ApicoreApiService {
  if (!instance && config) {
    instance = new ApicoreApiService(config);
  } else if (!instance) {
    throw new Error('ApicoreApiService not initialized. Please provide configuration.');
  }
  return instance;
}

export default ApicoreApiService;