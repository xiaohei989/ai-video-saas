/**
 * 缩略图URL优化器
 * 将现有的R2缩略图URL转换为Cloudflare优化版本，支持渐进式加载
 * 
 * 特性：
 * - 保持原始数据库URL不变
 * - 动态生成优化版本URL
 * - 支持模糊占位图、响应式尺寸、格式优化
 * - 向后兼容非CDN URL
 */

export interface ThumbnailOptions {
  size?: 'small' | 'medium' | 'large' | number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  blur?: number; // 模糊半径
  dpr?: number;  // 设备像素比
}

export interface ResponsiveThumbnailUrls {
  blur: string;     // 模糊占位图（立即显示）
  normal: string;   // 正常显示图
  high: string;     // 高清版本（预加载）
}

// 设备类型检测
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

class ThumbnailUrlOptimizer {
  // Cloudflare R2 CDN域名
  private readonly CDN_DOMAIN = 'cdn.veo3video.me';
  
  // 预设尺寸配置
  private readonly SIZE_PRESETS = {
    small: 150,   // 移动端
    medium: 300,  // 平板
    large: 450    // 桌面端
  };
  
  // 质量预设
  private readonly QUALITY_PRESETS = {
    blur: 10,     // 模糊占位图极低质量
    normal: 85,   // 正常显示
    high: 95      // 高清显示
  };

  /**
   * 检测设备类型
   */
  detectDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';
    
    const width = window.innerWidth;
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  /**
   * 检测设备像素比
   */
  getDevicePixelRatio(): number {
    if (typeof window === 'undefined') return 1;
    return window.devicePixelRatio || 1;
  }

  /**
   * 检测WebP支持
   */
  supportsWebP(): boolean {
    if (typeof window === 'undefined') return false;
    
    // 检查浏览器是否支持WebP
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  /**
   * 判断是否为支持的CDN URL
   */
  isCDNUrl(url: string): boolean {
    return url.includes(this.CDN_DOMAIN);
  }

  /**
   * 构建Cloudflare Transform参数
   */
  private buildTransformParams(options: ThumbnailOptions): string {
    const params: string[] = [];
    
    // 尺寸参数
    if (options.size) {
      const width = typeof options.size === 'number' 
        ? options.size 
        : this.SIZE_PRESETS[options.size];
      params.push(`w=${width}`);
    }
    
    // 质量参数
    if (options.quality) {
      params.push(`q=${options.quality}`);
    }
    
    // 格式参数
    if (options.format) {
      params.push(`f=${options.format}`);
    }
    
    // 模糊参数
    if (options.blur) {
      params.push(`blur=${options.blur}`);
    }
    
    // 设备像素比
    if (options.dpr && options.dpr > 1) {
      params.push(`dpr=${options.dpr}`);
    }
    
    return params.join(',');
  }

  /**
   * 获取带缓存破坏参数的优化URL（用于CORS错误重试）
   */
  getOptimizedUrlWithCacheBust(originalUrl: string, options: ThumbnailOptions = {}): string {
    // 非CDN URL直接返回原始URL
    if (!this.isCDNUrl(originalUrl)) {
      return originalUrl;
    }

    try {
      // 移除现有的查询参数（如 ?v=timestamp）
      const cleanUrl = originalUrl.split('?')[0];
      
      // 构建Transform参数
      const transformParams = this.buildTransformParams(options);
      
      if (!transformParams) {
        return originalUrl; // 没有优化参数时返回原始URL
      }
      
      // 解析URL以获取域名和路径
      const url = new URL(cleanUrl);
      const path = url.pathname; // /templates/thumbnails/xxx.jpg
      
      // 添加时间戳查询参数来破坏缓存
      const finalPath = `${path}?v=${Date.now()}`;
      
      // 🚀 开发环境下生成相对路径，让Vite代理拦截Transform API请求
      if (import.meta.env.DEV) {
        // 开发环境使用相对路径，触发Vite代理
        return `/cdn-cgi/image/${transformParams}${finalPath}`;
      }
      
      // 生产环境使用完整URL
      const domain = url.origin; // https://cdn.veo3video.me
      return `${domain}/cdn-cgi/image/${transformParams}${finalPath}`;
    } catch (error) {
      console.warn('[ThumbnailOptimizer] 缓存破坏URL转换失败，使用原始URL:', error);
      return originalUrl;
    }
  }

  /**
   * 🚀 增强的多级回退URL生成策略
   * 为不同的错误情况生成合适的回退URL
   */
  generateFallbackUrls(originalUrl: string, options: ThumbnailOptions = {}): {
    primary: string;
    secondary: string;
    tertiary: string;
    final: string;
  } {
    if (!this.isCDNUrl(originalUrl)) {
      return {
        primary: originalUrl,
        secondary: originalUrl,
        tertiary: originalUrl,
        final: originalUrl
      };
    }

    try {
      const cleanUrl = originalUrl.split('?')[0];
      const url = new URL(cleanUrl);
      const path = url.pathname;
      const domain = url.origin;
      
      // 构建不同级别的优化参数
      const primaryParams = this.buildTransformParams(options);
      const fallbackOptions = { ...options, quality: Math.max((options.quality || 85) - 20, 60) };
      const secondaryParams = this.buildTransformParams(fallbackOptions);
      
      const baseUrls = {
        primary: primaryParams ? 
          (import.meta.env.DEV ? `/cdn-cgi/image/${primaryParams}${path}` : `${domain}/cdn-cgi/image/${primaryParams}${path}`) :
          originalUrl,
        secondary: secondaryParams ? 
          (import.meta.env.DEV ? `/cdn-cgi/image/${secondaryParams}${path}?fallback=1` : `${domain}/cdn-cgi/image/${secondaryParams}${path}?fallback=1`) :
          originalUrl,
        tertiary: import.meta.env.DEV ? `/api/r2${path}` : originalUrl, // 通过R2代理
        final: originalUrl // 最终回退到原始URL
      };

      return baseUrls;
    } catch (error) {
      console.warn('[ThumbnailOptimizer] 回退URL生成失败:', error);
      return {
        primary: originalUrl,
        secondary: originalUrl,
        tertiary: originalUrl,
        final: originalUrl
      };
    }
  }

  /**
   * 🚀 智能重试机制
   * 根据错误类型选择合适的重试策略
   */
  async retryWithFallback(
    originalUrl: string, 
    options: ThumbnailOptions = {},
    maxRetries: number = 3
  ): Promise<string> {
    const fallbackUrls = this.generateFallbackUrls(originalUrl, options);
    const urls = [fallbackUrls.primary, fallbackUrls.secondary, fallbackUrls.tertiary, fallbackUrls.final];
    
    for (let i = 0; i < urls.length && i < maxRetries; i++) {
      try {
        const testUrl = urls[i];
        const isValid = await this.validateImageUrl(testUrl);
        
        if (isValid) {
          if (i > 0) {
            console.log(`[ThumbnailOptimizer] 使用第${i + 1}级回退URL成功:`, testUrl.substring(0, 80) + '...');
          }
          return testUrl;
        }
      } catch (error) {
        console.warn(`[ThumbnailOptimizer] 第${i + 1}级回退失败:`, error.message);
        continue;
      }
    }
    
    // 所有回退都失败，返回原始URL
    console.warn('[ThumbnailOptimizer] 所有回退策略失败，使用原始URL');
    return originalUrl;
  }

  /**
   * 🚀 验证图片URL有效性
   */
  private async validateImageUrl(url: string, timeout: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      const timeoutId = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        resolve(false);
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(false);
      };

      // 设置crossOrigin以支持CORS
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }

