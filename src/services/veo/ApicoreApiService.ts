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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
      role: string;
    };
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class ApicoreApiService {
  private config: ApicoreApiConfig;
  private headers: HeadersInit;
  private instanceId: string; // 实例唯一标识

  constructor(config: ApicoreApiConfig) {
    // 直接使用提供的endpoint
    const defaultEndpoint = 'https://api.apicore.ai';
    
    this.config = {
      ...config,
      endpoint: config.endpoint || defaultEndpoint,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3
    };
    
    // 🔧 按API官方示例，使用Headers构造函数和最简化配置
    this.headers = new Headers();
    this.headers.append('Authorization', `Bearer ${config.apiKey}`);
    
    this.instanceId = `apicore-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('[APICORE API] Service initialized');
    console.log('[APICORE API] Instance ID:', this.instanceId);
    console.log('[APICORE API] Original endpoint from config:', config.endpoint);
    console.log('[APICORE API] Final endpoint after processing:', this.config.endpoint);
    console.log('[APICORE API] Environment VITE_APICORE_ENDPOINT:', import.meta.env.VITE_APICORE_ENDPOINT || 'undefined');
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
    // console.log(`[APICORE API] === 查询任务状态: ${taskId} ===`);
    
    // 首先尝试GET请求
    try {
      // console.log(`[APICORE API] 尝试GET请求查询状态...`);
      const result = await this.queryStatusWithGet(taskId);
      // console.log(`[APICORE API] GET请求成功，状态:`, JSON.stringify(result, null, 2));
      return result;
    } catch (corsError) {
      console.warn(`[APICORE API] GET请求失败，尝试POST fallback:`, corsError);
      
      try {
        // console.log(`[APICORE API] 尝试POST请求查询状态...`);
        const result = await this.queryStatusWithPost(taskId);
        // console.log(`[APICORE API] POST请求成功，状态:`, JSON.stringify(result, null, 2));
        return result;
      } catch (postError) {
        console.warn(`[APICORE API] POST请求也失败，使用模拟进度:`, postError);
        const mockResult = this.getMockProgressStatus(taskId);
        // console.log(`[APICORE API] 使用模拟状态:`, JSON.stringify(mockResult, null, 2));
        return mockResult;
      }
    }
  }

  /**
   * 使用GET请求查询状态
   */
  private async queryStatusWithGet(taskId: string): Promise<ApicoreTaskResponse> {
    const encodedTaskId = encodeURIComponent(taskId);
    const queryUrl = `${this.config.endpoint}/v1/video/generations/${encodedTaskId}`;
    
    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[APICORE API] Query failed - Status: ${response.status}, Body: ${errorBody}`);
        throw new Error(`Query Error (${response.status}): ${errorBody || response.statusText}`);
      }

      const responseText = await response.text();
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from APICore');
      }
      
      const result = JSON.parse(responseText);
      
      return result;
  }

  /**
   * 使用POST请求查询状态（fallback方案）
   */
  private async queryStatusWithPost(taskId: string): Promise<ApicoreTaskResponse> {
    const response = await fetch(`${this.config.endpoint}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'query',
        taskId: taskId
      })
    });

    if (!response.ok) {
      throw new Error(`POST查询失败: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 获取模拟状态（最后的fallback） - 只返回状态，不返回进度
   */
  private getMockProgressStatus(taskId: string): ApicoreTaskResponse {
    return {
      code: 'success',
      data: {
        status: 'IN_PROGRESS',
        taskId: taskId
      },
      status: 'IN_PROGRESS'
    };
  }

  /**
   * 原始查询状态方法的剩余部分
   */
  private async finishStatusQuery(error: any): Promise<never> {
    console.error('[APICORE API] Query status failed:', error);
    throw error;
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
    console.log(`[APICORE API] 开始轮询任务: ${taskId}`);

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
        const failReason = status.data?.fail_reason || status.data?.data?.failReason || status.data?.data?.fail_reason;
        const apiProgress = status.data?.progress;
        
        // 只在状态变化时记录时间
        if (currentStatus !== lastStatus) {
          if (lastStatus) { // 只在实际状态变化时输出（跳过initial）
            console.log(`[APICORE API] ${lastStatus} -> ${currentStatus}`);
          }
          statusStartTimes[currentStatus] = Date.now();
          lastStatus = currentStatus;
        }
        
        // 只在有真实API进度时报告，否则让ProgressManager统一管理
        if (apiProgress) {
          const match = apiProgress.match(/(\d+)%?/);
          if (match) {
            const progressNum = parseInt(match[1]);
            if (!isNaN(progressNum) && progressNum >= 0 && progressNum <= 100) {
              onProgress?.(progressNum);
            }
          }
        }

        // 检查完成条件
        const isCompleted = 
          currentStatus === 'SUCCESS' || 
          currentStatus === 'COMPLETED' ||
          currentStatus === 'COMPLETE' ||
          (videoUrl && videoUrl.length > 0);

        if (isCompleted) {
          if (videoUrl) {
            console.log(`[APICORE API] 视频生成完成: ${videoUrl}`);
            
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
        if (currentStatus === 'FAILED' || currentStatus === 'ERROR' || currentStatus === 'FAILURE') {
          const errorMsg = failReason || status.data?.message || currentStatus;
          console.error('[APICORE API] Task failed:', errorMsg);
          throw new Error(`Video generation failed: ${errorMsg}`);
        }

        // 在轮询即将超时前，最后检查一次是否有video_url
        if (attempts >= maxAttempts - 2) {
          try {
            const finalStatus = await this.queryStatus(taskId);
            const finalVideoUrl = finalStatus.data?.data?.videoUrl || finalStatus.data?.videoUrl || finalStatus.videoUrl || finalStatus.video_url;
            if (finalVideoUrl && finalVideoUrl.length > 0) {
              console.log(`[APICORE API] 找到视频URL: ${finalVideoUrl}`);
              
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
            // 静默处理最终检查失败
          }
        }

        // 智能轮询间隔
        const interval = this.getPollingInterval(attempts, baseInterval);
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
           message.includes('FAILED') || // 任务失败（大写）
           message.includes('failed') || // 任务失败（小写）
           message.includes('failure') || // 失败状态
           message.includes('ERROR') ||   // 错误状态（大写）
           message.includes('error');     // 错误状态（小写）
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

  /**
   * 大模型文本生成 - 支持GPT和Claude模型
   */
  async generateText(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    console.log(`[APICORE API] 开始文本生成，模型: ${request.model}`);
    console.log(`[APICORE API] 消息数量: ${request.messages.length}`);
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const headers = new Headers();
        headers.append('Authorization', `Bearer ${this.config.apiKey}`);
        headers.append('Content-Type', 'application/json');
        
        const requestOptions = {
          method: 'POST' as const,
          headers: headers,
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            max_tokens: request.max_tokens || 500,
            temperature: request.temperature || 0.7,
            ...(request.response_format && { response_format: request.response_format })
          }),
          redirect: 'follow' as RequestRedirect
        };
        
        console.log(`[APICORE API] 发送文本生成请求 (尝试 ${attempt}/${this.config.maxRetries})`);
        
        const response = await fetch(`${this.config.endpoint}/v1/chat/completions`, requestOptions);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API Error (${response.status}): ${errorBody || response.statusText}`);
        }

        const result = await response.json();
        
        console.log(`[APICORE API] 文本生成成功，tokens使用:`, {
          prompt_tokens: result.usage?.prompt_tokens,
          completion_tokens: result.usage?.completion_tokens,
          total_tokens: result.usage?.total_tokens
        });
        
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`[APICORE API] 文本生成尝试 ${attempt} 失败:`, error);
        
        if (attempt < this.config.maxRetries!) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[APICORE API] ${delay}ms 后重试...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('文本生成失败');
  }

  /**
   * 快捷方法：生成简单文本响应
   */
  async generateSimpleText(
    prompt: string, 
    model: string = 'gpt-3.5-turbo-0125',
    options: {
      maxTokens?: number;
      temperature?: number;
      jsonMode?: boolean;
    } = {}
  ): Promise<string> {
    const request: ChatCompletionRequest = {
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.7,
      ...(options.jsonMode && { response_format: { type: 'json_object' } })
    };

    const response = await this.generateText(request);
    
    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('API响应格式不正确');
    }

    return response.choices[0].message.content;
  }

  /**
   * 检查模型是否支持文本生成
   */
  supportsTextGeneration(model: string): boolean {
    const supportedModels = [
      'gpt-3.5-turbo-0125',
      'gpt-4o-mini',
      'gpt-4o',
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229'
    ];
    
    return supportedModels.includes(model);
  }
}

// 导出单例
let instance: ApicoreApiService | null = null;
let instanceConfig: ApicoreApiConfig | null = null;
// 全局实例追踪（用于检测冲突）
const activeInstances = new Set<string>();

export function getApicoreApiService(config?: ApicoreApiConfig): ApicoreApiService {
  // 如果配置发生变化，重新创建实例
  if (config && (!instance || !instanceConfig || instanceConfig.endpoint !== config.endpoint)) {
    // 清理旧实例
    if (instance && (instance as any).instanceId) {
      activeInstances.delete((instance as any).instanceId);
      console.log('[APICORE API] Removing old instance:', (instance as any).instanceId);
    }
    
    console.log('[APICORE API] Creating new instance with config:', config);
    instance = new ApicoreApiService(config);
    instanceConfig = { ...config };
    
    // 注册新实例
    activeInstances.add((instance as any).instanceId);
    console.log('[APICORE API] Active instances:', Array.from(activeInstances));
  } else if (!instance) {
    throw new Error('ApicoreApiService not initialized. Please provide configuration.');
  }
  return instance;
}

// 强制重置实例（用于调试）
export function resetApicoreApiService(): void {
  console.log('[APICORE API] Force resetting service instance');
  if (instance && (instance as any).instanceId) {
    activeInstances.delete((instance as any).instanceId);
  }
  activeInstances.clear();
  instance = null;
  instanceConfig = null;
  console.log('[APICORE API] All instances cleared');
}

export default ApicoreApiService;