  /**
   * 获取优化后的URL
   */
  getOptimizedUrl(originalUrl: string, options: ThumbnailOptions = {}): string {
    // 非CDN URL直接返回原始URL
    if (!this.isCDNUrl(originalUrl)) {
      return originalUrl;
    }

    try {
      // 移除现有的查询参数（如 ?v=timestamp）
      const cleanUrl = originalUrl.split('?')[0];
      
      // 构建Transform参数
      const transformParams = this.buildTransformParams(options);
      
      if (!transformParams) {
        return originalUrl; // 没有优化参数时返回原始URL
      }
      
      // 解析URL以获取域名和路径
      const url = new URL(cleanUrl);
      const path = url.pathname; // /templates/thumbnails/xxx.jpg
      
      // 🚀 开发环境下生成相对路径，让Vite代理拦截Transform API请求
      if (import.meta.env.DEV) {
        // 开发环境使用相对路径，触发Vite代理
        return `/cdn-cgi/image/${transformParams}${path}`;
      }
      
      // 生产环境使用完整URL
      const domain = url.origin; // https://cdn.veo3video.me
      return `${domain}/cdn-cgi/image/${transformParams}${path}`;
    } catch (error) {
      console.warn('[ThumbnailOptimizer] URL转换失败，使用原始URL:', error);
      return originalUrl;
    }
  }

  /**
   * 生成模糊占位图URL
   */
  getBlurUrl(originalUrl: string): string {
    return this.getOptimizedUrl(originalUrl, {
      size: 'small',
      quality: this.QUALITY_PRESETS.blur,
      format: 'auto',
      blur: 2
    });
  }

  /**
   * 生成响应式URL（根据设备类型）
   */
  getResponsiveUrl(originalUrl: string, deviceType?: DeviceType): string {
    const device = deviceType || this.detectDeviceType();
    const dpr = this.getDevicePixelRatio();
    
    return this.getOptimizedUrl(originalUrl, {
      size: device === 'mobile' ? 'small' : device === 'tablet' ? 'medium' : 'large',
      quality: this.QUALITY_PRESETS.normal,
      format: 'auto',
      dpr: dpr > 1 ? Math.min(dpr, 2) : undefined // 最大2x，避免文件过大
    });
  }

  /**
   * 生成高清URL
   */
  getHighResUrl(originalUrl: string): string {
    return this.getOptimizedUrl(originalUrl, {
      size: 'large',
      quality: this.QUALITY_PRESETS.high,
      format: 'auto'
    });
  }

  /**
   * 一次性生成所有需要的URL版本
   */
  generateResponsiveThumbnailUrls(originalUrl: string, deviceType?: DeviceType): ResponsiveThumbnailUrls {
    return {
      blur: this.getBlurUrl(originalUrl),
      normal: this.getResponsiveUrl(originalUrl, deviceType),
      high: this.getHighResUrl(originalUrl)
    };
  }

  /**
   * 预加载图片
   */
  preloadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      
      // 设置缓存策略
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }

  /**
   * 批量预加载图片
   */
  async preloadBatch(urls: string[], maxConcurrent: number = 3): Promise<(HTMLImageElement | Error)[]> {
    const results: (HTMLImageElement | Error)[] = [];
    
    // 分批处理，避免过多并发请求
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map(url => this.preloadImage(url))
      );
      
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : new Error(String(result.reason))
      ));
    }
    
    return results;
  }

  /**
   * 估算优化后的文件大小节省
   */
  estimateSizeSaving(_originalUrl: string): {
    webpSaving: number;      // WebP格式节省百分比
    qualitySaving: number;   // 质量优化节省百分比
    totalSaving: number;     // 总节省百分比
  } {
    // 基于经验数据的估算
    const webpSaving = this.supportsWebP() ? 0.4 : 0;  // WebP通常节省40%
    const qualitySaving = 0.15;  // 质量优化通常节省15%
    const totalSaving = Math.min(webpSaving + qualitySaving, 0.6); // 最大60%节省
    
    return {
      webpSaving,
      qualitySaving,
      totalSaving
    };
  }

  /**
   * 获取优化统计信息
   */
  getOptimizationStats(): {
    deviceType: DeviceType;
    devicePixelRatio: number;
    webpSupported: boolean;
    cdnDomain: string;
    sizePresets: typeof this.SIZE_PRESETS;
    qualityPresets: typeof this.QUALITY_PRESETS;
  } {
    return {
      deviceType: this.detectDeviceType(),
      devicePixelRatio: this.getDevicePixelRatio(),
      webpSupported: this.supportsWebP(),
      cdnDomain: this.CDN_DOMAIN,
      sizePresets: this.SIZE_PRESETS,
      qualityPresets: this.QUALITY_PRESETS
    };
  }
}

// 导出单例实例
export const thumbnailOptimizer = new ThumbnailUrlOptimizer();
export default thumbnailOptimizer;

/**
 * 🚀 性能监控和诊断工具
 */
class ThumbnailOptimizerDiagnostics {
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    transformApiRequests: 0,
    fallbackRequests: 0,
    averageResponseTime: 0,
    totalResponseTime: 0,
    errorTypes: new Map<string, number>(),
    urlPatterns: new Map<string, number>()
  };

  recordRequest(url: string, startTime: number, success: boolean, errorType?: string) {
    const responseTime = performance.now() - startTime;
    
    this.metrics.totalRequests++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.totalRequests;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      if (errorType) {
        this.metrics.errorTypes.set(errorType, (this.metrics.errorTypes.get(errorType) || 0) + 1);
      }
    }
    
    // 记录URL模式
    if (url.includes('cdn-cgi/image')) {
      this.metrics.transformApiRequests++;
    }
    
    // 记录域名模式
    try {
      const domain = new URL(url).hostname;
      this.metrics.urlPatterns.set(domain, (this.metrics.urlPatterns.get(domain) || 0) + 1);
    } catch {}
  }

  getReport() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
      transformApiUsage: this.metrics.totalRequests > 0 ? 
        (this.metrics.transformApiRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
      errorTypes: Object.fromEntries(this.metrics.errorTypes),
      urlPatterns: Object.fromEntries(this.metrics.urlPatterns),
      timestamp: new Date().toISOString()
    };
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      transformApiRequests: 0,
      fallbackRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      errorTypes: new Map(),
      urlPatterns: new Map()
    };
  }
}

// 创建诊断实例
const diagnostics = new ThumbnailOptimizerDiagnostics();

// 增强缩略图优化器，添加诊断功能
const enhancedThumbnailOptimizer = {
  ...thumbnailOptimizer,
  
  /**
   * 🚀 诊断功能增强的URL生成
   */
  async getOptimizedUrlWithDiagnostics(originalUrl: string, options: ThumbnailOptions = {}): Promise<string> {
    const startTime = performance.now();
    
    try {
      const optimizedUrl = thumbnailOptimizer.getOptimizedUrl(originalUrl, options);
      
      // 验证URL有效性
      const isValid = await thumbnailOptimizer.validateImageUrl(optimizedUrl);
      
      diagnostics.recordRequest(optimizedUrl, startTime, isValid);
      
      if (!isValid) {
        console.warn('[ThumbnailOptimizer] 优化URL验证失败，尝试回退策略');
        return await thumbnailOptimizer.retryWithFallback(originalUrl, options);
      }
      
      return optimizedUrl;
    } catch (error) {
      diagnostics.recordRequest(originalUrl, startTime, false, error.constructor.name);
      console.error('[ThumbnailOptimizer] 生成优化URL失败:', error);
      return originalUrl;
    }
  },

  /**
   * 🚀 批量测试Transform API性能
   */
  async testTransformApiPerformance(sampleUrls: string[] = []): Promise<any> {
    const defaultUrls = [
      'https://cdn.veo3video.me/templates/thumbnails/living-book-storms-thumbnail.jpg',
      'https://cdn.veo3video.me/templates/thumbnails/magical-creature-summon-thumbnail.jpg',
      'https://cdn.veo3video.me/templates/thumbnails/fireplace-cozy-selfie-thumbnail.jpg'
    ];
    
    const testUrls = sampleUrls.length > 0 ? sampleUrls : defaultUrls;
    const results = [];
    
    console.log('🧪 开始Transform API性能测试...');
    
    for (const url of testUrls) {
      const startTime = performance.now();
      
      try {
        // 测试多种优化参数
        const testCases = [
          { size: 'small', quality: 70, format: 'auto' as const },
          { size: 'medium', quality: 85, format: 'webp' as const },
          { size: 'large', quality: 95, format: 'auto' as const }
        ];
        
        for (const options of testCases) {
          const optimizedUrl = thumbnailOptimizer.getOptimizedUrl(url, options);
          const isValid = await thumbnailOptimizer.validateImageUrl(optimizedUrl);
          const responseTime = performance.now() - startTime;
          
          results.push({
            originalUrl: url.substring(url.lastIndexOf('/') + 1),
            options,
            optimizedUrl: optimizedUrl.substring(0, 100) + '...',
            isValid,
            responseTime: `${responseTime.toFixed(1)}ms`,
            environment: import.meta.env.DEV ? 'development' : 'production'
          });
        }
      } catch (error) {
        results.push({
          originalUrl: url,
          error: error.message,
          responseTime: `${(performance.now() - startTime).toFixed(1)}ms`
        });
      }
    }
    
    console.log('📊 Transform API性能测试结果:', results);
    return results;
  },

  /**
   * 🚀 获取诊断报告
   */
  getDiagnosticsReport: () => diagnostics.getReport(),
  
  /**
   * 🚀 重置诊断数据
   */
  resetDiagnostics: () => diagnostics.reset(),

  // 保持原有API
  ...thumbnailOptimizer
};

// 开发环境下添加到全局对象，方便调试
if (import.meta.env.DEV) {
  (window as any).thumbnailOptimizer = enhancedThumbnailOptimizer;
  
  console.log('🖼️ 增强版缩略图优化器已加载:');
  console.log('📍 基础功能:');
  console.log('  - window.thumbnailOptimizer.getOptimizedUrl(url, options) - 获取优化URL');
  console.log('  - window.thumbnailOptimizer.generateResponsiveThumbnailUrls(url) - 生成响应式URL集合');
  console.log('  - window.thumbnailOptimizer.getOptimizationStats() - 获取优化统计');
  console.log('🚀 增强功能:');
  console.log('  - window.thumbnailOptimizer.retryWithFallback(url, options) - 智能重试机制');
  console.log('  - window.thumbnailOptimizer.generateFallbackUrls(url, options) - 多级回退URL');
  console.log('  - window.thumbnailOptimizer.getOptimizedUrlWithDiagnostics(url, options) - 带诊断的URL生成');
  console.log('📊 诊断工具:');
  console.log('  - window.thumbnailOptimizer.testTransformApiPerformance() - 性能测试');
  console.log('  - window.thumbnailOptimizer.getDiagnosticsReport() - 获取诊断报告');
  console.log('  - window.thumbnailOptimizer.resetDiagnostics() - 重置诊断数据');
}